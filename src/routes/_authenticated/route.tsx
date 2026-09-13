import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  School,
  Users,
  FileText,
  LayoutTemplate,
} from "lucide-react";
import { getSupabase } from "@/lib/ext/browser";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import { Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: perms } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => getMyPermissions(),
    staleTime: 60_000,
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    const supabase = await getSupabase();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const navItems = [
    { to: "/dashboard", label: "Início", icon: LayoutDashboard, show: true },
    {
      to: "/cadastros",
      label: "Cadastros",
      icon: ClipboardList,
      show: true,
    },
    {
      to: "/formularios",
      label: "Formulários",
      icon: FileText,
      show: perms?.isAdmin ?? false,
    },
    {
      to: "/templates",
      label: "Templates",
      icon: LayoutTemplate,
      show: perms?.isAdmin ?? false,
    },
    {
      to: "/escolas",
      label: "Escolas",
      icon: School,
      show: perms?.isAdmin ?? false,
    },
    {
      to: "/usuarios",
      label: "Usuários",
      icon: Users,
      show: perms?.isAdmin ?? false,
    },
  ].filter((i) => i.show);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <span className="font-display text-base font-bold text-foreground">
            Formulários Escolares
          </span>
        </div>
        <nav className="flex-1 px-3 py-4">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border px-5 py-4">
          {perms ? (
            <>
              <p className="truncate text-sm font-medium text-foreground">
                {perms.fullName || perms.email}
              </p>
              <p className="text-xs text-muted-foreground">
                {perms.isAdmin
                  ? "Administrador"
                  : perms.isEditor
                    ? "Editor de cadastros"
                    : perms.managerSchools.length > 0
                      ? "Gestor de escola"
                      : "Operador de impressão"}
              </p>
            </>
          ) : (
            <Spinner className="h-4 w-4" />
          )}
          <button
            onClick={handleSignOut}
            className="mt-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
