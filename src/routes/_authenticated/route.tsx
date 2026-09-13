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

  const navEntries: NavEntry[] = [
    { to: "/dashboard", label: "Início", icon: LayoutDashboard },
    { to: "/cadastros", label: "Cadastros", icon: ClipboardList },
    {
      key: "crm",
      label: "CRM",
      icon: Kanban,
      badge: "Em breve",
      children: [
        { to: "/crm/pipeline", label: "Pipeline", icon: Kanban },
        { to: "/crm/funil", label: "Funil", icon: Filter },
      ],
    },
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
