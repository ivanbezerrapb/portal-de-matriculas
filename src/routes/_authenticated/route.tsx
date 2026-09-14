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
  ChevronDown,
  ClipboardList,
  Filter,
  Kanban,
  ListTodo,
  Settings,
  LayoutDashboard,
  Trophy,
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
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/ext/browser";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import { Spinner } from "@/components/ui";
import { Button } from "@/components/ui";
import whiteLogoAsset from "@/assets/grupo-inter-logo-branca.png.asset.json";
import symbolAsset from "@/assets/grupo-inter-simbolo.png.asset.json";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
  errorComponent: () => <SessionExpired />,
});

function SessionExpired() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/auth", replace: true });
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner />
    </div>
  );
}

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: perms, error: permsError } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => getMyPermissions(),
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (permsError) navigate({ to: "/auth", replace: true });
  }, [permsError, navigate]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    const supabase = await getSupabase();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  type NavLeaf = { to: string; label: string; icon: typeof LayoutDashboard };
  type NavGroup = {
    key: string;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: string;
    children: NavLeaf[];
  };
  type NavEntry = NavLeaf | NavGroup;

  const isAdmin = perms?.isAdmin ?? false;
  const isManager = (perms?.managerSchools.length ?? 0) > 0;
  const isInfo = (perms?.infoSchools.length ?? 0) > 0;
  const isSecretary = !isAdmin && !isManager && !isInfo;

  const roleLabel = isAdmin
    ? "Administrador"
    : isManager
      ? "Gerente"
      : isInfo
        ? "Central de Informações"
        : "Secretaria";

  // Cada perfil enxerga apenas as telas que pode usar.
  const navEntries: NavEntry[] = [
    ...(isAdmin || isManager
      ? [{ to: "/dashboard", label: "Início", icon: LayoutDashboard } as NavLeaf]
      : []),
    ...(isAdmin || isManager || isSecretary
      ? [
          {
            key: "cadastros",
            label: "Cadastros",
            icon: ClipboardList,
            children: [{ to: "/cadastros", label: "Lista de cadastros", icon: ClipboardList }],
          } as NavGroup,
        ]
      : []),
    ...(isAdmin || isInfo
      ? [
          {
            key: "crm",
            label: "CRM",
            icon: Kanban,
            children: [
              { to: "/crm/pipeline", label: "Pipeline", icon: Kanban },
              ...(isAdmin
                ? [
                    { to: "/crm/funil", label: "Funil", icon: Filter },
                    { to: "/crm/tarefas", label: "Tarefas", icon: ListTodo },
                    { to: "/crm/motivos", label: "Motivos", icon: Trophy },
                  ]
                : [{ to: "/crm/tarefas", label: "Tarefas", icon: ListTodo }]),
            ],
          } as NavGroup,
        ]
      : []),
    ...(isAdmin
      ? [
          {
            key: "config",
            label: "Configurações",
            icon: Settings,
            children: [
              { to: "/formularios", label: "Formulários", icon: FileText },
              { to: "/templates", label: "Templates", icon: LayoutTemplate },
              { to: "/escolas", label: "Escolas", icon: School },
              { to: "/usuarios", label: "Usuários", icon: Users },
            ],
          } as NavGroup,
        ]
      : []),
  ];

  const isGroup = (entry: NavEntry): entry is NavGroup => "children" in entry;

  // Endereço fora do perfil: leva para a primeira tela permitida.
  const allowedPaths = navEntries.flatMap((e) =>
    isGroup(e) ? e.children.map((c) => c.to) : [e.to],
  );
  const firstAllowed = allowedPaths[0];
  useEffect(() => {
    if (!perms || !firstAllowed) return;
    if (!allowedPaths.some((p) => pathname.startsWith(p))) {
      navigate({ to: firstAllowed, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perms, pathname, firstAllowed]);

  const openGroups = navEntries
    .filter(isGroup)
    .filter((g) => g.children.some((c) => pathname.startsWith(c.to)))
    .map((g) => g.key);

  const [manualGroups, setManualGroups] = useState<Record<string, boolean>>({});
  const groupIsOpen = (key: string) => manualGroups[key] ?? openGroups.includes(key);

  function toggleGroup(key: string) {
    if (collapsed) setCollapsed(false);
    setManualGroups((prev) => ({ ...prev, [key]: !groupIsOpen(key) }));
  }

  let breadcrumb = "Grupo Inter";
  for (const entry of navEntries) {
    if (isGroup(entry)) {
      const child = entry.children.find((c) => pathname.startsWith(c.to));
      if (child) breadcrumb = `${entry.label} › ${child.label}`;
    } else if (pathname.startsWith(entry.to)) {
      breadcrumb = entry.label;
    }
  }

  const leafClass = (active: boolean) =>
    `mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-sidebar-primary text-sidebar-primary-foreground"
        : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    }`;

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
            className={`flex min-w-0 items-center overflow-hidden ${collapsed ? "h-11 w-11 justify-center rounded-md bg-card p-1" : "w-48"}`}
          >
            <img
              src={collapsed ? symbolAsset.url : whiteLogoAsset.url}
              alt="Grupo Inter"
              className={
                collapsed ? "h-full w-full object-contain" : "h-auto w-full object-contain"
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
        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Navegação principal">
          {navEntries.map((entry) => {
            if (!isGroup(entry)) {
              const Icon = entry.icon;
              const active = pathname.startsWith(entry.to);
              return (
                <Link
                  key={entry.to}
                  to={entry.to}
                  onClick={() => setMobileOpen(false)}
                  className={leafClass(active)}
                  title={collapsed ? entry.label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{entry.label}</span>}
                </Link>
              );
            }

            const Icon = entry.icon;
            const open = groupIsOpen(entry.key);
            const hasActiveChild = entry.children.some((c) => pathname.startsWith(c.to));
            return (
              <div key={entry.key} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(entry.key)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    hasActiveChild
                      ? "text-sidebar-foreground"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                  title={collapsed ? entry.label : undefined}
                  aria-expanded={open}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{entry.label}</span>
                      {entry.badge && (
                        <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sidebar-accent-foreground">
                          {entry.badge}
                        </span>
                      )}
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                      />
                    </>
                  )}
                </button>
                {!collapsed && open && (
                  <div className="mt-1 ml-4 border-l border-sidebar-border pl-3">
                    {entry.children.map((child) => {
                      const ChildIcon = child.icon;
                      const active = pathname.startsWith(child.to);
                      return (
                        <Link
                          key={child.to}
                          to={child.to}
                          onClick={() => setMobileOpen(false)}
                          className={leafClass(active)}
                        >
                          <ChildIcon className="h-4 w-4 shrink-0" />
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border px-3 py-4">
          {perms ? (
            <div className={collapsed ? "sr-only" : "px-2"}>
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                {perms.fullName || perms.email}
              </p>
              <p className="mt-0.5 text-xs text-sidebar-foreground/60">{roleLabel}</p>
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
                {breadcrumb}
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
