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
  .inputValidator((d) => z.object({ account: accountSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const { importAccount } = await import("./maxbot.server");
    return importAccount(db, data.account);
  });
