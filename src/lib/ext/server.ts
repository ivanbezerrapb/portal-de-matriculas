// Somente servidor: clientes do Supabase externo.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

// Chaves novas (sb_publishable_/sb_secret_) não são JWTs: enviar só como apikey.
function supabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    }
    if (
      (key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) &&
      headers.get("Authorization") === `Bearer ${key}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

// Cliente anônimo (sem sessão) — respeita RLS como anon.
export function extAnon(): SupabaseClient {
  const key = env("EXT_SUPABASE_PUBLISHABLE_KEY");
  return createClient(env("EXT_SUPABASE_URL"), key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: supabaseFetch(key) },
  });
}

// Cliente autenticado como o usuário do token — respeita RLS como o usuário.
export function extUserClient(token: string): SupabaseClient {
  const key = env("EXT_SUPABASE_PUBLISHABLE_KEY");
  return createClient(env("EXT_SUPABASE_URL"), key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: supabaseFetch(key),
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

// Cliente service role — ignora RLS. Apenas operações privilegiadas.
export function extAdmin(): SupabaseClient {
  const key = env("EXT_SUPABASE_SERVICE_ROLE_KEY");
  return createClient(env("EXT_SUPABASE_URL"), key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: supabaseFetch(key) },
  });
}

export type Perms = {
  isAdmin: boolean;
  isEditor: boolean;
  managerSchools: string[];
  operatorSchools: string[];
  roles: { role: string; school_id: string | null }[];
};

// Lê os papéis do usuário usando o cliente dele (RLS permite ver os próprios papéis).
export async function getPerms(
  supabase: SupabaseClient,
  userId: string,
): Promise<Perms> {
  const { data } = await supabase
    .from("user_roles")
    .select("role, school_id")
    .eq("user_id", userId);
  const rows = (data ?? []) as { role: string; school_id: string | null }[];
  return {
    isAdmin: rows.some((r) => r.role === "admin"),
    isEditor: rows.some((r) => r.role === "submission_editor"),
    managerSchools: rows
      .filter((r) => r.role === "school_manager" && r.school_id)
      .map((r) => r.school_id as string),
    operatorSchools: rows
      .filter((r) => r.role === "print_operator" && r.school_id)
      .map((r) => r.school_id as string),
    roles: rows,
  };
}
