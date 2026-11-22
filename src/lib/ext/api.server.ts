import type { SupabaseClient } from "@supabase/supabase-js";
import { bearer, findSchool, formatPhone, matchOption, norm, phoneKey, sha256Hex } from "./api-logic";
import { compareSchoolNames } from "@/lib/school-order";

// Chaves da API pública: guardadas (só o hash) no armazenamento privado do banco externo.
const BUCKET = "integracoes";
const PATH = "api.json";

export type ApiKey = {
  id: string; name: string; hash: string; preview: string;
  created_at: string; created_by_name: string | null;
  last_used_at: string | null; revoked_at: string | null; uses: number;
};
type Store = { keys: ApiKey[] };

export async function readStore(db: SupabaseClient): Promise<Store> {
  const { data } = await db.storage.from(BUCKET).download(PATH);
  if (!data) return { keys: [] };
  try { const j = JSON.parse(await data.text()) as Partial<Store>; return { keys: j.keys ?? [] }; } catch { return { keys: [] }; }
}

export async function writeStore(db: SupabaseClient, s: Store) {
  const { data: buckets } = await db.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) await db.storage.createBucket(BUCKET, { public: false });
  const { error } = await db.storage.from(BUCKET).upload(PATH, new Blob([JSON.stringify(s)], { type: "application/json" }), { upsert: true, contentType: "application/json" });
  if (error) throw new Error("Não foi possível salvar as chaves.");
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

export function fail(e: unknown) {
  if (e instanceof ApiError) return json({ ok: false, erro: e.code, mensagem: e.message }, e.status);
  console.error("api publica", e);
  return json({ ok: false, erro: "erro_interno", mensagem: "Erro interno. Tente novamente." }, 500);
}

// Confere a chave Bearer e devolve o banco + nome da integração.
export async function authenticate(request: Request) {
  const token = bearer(request.headers.get("authorization"));
  if (!token) throw new ApiError(401, "nao_autorizado", "Envie o cabeçalho Authorization: Bearer <chave>.");
  const { extAdmin } = await import("./server");
  const db = extAdmin();
  const store = await readStore(db);
  const hash = await sha256Hex(token);
  const key = store.keys.find((k) => k.hash === hash && !k.revoked_at);
  if (!key) throw new ApiError(401, "nao_autorizado", "Chave de API inválida ou revogada.");
  key.last_used_at = new Date().toISOString();
  key.uses = (key.uses ?? 0) + 1;
  try { await writeStore(db, store); } catch { /* uso não registrado não bloqueia */ }
  return { db, integration: `API: ${key.name}` };
}

async function log(db: SupabaseClient, who: string, label: string, data: Record<string, unknown>, schoolId: string | null) {
  await db.from("activity_logs").insert({
    actor_id: null, actor_name: who, action: "create", table_name: "api_publica",
    record_id: "api", school_id: schoolId, label, new_data: data,
  });
}

// ---------- Escolas ----------
export async function listSchools(db: SupabaseClient) {
  const { data: schools } = await db.from("schools").select("id, name");
  const { data: funnels } = await db.from("funnels").select("id, name, school_id, funnel_stages(id, name, position)");
  const { data: forms } = await db.from("forms").select("id, school_id, status, list_type, created_at").eq("list_type", "leads").order("created_at", { ascending: false });
  const formIds = [...new Set((forms ?? []).map((f) => f.id))];
  const { data: fields } = formIds.length
    ? await db.from("form_fields").select("form_id, label, options").in("form_id", formIds).eq("internal", false)
    : { data: [] };
  return ((schools ?? []) as { id: string; name: string }[]).sort((a, b) => compareSchoolNames(a.name, b.name)).map((s) => {
    const form = (forms ?? []).find((f) => f.school_id === s.id && f.status === "published") ?? (forms ?? []).find((f) => f.school_id === s.id);
    const fl = (fields ?? []).filter((f) => f.form_id === form?.id) as { label: string; options: string[] | null }[];
    return {
      id: s.id,
      nome: s.name,
      series: fl.find((f) => /^s[ée]rie/i.test(f.label))?.options ?? [],
      origens: fl.find((f) => /origem/i.test(f.label))?.options ?? [],
      funis: ((funnels ?? []) as { id: string; name: string; school_id: string; funnel_stages: { id: string; name: string; position: number }[] }[])
        .filter((f) => f.school_id === s.id)
        .map((f) => ({ id: f.id, nome: f.name, etapas: [...f.funnel_stages].sort((a, b) => a.position - b.position).map((e) => ({ id: e.id, nome: e.name })) })),
    };
  });
}

// ---------- Leads ----------
export type LeadInput = {
  escola: string; nome: string; telefone: string; email?: string | undefined;
  serie?: string[] | undefined; origem?: string | undefined; observacao?: string | undefined;
};

async function findLeadByPhone(db: SupabaseClient, schoolId: string, pk: string) {
  const { data } = await db.from("opportunities").select("id, name, phone, submissions(public_id)").eq("school_id", schoolId).not("phone", "is", null);
  return ((data ?? []) as unknown as { id: string; name: string; phone: string; submissions: { public_id: string | null } | null }[])
    .find((o) => phoneKey(o.phone) === pk) ?? null;
}

export async function createLead(db: SupabaseClient, who: string, input: LeadInput) {
  const { data: schools } = await db.from("schools").select("id, name");
  const school = findSchool((schools ?? []) as { id: string; name: string }[], input.escola);
  if (!school) throw new ApiError(422, "escola_invalida", `Escola "${input.escola}" não encontrada. Consulte GET /api/public/v1/escolas.`);
  const pk = phoneKey(input.telefone);
  if (pk.length < 10) throw new ApiError(422, "telefone_invalido", "Telefone precisa ter DDD + número.");

  const dup = await findLeadByPhone(db, school.id, pk);
  if (dup) return { status: 200, body: { ok: true, criado: false, mensagem: "Lead já existe nesta escola (mesmo telefone).", lead: { codigo: dup.submissions?.public_id ?? null, card_id: dup.id, nome: dup.name } } };

  const { data: forms } = await db.from("forms").select("id, status").eq("school_id", school.id).eq("list_type", "leads").order("created_at", { ascending: false });
  const form = (forms ?? []).find((f) => f.status === "published") ?? forms?.[0];
  if (!form) throw new ApiError(422, "sem_formulario", "A escola não tem formulário de LEADS.");
  const { data: fields } = await db.from("form_fields").select("id, label, type, options").eq("form_id", form.id).eq("internal", false);
  const fl = (fields ?? []) as { id: string; label: string; type: string; options: string[] | null }[];

  const values: Record<string, string | string[]> = {};
  const stored: Record<string, string> = {};
  for (const f of fl) {
    const l = norm(f.label);
    if (/^nome/.test(l)) { values[f.id] = input.nome; stored[f.id] = input.nome; }
    else if (/telefone|whats|celular/.test(l)) { values[f.id] = formatPhone(input.telefone); stored[f.id] = values[f.id] as string; }
    else if (/e-?mail/.test(l) && input.email) { values[f.id] = input.email; stored[f.id] = input.email; }
    else if (/origem/.test(l)) {
      const o = input.origem ? matchOption(input.origem, f.options) : null;
      if (input.origem && !o) throw new ApiError(422, "origem_invalida", `Origem "${input.origem}" não existe. Opções: ${(f.options ?? []).join(", ")}`);
      const v = o ?? f.options?.find((x) => /site|internet|api/i.test(x)) ?? null;
      if (v) { values[f.id] = v; stored[f.id] = v; }
    } else if (/^serie/.test(l) && input.serie?.length) {
      const picked = input.serie.map((s) => { const m = matchOption(s, f.options); if (!m) throw new ApiError(422, "serie_invalida", `Série "${s}" não existe. Opções: ${(f.options ?? []).join(", ")}`); return m; });
      const multi = f.type === "multiple_choice";
      values[f.id] = multi ? picked : picked[0]!;
      stored[f.id] = multi ? JSON.stringify(picked) : picked[0]!;
    }
  }

  const { data: publicId, error: idErr } = await db.rpc("next_school_lead_id", { p_school_id: school.id });
  if (idErr || !publicId) throw new Error("Falha ao gerar o código do lead.");
  const { data: sub, error } = await db.from("submissions").insert({ form_id: form.id, school_id: school.id, public_id: publicId, list_type: "leads" }).select("id").single();
  if (error) throw new Error(error.message);
  const rows = Object.entries(stored).map(([field_id, value]) => ({ submission_id: sub.id, field_id, part: "", value }));
  if (rows.length) await db.from("submission_values").insert(rows);
  const { applyDestination } = await import("./destino.server");
  let destino = "";
  try { destino = (await applyDestination(db, { submissionId: sub.id, formId: form.id, schoolId: school.id, publicId: publicId as string, values })).status; } catch { destino = "erro"; }
  const { data: opp } = await db.from("opportunities").select("id").eq("submission_id", sub.id).maybeSingle();
  if (opp && input.observacao) {
    await db.from("crm_notes").insert({ opportunity_id: opp.id, author_id: null, author_name: who, body: input.observacao });
  }
  await log(db, who, `Lead criado pela API: ${publicId} ${input.nome}`, { telefone: input.telefone }, school.id);
  return { status: 201, body: { ok: true, criado: true, lead: { codigo: publicId, card_id: opp?.id ?? null, escola: school.name, nome: input.nome, no_funil: destino === "sent" } } };
}

// ---------- Localizar card ----------
export async function findCard(db: SupabaseClient, ref: { codigo?: string | undefined; telefone?: string | undefined; escola?: string | undefined }) {
  type Row = { id: string; name: string; phone: string | null; school_id: string; funnel_id: string; stage_id: string; status: string; visit_at: string | null; owner_id: string | null; owner_confirmed_at: string | null; submissions: { public_id: string | null; list_type: string | null } | null };
  const sel = "id, name, phone, school_id, funnel_id, stage_id, status, visit_at, owner_id, owner_confirmed_at, submissions!inner(public_id, list_type)";
  if (ref.codigo) {
    const { data } = await db.from("opportunities").select(sel).ilike("submissions.public_id", ref.codigo.trim()).order("created_at", { ascending: false }).limit(1);
    const r = (data ?? [])[0] as unknown as Row | undefined;
    if (!r) throw new ApiError(404, "card_nao_encontrado", `Nenhum card com o código ${ref.codigo}.`);
    return r;
  }
  if (ref.telefone) {
    const pk = phoneKey(ref.telefone);
    let q = db.from("opportunities").select(sel).not("phone", "is", null).order("created_at", { ascending: false });
    if (ref.escola) {
      const { data: schools } = await db.from("schools").select("id, name");
      const s = findSchool((schools ?? []) as { id: string; name: string }[], ref.escola);
      if (!s) throw new ApiError(422, "escola_invalida", `Escola "${ref.escola}" não encontrada.`);
      q = q.eq("school_id", s.id);
    }
    const { data } = await q;
    const r = ((data ?? []) as unknown as Row[]).find((o) => o.phone && phoneKey(o.phone) === pk);
    if (!r) throw new ApiError(404, "card_nao_encontrado", "Nenhum card com esse telefone.");
    return r;
  }
  throw new ApiError(422, "referencia_ausente", "Informe codigo ou telefone.");
}

export async function cardView(db: SupabaseClient, c: Awaited<ReturnType<typeof findCard>>) {
  const [{ data: st }, { data: fn }, { data: sc }] = await Promise.all([
    db.from("funnel_stages").select("name").eq("id", c.stage_id).maybeSingle(),
    db.from("funnels").select("name").eq("id", c.funnel_id).maybeSingle(),
    db.from("schools").select("name").eq("id", c.school_id).maybeSingle(),
  ]);
  return {
    card_id: c.id, codigo: c.submissions?.public_id ?? null, nome: c.name, telefone: c.phone,
    escola: sc?.name ?? null, funil: fn?.name ?? null, etapa: st?.name ?? null,
    situacao: c.status, agendamento: c.visit_at,
  };
}

async function moveTo(db: SupabaseClient, c: { id: string; stage_id: string; owner_id: string | null; owner_confirmed_at: string | null }, stageId: string) {
  if (c.stage_id === stageId) return;
  const now = new Date().toISOString();
  const { data: last } = await db.from("opportunities").select("position").eq("stage_id", stageId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await db.from("opportunities").update({
    stage_id: stageId, position: ((last?.position as number | undefined) ?? -1) + 1, updated_at: now,
    ...(!c.owner_confirmed_at && c.owner_id ? { owner_confirmed_at: now } : {}),
  }).eq("id", c.id);
  if (error) throw new Error(error.message);
}

function fmtWhen(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)).replace(",", " às");
}

// ---------- Agendamento ----------
export async function schedule(db: SupabaseClient, who: string, input: { codigo?: string | undefined; telefone?: string | undefined; escola?: string | undefined; data_hora: string; atendente?: string | undefined; observacao?: string | undefined }) {
  const c = await findCard(db, input);
  if (c.status !== "open") throw new ApiError(409, "card_fechado", "Card já está ganho ou perdido.");
  const { error } = await db.from("opportunities").update({ visit_at: input.data_hora, updated_at: new Date().toISOString() }).eq("id", c.id);
  if (error) throw new Error(error.message);
  const { data: stages } = await db.from("funnel_stages").select("id, name").eq("funnel_id", c.funnel_id);
  const isLead = c.submissions?.list_type === "leads" || c.submissions?.list_type === "lead";
  const target = (stages ?? []).find((s) => norm(s.name).includes(isLead ? "visita agendada" : "matricula agendada"))
    ?? (stages ?? []).find((s) => { const n = norm(s.name); return n.includes("visita agendada") || n.includes("matricula agendada"); });
  if (target) await moveTo(db, c, target.id);
  const kind = target && norm(target.name).includes("visita") ? "Visita" : "Matrícula";
  const author = input.atendente?.trim() || who;
  await db.from("crm_notes").insert({ opportunity_id: c.id, author_id: null, author_name: author, body: `${kind} agendada para ${fmtWhen(input.data_hora)} — por ${author}.${input.observacao ? ` ${input.observacao}` : ""}` });
  await log(db, who, `Agendamento pela API: ${c.submissions?.public_id ?? c.name}`, { data_hora: input.data_hora }, c.school_id);
  const fresh = await findCard(db, { codigo: c.submissions?.public_id ?? undefined, telefone: c.phone ?? undefined });
  return { ok: true, tipo: kind.toLowerCase(), card: await cardView(db, fresh) };
}

// ---------- Etapa ----------
export async function moveStage(db: SupabaseClient, who: string, input: { codigo?: string | undefined; telefone?: string | undefined; escola?: string | undefined; etapa: string }) {
  const c = await findCard(db, input);
  if (c.status !== "open") throw new ApiError(409, "card_fechado", "Card já está ganho ou perdido.");
  const { data: stages } = await db.from("funnel_stages").select("id, name").eq("funnel_id", c.funnel_id);
  const n = norm(input.etapa);
  const target = (stages ?? []).find((s) => s.id === input.etapa || norm(s.name) === n);
  if (!target) throw new ApiError(422, "etapa_invalida", `Etapa "${input.etapa}" não existe neste funil. Opções: ${(stages ?? []).map((s) => s.name).join(", ")}`);
  if (norm(target.name).includes("matriculado") || norm(target.name).includes("perdid")) throw new ApiError(422, "etapa_restrita", "Ganho e perda são feitos dentro do portal.");
  await moveTo(db, c, target.id);
  await db.from("crm_notes").insert({ opportunity_id: c.id, author_id: null, author_name: who, body: `Card movido para "${target.name}" pela integração.` });
  await log(db, who, `Etapa alterada pela API: ${c.submissions?.public_id ?? c.name} → ${target.name}`, {}, c.school_id);
  return { ok: true, card: await cardView(db, { ...c, stage_id: target.id }) };
}

// ---------- Nota ----------
export async function addNote(db: SupabaseClient, who: string, input: { codigo?: string | undefined; telefone?: string | undefined; escola?: string | undefined; texto: string; autor?: string | undefined }) {
  const c = await findCard(db, input);
  const { error } = await db.from("crm_notes").insert({ opportunity_id: c.id, author_id: null, author_name: input.autor?.trim() || who, body: input.texto });
  if (error) throw new Error(error.message);
  return { ok: true, card: await cardView(db, c) };
}
