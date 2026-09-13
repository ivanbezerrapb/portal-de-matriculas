import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSupabase } from "@/lib/ext/browser";

// Entrada do app: sem landing page — manda para o painel se logado,
// senão para a tela de login.
export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const supabase = await getSupabase();
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
