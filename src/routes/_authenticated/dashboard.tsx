import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/ext/cadastros.functions";
import { Card, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-foreground">
        Início
      </h1>

      {isLoading || !data ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Card>
              <p className="text-sm text-muted-foreground">
                Total de cadastros
              </p>
              <p className="font-display mt-1 text-3xl font-bold text-foreground">
                {data.total}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-muted-foreground">Últimos 7 dias</p>
              <p className="font-display mt-1 text-3xl font-bold text-foreground">
                {data.last7days}
              </p>
            </Card>
          </div>

          <Card className="mt-6">
            <h2 className="font-semibold text-foreground">
              Cadastros por escola
            </h2>
            {data.bySchool.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhum cadastro ainda.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {data.bySchool.map((s) => (
                  <li
                    key={s.name}
                    className="flex items-center justify-between py-2 text-sm"
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
