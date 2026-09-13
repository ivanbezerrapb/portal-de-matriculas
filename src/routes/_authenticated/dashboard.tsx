import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, School } from "lucide-react";
import { getDashboardStats } from "@/lib/ext/cadastros.functions";
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

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <p className="text-sm font-semibold text-primary">Visão geral</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-foreground">Início</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acompanhe os cadastros recebidos pelas escolas.</p>
      </div>

      {isLoading || !data ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <>
           <div className="mt-7 grid gap-4 sm:grid-cols-2">
             <Card className="relative overflow-hidden">
               <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary"><ClipboardList className="h-5 w-5" /></div>
               <p className="text-sm font-medium text-muted-foreground">
                Total de cadastros
              </p>
               <p className="mt-1 font-display text-3xl font-semibold text-foreground">
                {data.total}
              </p>
            </Card>
             <Card className="relative overflow-hidden">
               <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary"><CalendarDays className="h-5 w-5" /></div>
               <p className="text-sm font-medium text-muted-foreground">Últimos 7 dias</p>
               <p className="mt-1 font-display text-3xl font-semibold text-foreground">
                {data.last7days}
              </p>
            </Card>
          </div>

          <Card className="mt-6">
             <div className="flex items-center gap-3">
               <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary"><School className="h-4 w-4" /></div>
               <h2 className="font-display font-semibold text-foreground">Cadastros por escola</h2>
             </div>
            {data.bySchool.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhum cadastro ainda.
              </p>
            ) : (
               <ul className="mt-4 divide-y divide-border">
                {data.bySchool.map((s) => (
                  <li
                    key={s.name}
                     className="flex items-center justify-between py-3 text-sm"
                  >
                    <span className="text-foreground">{s.name}</span>
                    <span className="font-semibold text-foreground">
                      {s.count}
                    </span>
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
