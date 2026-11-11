import { compareSchoolNames } from "@/lib/school-order";
import type { SupabaseClient } from "@supabase/supabase-js";

// Núcleo da integração Maxbot (somente servidor).
export const BUCKET = "integracoes";
export const PATH = "maxbot.json";
export const DEFAULT_URL = "https://app.maxbot.com.br/api/v1.php";
export const ACCOUNTS = ["conecta", "interactivo"] as const;
export type Account = (typeof ACCOUNTS)[number];
export const ACCOUNT_LABEL: Record<Account, string> = { conecta: "Maxbot Conecta", interactivo: "Maxbot Interactivo" };

export type ImportSummary = { at: string; ok: boolean; found: number; imported: number; skipped: number; message: string };

export type Stored = {
  api_url: string;
  enabled: boolean;
  token: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: string | null;
  last_test_at?: string | null;
  last_test_ok?: boolean | null;
  last_test_message?: string | null;
  // Importação de LEADS
  segmentations?: Record<string, string>; // schoolId -> título da segmentação
  import_since?: string | null; // AAAA-MM-DD
  import_enabled?: boolean;
  last_import?: ImportSummary | null;
  imported?: Record<string, string>; // contactId -> submissionId
};
export type All = Record<Account, Stored>;

export function empty(): Stored {
  return { api_url: DEFAULT_URL, enabled: false, token: null, updated_by: null, updated_by_name: null, updated_at: null };
}

export async function readAll(db: SupabaseClient): Promise<All> {
  const all: All = { conecta: empty(), interactivo: empty() };
  const { data } = await db.storage.from(BUCKET).download(PATH);
  if (!data) return all;
  try {
    const raw = JSON.parse(await data.text()) as Record<string, unknown>;
    if (raw["conecta"] || raw["interactivo"]) {
      for (const a of ACCOUNTS) all[a] = { ...empty(), ...((raw[a] as Partial<Stored>) ?? {}) };
    } else {
      all.conecta = { ...empty(), ...(raw as Partial<Stored>) };
    }
  } catch { /* arquivo inválido */ }
  return all;
}

export async function writeAll(db: SupabaseClient, s: All) {
  const { data: buckets } = await db.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) await db.storage.createBucket(BUCKET, { public: false });
  const body = new Blob([JSON.stringify(s)], { type: "application/json" });
  const { error } = await db.storage.from(BUCKET).upload(PATH, body, { upsert: true, contentType: "application/json" });
  if (error) throw new Error("Não foi possível salvar a configuração.");
}

export async function logActivity(db: SupabaseClient, userId: string | null, name: string | null, label: string, data: Record<string, unknown>, schoolId?: string | null) {
  await db.from("activity_logs").insert({
    actor_id: userId, actor_name: name, action: "update", table_name: "maxbot_settings",
    record_id: "maxbot", school_id: schoolId ?? null, label, new_data: data,
  });
}

export async function maxbotCall(s: Stored, body: Record<string, unknown>) {
  if (!s.token) throw new Error("Nenhum token configurado.");
  const res = await fetch(s.api_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: s.token, ...body }),
  });
  if (!res.ok) throw new Error(`O Maxbot respondeu com erro (${res.status}).`);
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json) throw new Error("Resposta inválida do Maxbot.");
  if (json["status"] === 0 || json["status"] === "0") throw new Error(`Maxbot: ${String(json["msg"] ?? "falha")}`);
  return json;
}

type Contact = {
  id: string | number; name?: string; surname?: string; email?: string;
  whatsapp?: string; mobile_phone?: string; phone?: string; segmentation?: string[];
};

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

function formatPhone(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}
const phoneKey = (v: string) => { let d = v.replace(/\D/g, ""); if (d.length >= 12 && d.startsWith("55")) d = d.slice(2); return d; };

// Busca os contatos do período e cadastra na Lista de LEADS os que têm a etiqueta da unidade.
export async function runImport(db: SupabaseClient, all: All, account: Account): Promise<ImportSummary> {
  const s = all[account];
  const at = new Date().toISOString();
  const map = Object.entries(s.segmentations ?? {}).filter(([, t]) => t);
  if (!s.token) return { at, ok: false, found: 0, imported: 0, skipped: 0, message: "Nenhum token configurado." };
  if (map.length === 0) return { at, ok: false, found: 0, imported: 0, skipped: 0, message: "Nenhuma etiqueta vinculada às unidades." };
  if (!s.import_since) return { at, ok: false, found: 0, imported: 0, skipped: 0, message: "Informe a data inicial." };
  // Contato com etiquetas de várias unidades entra na primeira pela ordem fixa (Centro, Expedicionários, Cristo, Bessa).
  const { data: schoolRows } = await db.from("schools").select("id, name").in("id", map.map(([id]) => id));
  const nameOf = new Map((schoolRows ?? []).map((r: { id: string; name: string }) => [r.id, r.name]));
  map.sort((a, b) => compareSchoolNames(nameOf.get(a[0]) ?? "", nameOf.get(b[0]) ?? ""));

  const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const contacts: Contact[] = [];
  const seen = new Set<string>();
  // 0 = data de cadastro, 1 = data da última atualização (pega contatos antigos que ganharam a etiqueta)
  for (const focus of ["0", "1"]) {
    for (let page = 1; page <= 200; page++) {
      const json = await maxbotCall(s, {
        cmd: "get_contact", focus_period: focus, date_start: s.import_since, date_stop: today,
        pagination: { per_page: "100", current: String(page) },
      });
      const list = (json["data"] as Contact[] | undefined) ?? [];
      for (const c of list) { const k = String(c.id); if (!seen.has(k)) { seen.add(k); contacts.push(c); } }
      const pag = json["pagination"] as { total_pages?: string | number } | undefined;
      if (list.length < 100 || page >= Number(pag?.total_pages ?? page)) break;
    }
  }

  const imported = (s.imported ??= {});
  let found = 0, done = 0, skipped = 0;
  const formCache = new Map<string, { formId: string; fields: { id: string; label: string; type: string; options: string[] | null }[]; phones: Set<string> } | null>();

  for (const c of contacts) {
    const segs = (c.segmentation ?? []).map(norm);
    const hit = map.find(([, title]) => segs.includes(norm(title)));
    if (!hit) continue;
    found++;
    const cid = String(c.id);
    if (imported[cid]) { skipped++; continue; }
    const schoolId = hit[0];

    if (!formCache.has(schoolId)) {
      const { data: forms } = await db.from("forms").select("id, status").eq("school_id", schoolId).eq("list_type", "leads").order("created_at", { ascending: false });
      const form = (forms ?? []).find((f) => f.status === "published") ?? forms?.[0];
      if (!form) { formCache.set(schoolId, null); }
      else {
        const { data: fields } = await db.from("form_fields").select("id, label, type, options").eq("form_id", form.id).eq("internal", false);
        const fl = (fields ?? []) as { id: string; label: string; type: string; options: string[] | null }[];
        const phoneField = fl.find((f) => /telefone|whats|celular/i.test(f.label));
        const phones = new Set<string>();
        if (phoneField) {
          const { data: vals } = await db.from("submission_values").select("value, submissions!inner(school_id, list_type)")
            .eq("field_id", phoneField.id).eq("part", "").eq("submissions.school_id", schoolId).eq("submissions.list_type", "leads");
          for (const v of (vals ?? []) as { value: string | null }[]) if (v.value) phones.add(phoneKey(v.value));
        }
        formCache.set(schoolId, { formId: form.id, fields: fl, phones });
      }
    }
    const info = formCache.get(schoolId);
    if (!info) { skipped++; continue; }

    const rawPhone = c.whatsapp || c.mobile_phone || c.phone || "";
    const pk = phoneKey(rawPhone);
    if (pk && info.phones.has(pk)) { skipped++; imported[cid] = "existente"; continue; }

    const name = [c.name, c.surname].filter(Boolean).join(" ").trim() || "Contato Maxbot";
    const values: Record<string, string> = {};
    for (const f of info.fields) {
      const l = f.label.toLowerCase();
      if (/^nome/.test(l)) values[f.id] = name;
      else if (/telefone|whats|celular/.test(l) && rawPhone) values[f.id] = formatPhone(rawPhone);
      else if (/e-?mail/.test(l) && c.email) values[f.id] = c.email;
      else if (/origem/.test(l)) values[f.id] = f.options?.find((o) => /whats/i.test(o)) ?? "WhatsApp";
    }

    const { data: publicId, error: idErr } = await db.rpc("next_school_lead_id", { p_school_id: schoolId });
    if (idErr || !publicId) throw new Error("Falha ao gerar o ID do lead.");
    const { data: sub, error: subErr } = await db.from("submissions")
      .insert({ form_id: info.formId, school_id: schoolId, public_id: publicId, list_type: "leads" })
      .select("id").single();
    if (subErr) throw new Error(subErr.message);
    const rows = Object.entries(values).map(([field_id, value]) => ({ submission_id: sub.id, field_id, part: "", value }));
    if (rows.length) await db.from("submission_values").insert(rows);
    try {
      const { applyDestination } = await import("./destino.server");
      await applyDestination(db, { submissionId: sub.id, formId: info.formId, schoolId, publicId: publicId as string, values });
    } catch { /* cadastro salvo mesmo sem destino */ }
    imported[cid] = sub.id;
    if (pk) info.phones.add(pk);
    done++;
    await logActivity(db, null, ACCOUNT_LABEL[account], `Lead importado do Maxbot: ${publicId} ${name}`, { contato_maxbot: cid, etiqueta: hit[1] }, schoolId);
  }

  return { at, ok: true, found, imported: done, skipped, message: done ? `${done} lead(s) importado(s).` : "Nenhum lead novo." };
}

// Executa a importação de uma conta e grava o resumo (relê o arquivo para não perder alterações).
// overrides permite rodar com a etiqueta/data que estão na tela, sem salvar antes.
export async function importAccount(
  db: SupabaseClient,
  account: Account,
  overrides?: { segmentations?: Record<string, string> | undefined; import_since?: string | null },
): Promise<ImportSummary> {
  const all = await readAll(db);
  if (overrides) {
    const patch: Partial<Stored> = {};
    if (overrides.segmentations) {
      patch.segmentations = Object.fromEntries(Object.entries(overrides.segmentations).filter(([, t]) => t.trim()));
    }
    if (overrides.import_since !== undefined) patch.import_since = overrides.import_since;
    all[account] = { ...all[account], ...patch };
  }
  let summary: ImportSummary;
  try {
    summary = await runImport(db, all, account);
  } catch (e) {
    console.error("maxbot import", e);
    summary = { at: new Date().toISOString(), ok: false, found: 0, imported: 0, skipped: 0, message: e instanceof Error ? e.message : "Falha na importação." };
  }
  const fresh = await readAll(db);
  fresh[account] = { ...fresh[account], imported: { ...(fresh[account].imported ?? {}), ...(all[account].imported ?? {}) }, last_import: summary };
  await writeAll(db, fresh);
  return summary;
}
