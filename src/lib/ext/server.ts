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
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
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

// Garante o campo interno "Quantidade de crianças" do formulário e devolve seu id.
export async function ensureChildrenCountField(
  supabase: SupabaseClient,
  formId: string,
): Promise<string | null> {
  const { CHILDREN_COUNT_LABEL } = await import("./model");
  const { data: existing } = await supabase
    .from("form_fields")
    .select("id")
    .eq("form_id", formId)
    .eq("internal", true)
    .eq("label", CHILDREN_COUNT_LABEL)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: last } = await supabase
    .from("form_fields")
    .select("position")
    .eq("form_id", formId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("form_fields")
    .insert({
      form_id: formId,
      label: CHILDREN_COUNT_LABEL,
      type: "number",
      required: false,
      internal: true,
      position: ((last?.position as number | undefined) ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error) return null;
  return (created?.id as string) ?? null;
}

// Grava a quantidade de crianças como resposta do cadastro.
export async function writeChildrenCountValue(
  supabase: SupabaseClient,
  formId: string,
  submissionId: string,
  count: number | null,
): Promise<void> {
  const fieldId = await ensureChildrenCountField(supabase, formId);
  if (!fieldId) return;
  await supabase.from("submission_values").upsert(
    {
      submission_id: submissionId,
      field_id: fieldId,
      value: count == null ? "" : String(count),
      value_number: count,
    },
    { onConflict: "submission_id,field_id" },
  );
}

export type Perms = {
  isAdmin: boolean;
  isEditor: boolean;
  infoSchools: string[];
  managerSchools: string[];
  operatorSchools: string[];
  roles: { role: string; school_id: string | null }[];
};

// Lê os papéis do usuário usando o cliente dele (RLS permite ver os próprios papéis).
export async function getPerms(supabase: SupabaseClient, userId: string): Promise<Perms> {
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
    infoSchools: rows
      .filter((r) => r.role === "info_center" && r.school_id)
      .map((r) => r.school_id as string),
    operatorSchools: rows
      .filter((r) => r.role === "print_operator" && r.school_id)
      .map((r) => r.school_id as string),
    roles: rows,
  };
}
