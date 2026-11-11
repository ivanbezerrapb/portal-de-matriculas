import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth } from "./auth";

// Configuração do Maxbot guardada num arquivo privado do armazenamento (só o servidor lê).
const BUCKET = "integracoes";
const PATH = "maxbot.json";
const DEFAULT_URL = "https://app.maxbot.com.br/api/v1.php";

type Stored = {
  api_url: string;
  enabled: boolean;
  token: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: string | null;
  last_test_at?: string | null;
  last_test_ok?: boolean | null;
  last_test_message?: string | null;
};

async function ensureAdmin(context: { supabase: SupabaseClient; userId: string }) {
  const { getPerms } = await import("./server");
  const perms = await getPerms(context.supabase, context.userId);
  if (!perms.isAdmin) throw new Error("Sem permissão.");
}

async function admin() {
  const { extAdmin } = await import("./server");
  return extAdmin();
}

async function readStored(db: SupabaseClient): Promise<Stored> {
  const empty: Stored = { api_url: DEFAULT_URL, enabled: false, token: null, updated_by: null, updated_by_name: null, updated_at: null };
  const { data } = await db.storage.from(BUCKET).download(PATH);
  if (!data) return empty;
  try {
    return { ...empty, ...(JSON.parse(await data.text()) as Partial<Stored>) };
  } catch {
    return empty;
  }
}

async function writeStored(db: SupabaseClient, s: Stored) {
  const { data: buckets } = await db.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await db.storage.createBucket(BUCKET, { public: false });
  }
  const body = new Blob([JSON.stringify(s)], { type: "application/json" });
  const { error } = await db.storage.from(BUCKET).upload(PATH, body, { upsert: true, contentType: "application/json" });
  if (error) throw new Error("Não foi possível salvar a configuração.");
}

function publicView(s: Stored) {
  return {
    api_url: s.api_url,
    enabled: s.enabled,
    token_set: Boolean(s.token),
    updated_by_name: s.updated_by_name,
    updated_at: s.updated_at,
    last_test_at: s.last_test_at ?? null,
    last_test_ok: s.last_test_ok ?? null,
    last_test_message: s.last_test_message ?? null,
  };
}

async function logActivity(db: SupabaseClient, userId: string, name: string | null, label: string, data: Record<string, unknown>) {
  await db.from("activity_logs").insert({
    actor_id: userId, actor_name: name, action: "update", table_name: "maxbot_settings",
    record_id: "maxbot", label, new_data: data,
  });
}

async function actorName(db: SupabaseClient, userId: string) {
  const { data } = await db.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return (data as { full_name: string | null } | null)?.full_name ?? null;
}

export const getMaxbotSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    return publicView(await readStored(await admin()));
  });

export const saveMaxbotSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({
      api_url: z.string().trim().url("Endereço inválido.").max(300),
      enabled: z.boolean(),
      token: z.string().trim().max(500).optional(),
      clear_token: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const cur = await readStored(db);
    const name = await actorName(db, context.userId);
    const tokenChanged = Boolean(data.token) || Boolean(data.clear_token);
    const next: Stored = {
      ...cur,
      api_url: data.api_url,
      enabled: data.enabled,
      token: data.clear_token ? null : data.token ? data.token : cur.token,
      updated_by: context.userId,
      updated_by_name: name,
      updated_at: new Date().toISOString(),
    };
    if (next.enabled && !next.token) throw new Error("Informe o token antes de ativar a integração.");
    await writeStored(db, next);
    await logActivity(db, context.userId, name, "Configuração Maxbot salva", {
      api_url: next.api_url, enabled: next.enabled, token: tokenChanged ? (next.token ? "alterado" : "removido") : "sem alteração",
    });
    return publicView(next);
  });

export const testMaxbotConnection = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const db = await admin();
    const cur = await readStored(db);
    if (!cur.token) return { ok: false, message: "Nenhum token configurado." };
    let ok = false;
    let message = "";
    try {
      const res = await fetch(cur.api_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cur.token, cmd: "get_service_sector" }),
      });
      const text = await res.text();
      let json: Record<string, unknown> | null = null;
      try { json = JSON.parse(text); } catch { /* resposta não JSON */ }
      const status = json?.["status"];
      const msg = typeof json?.["msg"] === "string" ? json["msg"] : typeof json?.["message"] === "string" ? json["message"] : "";
      ok = res.ok && json !== null && status !== 0 && status !== "0" && status !== false && status !== "error";
      message = ok ? "Conectado ao Maxbot." : `O Maxbot recusou a conexão${msg ? `: ${msg}` : " (verifique o token)."}`;
      if (!res.ok) message = `O Maxbot respondeu com erro (${res.status}).`;
    } catch (e) {
      console.error("maxbot test", e);
      message = "Não foi possível alcançar o Maxbot. Verifique o endereço.";
    }
    const name = await actorName(db, context.userId);
    await writeStored(db, { ...cur, last_test_at: new Date().toISOString(), last_test_ok: ok, last_test_message: message });
    await logActivity(db, context.userId, name, "Teste de conexão Maxbot", { ok, message });
    return { ok, message };
  });
