// Cliente do Supabase externo para o navegador (com sessão persistida).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let clientPromise: Promise<SupabaseClient> | undefined;

export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = fetch("/api/public/config")
      .then(async (res) => {
        const data = (await res.json()) as {
          url?: string;
          publishableKey?: string;
          error?: string;
        };
        if (!res.ok || !data.url || !data.publishableKey) {
          throw new Error(data.error ?? "Supabase externo não configurado.");
        }
        return createClient(data.url, data.publishableKey, {
          auth: { persistSession: true, autoRefreshToken: true },
        });
      })
      .catch((err) => {
        clientPromise = undefined; // permite tentar de novo
        throw err;
      });
  }
  return clientPromise;
}
