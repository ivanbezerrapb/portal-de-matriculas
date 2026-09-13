import { createMiddleware } from "@tanstack/react-start";
import { getSupabase } from "./browser";

// Anexa o bearer token da sessão a todas as chamadas de server function.
export const attachExtSupabaseAuth = createMiddleware({
  type: "function",
}).client(async ({ next }) => {
  const supabase = await getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return next(token ? { headers: { Authorization: `Bearer ${token}` } } : {});
});
