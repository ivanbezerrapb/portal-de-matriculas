// Cliente do Supabase externo para o navegador (com sessão persistida).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "./config.functions";

let clientPromise: Promise<SupabaseClient> | undefined;

export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = getPublicSupabaseConfig().then(({ url, publishableKey }) =>
      createClient(url, publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      }),
    );
  }
  return clientPromise;
}
