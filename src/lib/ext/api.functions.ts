import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth } from "./auth";

async function ensureAdmin(context: { supabase: SupabaseClient; userId: string }) {
  const { getPerms, extAdmin } = await import("./server");
  const perms = await getPerms(context.supabase, context.userId);
  if (!perms.isAdmin) throw new Error("Sem permissão.");
  return extAdmin();
}

const view = (k: import("./api.server").ApiKey) => ({
  id: k.id, name: k.name, preview: k.preview, created_at: k.created_at, created_by_name: k.created_by_name,
  last_used_at: k.last_used_at, revoked_at: k.revoked_at, uses: k.uses ?? 0,
});

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = await ensureAdmin(context);
    const { readStore } = await import("./api.server");
    return (await readStore(db)).keys.map(view).reverse();
  });

// Cria a chave e devolve o valor completo uma única vez.
export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ name: z.string().trim().min(2).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await ensureAdmin(context);
    const { readStore, writeStore } = await import("./api.server");
    const { newKeyValue, sha256Hex } = await import("./api-logic");
    const { data: profile } = await db.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
    const value = newKeyValue();
    const store = await readStore(db);
    store.keys.push({
      id: crypto.randomUUID(), name: data.name, hash: await sha256Hex(value), preview: `${value.slice(0, 12)}…${value.slice(-4)}`,
      created_at: new Date().toISOString(), created_by_name: profile?.full_name ?? null, last_used_at: null, revoked_at: null, uses: 0,
    });
    await writeStore(db, store);
    return { value };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await ensureAdmin(context);
    const { readStore, writeStore } = await import("./api.server");
    const store = await readStore(db);
    const k = store.keys.find((x) => x.id === data.id);
    if (!k) throw new Error("Chave não encontrada.");
    k.revoked_at = new Date().toISOString();
    await writeStore(db, store);
    return { ok: true };
  });

export const getApiCatalog = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = await ensureAdmin(context);
    const { listSchools } = await import("./api.server");
    return listSchools(db);
  });
