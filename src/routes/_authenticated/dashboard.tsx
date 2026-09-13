import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { School, Users, ClipboardList } from "lucide-react";
import { useState } from "react";
import { getDashboardStats } from "@/lib/ext/cadastros.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import { Card, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Início — Grupo Inter" },
      { name: "description", content: "Resumo dos cadastros escolares do Grupo Inter." },
      { property: "og:title", content: "Início — Grupo Inter" },
      { property: "og:description", content: "Resumo dos cadastros escolares do Grupo Inter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function YearCard({
  label,
  visits,
  children,
}: {
  label: string;
  visits: number | null;
  children: number | null;
}) {
  return (
    <Card>
      <p className="text-sm font-semibold text-primary">{label}</p>
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total de visitas</p>
            <p className="font-display text-2xl font-semibold text-foreground">
              {visits === null ? "—" : visits}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total de crianças</p>
            <p className="font-display text-2xl font-semibold text-foreground">
              {children === null ? "—" : children}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function DashboardPage() {
  const [selected, setSelected] = useState<string[]>([]);

  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: () => listSchools(),
    staleTime: 300_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats", selected],
    queryFn: () => getDashboardStats({ data: { schoolIds: selected } }),
  });

  function toggleSchool(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  const currentYear = data?.year ?? new Date().getFullYear();

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <p className="text-sm font-semibold text-primary">Visão geral</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-foreground">Início</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe as visitas recebidas pelas escolas.
        </p>
      </div>

      <Card className="mt-6">
        <p className="text-sm font-medium text-foreground">Escolas</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelected([])}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              selected.length === 0
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            Todas
          </button>
          {(schools ?? []).map((s) => {
            const active = selected.includes(s.id as string);
            return (
              <button
                key={s.id as string}
                type="button"
                onClick={() => toggleSchool(s.id as string)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {s.name as string}
              </button>
            );
          })}
        </div>
      </Card>

      {isLoading || !data ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <YearCard
              label={`${currentYear + 1} (${currentYear})`}
              visits={data.visits}
              children={data.children}
            />
            <YearCard label={`${currentYear} (${currentYear - 1})`} visits={null} children={null} />
            <YearCard
              label={`${currentYear - 1} (${currentYear - 2})`}
              visits={null}
              children={null}
            />
          </div>

          <Card className="mt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
                <School className="h-4 w-4" />
              </div>
              <h2 className="font-display font-semibold text-foreground">Cadastros por escola</h2>
            </div>
            {data.bySchool.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhum cadastro ainda.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {data.bySchool.map((s) => (
                  <li key={s.name} className="flex items-center justify-between py-3 text-sm">
                    <span className="text-foreground">{s.name}</span>
                    <span className="font-semibold text-foreground">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
