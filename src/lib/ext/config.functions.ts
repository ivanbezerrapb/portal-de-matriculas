import { createServerFn } from "@tanstack/react-start";

// Retorna a config pública (URL + chave publishable) do Supabase externo.
// A chave publishable é segura para exposição no navegador.
export const getPublicSupabaseConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const url = process.env["EXT_SUPABASE_URL"];
    const publishableKey = process.env["EXT_SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !publishableKey) {
      throw new Error("Supabase externo não configurado.");
    }
    return { url, publishableKey };
  },
);
