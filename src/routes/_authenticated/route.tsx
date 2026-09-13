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
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { useState } from "react";
import { getSupabase } from "@/lib/ext/browser";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import { Spinner } from "@/components/ui";
import { Button } from "@/components/ui";
import logoAsset from "@/assets/grupo-inter-logo.png.asset.json";

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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const activeItem = navItems.find(({ to }) => pathname.startsWith(to));

  return (
    <div className="flex min-h-screen w-full bg-background">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-foreground/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:h-screen ${collapsed ? "w-[72px]" : "w-64"} ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex h-20 items-center justify-between border-b border-sidebar-border px-4">
          <div
            className={`flex min-w-0 items-center overflow-hidden rounded-lg bg-card ${collapsed ? "h-10 w-10 justify-center p-1.5" : "w-44 px-3 py-2"}`}
          >
            <img
              src={logoAsset.url}
              alt="Grupo Inter"
              className={
                collapsed
                  ? "h-auto w-28 max-w-none object-contain object-left"
                  : "h-auto w-full"
              }
            />
          </div>
          <Button
            variant="ghost"
            className="h-9 w-9 shrink-0 p-0 text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 px-3 py-5" aria-label="Navegação principal">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={`mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
                title={collapsed ? label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border px-3 py-4">
          {perms ? (
            <div className={collapsed ? "sr-only" : "px-2"}>
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                {perms.fullName || perms.email}
              </p>
              <p className="mt-0.5 text-xs text-sidebar-foreground/60">
                {perms.isAdmin
                  ? "Administrador"
                  : perms.isEditor
                    ? "Editor de cadastros"
                    : perms.managerSchools.length > 0
                      ? "Gestor de escola"
                      : "Operador de impressão"}
              </p>
            </div>
          ) : (
            <Spinner className="h-4 w-4" />
          )}
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className={`mt-3 w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground ${collapsed ? "px-0" : "justify-start"}`}
            title={collapsed ? "Sair" : undefined}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Sair"}
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              className="h-10 w-10 shrink-0 p-0 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              className="hidden h-10 w-10 shrink-0 p-0 lg:inline-flex"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </Button>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-foreground">
                {activeItem?.label ?? "Grupo Inter"}
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Gestão de formulários escolares
              </p>
            </div>
          </div>
        </header>
        <main className="min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
