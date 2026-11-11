import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth } from "./auth";

const accountSchema = z.enum(["conecta", "interactivo"]);

async function ensureAdmin(context: { supabase: SupabaseClient; userId: string }) {
  const { getPerms } = await import("./server");
  const perms = await getPerms(context.supabase, context.userId);
  if (!perms.isAdmin) throw new Error("Sem permissão.");
}

async function admin() {
  const { extAdmin } = await import("./server");
  return extAdmin();
}

type StoredT = import("./maxbot.server").Stored;

function publicView(s: StoredT) {
  return {
    api_url: s.api_url,
    enabled: s.enabled,
    token_set: Boolean(s.token),
    updated_by_name: s.updated_by_name,
    updated_at: s.updated_at,
    last_test_at: s.last_test_at ?? null,
    last_test_ok: s.last_test_ok ?? null,
    last_test_message: s.last_test_message ?? null,
    segmentations: s.segmentations ?? {},
    import_since: s.import_since ?? null,
    import_enabled: Boolean(s.import_enabled),
    last_import: s.last_import ?? null,
    imported_count: Object.keys(s.imported ?? {}).length,
  };
}

async function actorName(db: SupabaseClient, userId: string) {
  const { data } = await db.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return (data as { full_name: string | null } | null)?.full_name ?? null;
}

export const getMaxbotSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll } = await import("./maxbot.server");
    const all = await readAll(db);
    const { data: schools } = await db.from("schools").select("id, name, brand");
    return {
      conecta: publicView(all.conecta),
      interactivo: publicView(all.interactivo),
      schools: ((schools ?? []) as { id: string; name: string; brand: string | null }[]),
    };
  });

export const saveMaxbotSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({
      account: accountSchema,
      api_url: z.string().trim().url("Endereço inválido.").max(300),
      enabled: z.boolean(),
      token: z.string().trim().max(500).optional(),
      clear_token: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, writeAll, logActivity, ACCOUNT_LABEL } = await import("./maxbot.server");
    const all = await readAll(db);
    const cur = all[data.account];
    const name = await actorName(db, context.userId);
    const tokenChanged = Boolean(data.token) || Boolean(data.clear_token);
    const next: StoredT = {
      ...cur,
      api_url: data.api_url,
      enabled: data.enabled,
      token: data.clear_token ? null : data.token ? data.token : cur.token,
      updated_by: context.userId,
      updated_by_name: name,
      updated_at: new Date().toISOString(),
    };
    if (next.enabled && !next.token) throw new Error("Informe o token antes de ativar a integração.");
    if (!next.token) next.import_enabled = false;
    all[data.account] = next;
    await writeAll(db, all);
    await logActivity(db, context.userId, name, `Configuração ${ACCOUNT_LABEL[data.account]} salva`, {
      api_url: next.api_url, enabled: next.enabled, token: tokenChanged ? (next.token ? "alterado" : "removido") : "sem alteração",
    });
    return publicView(next);
  });

export const testMaxbotConnection = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ account: accountSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, writeAll, logActivity, maxbotCall, ACCOUNT_LABEL } = await import("./maxbot.server");
    const all = await readAll(db);
    const cur = all[data.account];
    if (!cur.token) return { ok: false, message: "Nenhum token configurado." };
    let ok = false;
    let message = "";
    try {
      await maxbotCall(cur, { cmd: "get_service_sector" });
      ok = true;
      message = "Conectado ao Maxbot.";
    } catch (e) {
      message = e instanceof Error ? e.message : "Não foi possível alcançar o Maxbot.";
    }
    const name = await actorName(db, context.userId);
    all[data.account] = { ...cur, last_test_at: new Date().toISOString(), last_test_ok: ok, last_test_message: message };
    await writeAll(db, all);
    await logActivity(db, context.userId, name, `Teste de conexão ${ACCOUNT_LABEL[data.account]}`, { ok, message });
    return { ok, message };
  });

export const listMaxbotSegmentations = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ account: accountSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, maxbotCall } = await import("./maxbot.server");
    const all = await readAll(db);
    try {
      const json = await maxbotCall(all[data.account], { cmd: "get_segmentation", type: "0" });
      const list = (json["segmentation"] as { id: number; title: string }[] | undefined) ?? [];
      return { ok: true, error: null as string | null, items: list.map((s) => ({ id: String(s.id), title: s.title })) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Falha ao buscar etiquetas.", items: [] };
    }
  });

export const saveMaxbotImport = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({
      account: accountSchema,
      segmentations: z.record(z.string().uuid(), z.string().max(200)),
      import_since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullable(),
      import_enabled: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, writeAll, logActivity, ACCOUNT_LABEL } = await import("./maxbot.server");
    const all = await readAll(db);
    const cur = all[data.account];
    const segs = Object.fromEntries(Object.entries(data.segmentations).filter(([, v]) => v.trim()));
    if (data.import_enabled) {
      if (!cur.token) throw new Error("Salve o token antes de ativar a importação.");
      if (!data.import_since) throw new Error("Informe a data inicial.");
      if (Object.keys(segs).length === 0) throw new Error("Escolha a etiqueta de ao menos uma unidade.");
    }
    all[data.account] = { ...cur, segmentations: segs, import_since: data.import_since, import_enabled: data.import_enabled };
    await writeAll(db, all);
    const name = await actorName(db, context.userId);
    await logActivity(db, context.userId, name, `Importação de LEADS ${ACCOUNT_LABEL[data.account]} configurada`, {
      etiquetas: segs, a_partir_de: data.import_since, automatica: data.import_enabled,
    });
    return { ok: true };
  });

export const runMaxbotImport = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({
      account: accountSchema,
      segmentations: z.record(z.string().uuid(), z.string().max(200)).optional(),
      import_since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullable().optional(),
      test: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { importAccount, logActivity, ACCOUNT_LABEL } = await import("./maxbot.server");
    const overrides =
      data.segmentations || data.import_since !== undefined
        ? { segmentations: data.segmentations, import_since: data.import_since ?? null }
        : undefined;
    const summary = await importAccount(db, data.account, overrides);
    if (data.test) {
      const name = await actorName(db, context.userId);
      await logActivity(db, context.userId, name, `Teste de importação de LEADS ${ACCOUNT_LABEL[data.account]}`, {
        ok: summary.ok, found: summary.found, imported: summary.imported, skipped: summary.skipped, message: summary.message,
      });
    }
    return summary;
  });

// ===== Vínculo usuário do Portal ↔ atendente Maxbot =====
export const getMaxbotUserLinks = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, listAttendants, ACCOUNTS } = await import("./maxbot.server");
    const all = await readAll(db);
    const out = {} as Record<
      "conecta" | "interactivo",
      { token_set: boolean; error: string | null; attendants: { id: string; name: string; active: boolean }[]; links: Record<string, { id: string; name: string }> }
    >;
    for (const a of ACCOUNTS) {
      const s = all[a];
      let attendants: { id: string; name: string; active: boolean }[] = [];
      let error: string | null = null;
      if (s.token) {
        try { attendants = await listAttendants(s); } catch (e) { error = e instanceof Error ? e.message : "Falha ao buscar atendentes."; }
      }
      out[a] = { token_set: Boolean(s.token), error, attendants, links: s.attendants ?? {} };
    }
    return out;
  });

const linkSchema = z.object({ id: z.string(), name: z.string() }).nullable();
export const saveMaxbotUserLink = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({ userId: z.string().uuid(), conecta: linkSchema.optional(), interactivo: linkSchema.optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, writeAll, logActivity, ACCOUNT_LABEL, ACCOUNTS } = await import("./maxbot.server");
    const all = await readAll(db);
    const changes: Record<string, unknown> = {};
    for (const a of ACCOUNTS) {
      const v = data[a];
      if (v === undefined) continue;
      const map = { ...(all[a].attendants ?? {}) };
      if (v) {
        const other = Object.entries(map).find(([uid, l]) => l.id === v.id && uid !== data.userId);
        if (other) {
          const { data: p } = await db.from("profiles").select("full_name").eq("id", other[0]).maybeSingle();
          throw new Error(`No ${ACCOUNT_LABEL[a]}, o atendente ${v.name} já está vinculado a ${(p as { full_name: string | null } | null)?.full_name ?? "outro usuário"}.`);
        }
        map[data.userId] = v;
      } else delete map[data.userId];
      all[a] = { ...all[a], attendants: map };
      changes[ACCOUNT_LABEL[a]] = v ? `${v.name} (ID ${v.id})` : "Não vinculado";
    }
    await writeAll(db, all);
    const { data: target } = await db.from("profiles").select("full_name").eq("id", data.userId).maybeSingle();
    const tName = (target as { full_name: string | null } | null)?.full_name ?? data.userId;
    await logActivity(db, context.userId, await actorName(db, context.userId), `Vínculo Maxbot de ${tName}`, changes);
    return { ok: true };
  });

// ===== Maxbot no card do CRM =====
async function loadOpp(context: { supabase: SupabaseClient }, id: string) {
  // RLS: só retorna se o usuário enxerga o cartão.
  const { data, error } = await context.supabase
    .from("opportunities").select("id, school_id, name, phone, email, submission_id").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem acesso a este cartão.");
  const o = data as { id: string; school_id: string; name: string | null; phone: string | null; email: string | null; submission_id: string | null };
  const { submissionContact } = await import("./maxbot.server");
  const sc = await submissionContact(await admin(), o.submission_id);
  return { ...o, display_name: sc.name || o.name, phone: o.phone || sc.phone };
}

const oppSchema = z.object({ opportunity_id: z.string().uuid() });

export const getCardMaxbotStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => oppSchema.parse(d))
  .handler(async ({ data, context }) => {
    const opp = await loadOpp(context, data.opportunity_id);
    const db = await admin();
    const { ensureOpportunityContact, ACCOUNT_LABEL } = await import("./maxbot.server");
    try {
      // Abre o card: se ainda não está no Maxbot, cadastra na hora.
      const r = await ensureOpportunityContact(db, opp, { register: true, actor: await actorName(db, context.userId) });
      return { status: r.status, contact_id: r.contactId, account_label: r.account ? ACCOUNT_LABEL[r.account] : null, error: null as string | null };
    } catch (e) {
      return { status: "error" as const, contact_id: null, account_label: null, error: e instanceof Error ? e.message : "Falha no Maxbot." };
    }
  });

export const listCardMaxbotTemplates = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => oppSchema.parse(d))
  .handler(async ({ data, context }) => {
    const opp = await loadOpp(context, data.opportunity_id);
    const db = await admin();
    const { readAll, accountForSchool, listFollowupTemplates, ACCOUNT_LABEL } = await import("./maxbot.server");
    const account = await accountForSchool(db, opp.school_id);
    if (!account) throw new Error("Unidade sem conta Maxbot.");
    const all = await readAll(db);
    if (!all[account].token) throw new Error(`${ACCOUNT_LABEL[account]} não está configurado.`);
    const attendant = all[account].attendants?.[context.userId] ?? null;
    return { account_label: ACCOUNT_LABEL[account], attendant, default_template_id: all[account].default_template?.id ?? null, templates: await listFollowupTemplates(all[account]) };
  });

export const sendCardMaxbotTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => oppSchema.extend({ template_id: z.string().min(1), template_title: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const opp = await loadOpp(context, data.opportunity_id);
    const db = await admin();
    const m = await import("./maxbot.server");
    const name = await actorName(db, context.userId);
    const r = await m.ensureOpportunityContact(db, opp, { register: true, actor: name });
    if (r.status !== "linked" || !r.account || !r.contactId) throw new Error("Contato ainda não está cadastrado no Maxbot.");
    const all = await m.readAll(db);
    const s = all[r.account];
    const def = s.default_template;
    if (!def?.id) throw new Error("Nenhum template padrão definido em Configurações › MAXBOT.");
    data.template_id = def.id; data.template_title = def.title;
    const att = s.attendants?.[context.userId];
    if (!att) throw new Error("Seu usuário não está vinculado a um atendente do Maxbot. Peça ao administrador em Configurações › Usuários.");
    const sector = await m.attendantSector(s, att.id);
    const [first, ...rest] = (opp.display_name ?? "").trim().split(/\s+/);
    const [aFirst, ...aRest] = att.name.trim().split(/\s+/);
    const json = await m.maxbotCall(s, {
      cmd: "open_followup", contact_id: Number(r.contactId), template_id: Number(data.template_id),
      attendant_id: Number(att.id), ...(sector ? { sector_id: Number(sector) } : {}), scheduled: 0, date_time: new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 19).replace("T", " "),
      tag_name: first ?? "", tag_last_name: rest.join(" "), tag_atd_name: aFirst ?? "", tag_atd_last_name: aRest.join(" "),
    });
    const protocol = String(json["protocol"] ?? json["prot_id"] ?? "");
    await db.from("crm_notes").insert({
      opportunity_id: opp.id, author_id: context.userId, author_name: name ?? "Usuário",
      body: `Template "${data.template_title}" enviado via ${m.ACCOUNT_LABEL[r.account]}${protocol ? ` (protocolo ${protocol})` : ""}.`,
    });
    await m.logActivity(db, context.userId, name, `Mensagem Maxbot enviada para ${opp.display_name ?? ""}`, { template: data.template_title, protocolo: protocol, atendente: att.name }, opp.school_id);
    return { ok: true, protocol };
  });

export const listMaxbotTemplatesAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ account: accountSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, listFollowupTemplates } = await import("./maxbot.server");
    const all = await readAll(db);
    const s = all[data.account];
    return { current: s.default_template?.id ?? "", templates: s.token ? await listFollowupTemplates(s) : [] };
  });

export const saveMaxbotDefaultTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ account: accountSchema, id: z.string().max(50), title: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { readAll, writeAll, logActivity, ACCOUNT_LABEL } = await import("./maxbot.server");
    const all = await readAll(db);
    all[data.account] = { ...all[data.account], default_template: data.id ? { id: data.id, title: data.title } : null };
    await writeAll(db, all);
    const name = await actorName(db, context.userId);
    await logActivity(db, context.userId, name, `Template padrão ${ACCOUNT_LABEL[data.account]} definido`, { template: data.title || "Nenhum" });
    return { ok: true };
  });
