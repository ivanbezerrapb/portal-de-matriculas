import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChevronDown, ClipboardCheck, ClipboardList, School, Users } from "lucide-react";
import { useState } from "react";
import { getDashboardStats } from "@/lib/ext/cadastros.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import { Button, Card, Spinner } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

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
    <Card className="p-4">
      <p className="text-xs font-semibold text-primary">{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total de visitas</p>
            <p className="font-display text-xl font-semibold text-foreground">
              {visits === null ? "—" : visits}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total de crianças</p>
            <p className="font-display text-xl font-semibold text-foreground">
              {children === null ? "—" : children}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

type IndicatorDatum = { label: string; count: number };

function SeriesChart({ data }: { data: IndicatorDatum[] }) {
  const labelWidth = Math.min(
    220,
    Math.max(112, Math.max(...data.map((item) => item.label.length), 0) * 7),
  );

  return (
    <Card className="min-w-0 p-4">
      <h2 className="font-display text-sm font-semibold text-foreground">Série de interesse</h2>
      {data.length === 0 ? (
        <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
          Nenhuma resposta no período.
        </div>
      ) : (
        <ChartContainer
          config={{ count: { label: "Quantidade", color: "var(--primary)" } }}
          className="mt-3 h-52 w-full aspect-auto"
        >
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={labelWidth}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      )}
    </Card>
  );
}

const SOURCE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function SourcesChart({ data }: { data: IndicatorDatum[] }) {
  return (
    <Card className="min-w-0 p-4">
      <h2 className="font-display text-sm font-semibold text-foreground">Como conheceu a escola</h2>
      {data.length === 0 ? (
        <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
          Nenhuma resposta no período.
        </div>
      ) : (
        <div className="mt-3 grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)]">
          <ChartContainer
            config={{ count: { label: "Quantidade" } }}
            className="mx-auto h-56 w-full max-w-md aspect-auto"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                innerRadius={48}
                outerRadius={88}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((item, index) => (
                  <Cell key={item.label} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
            {data.map((item, index) => (
              <li key={item.label} className="flex min-w-0 items-center gap-2 text-sm">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: SOURCE_COLORS[index % SOURCE_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 text-foreground">{item.label}</span>
                <span className="font-semibold text-foreground">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
  const schoolLabel =
    selected.length === 0
      ? "Todas as escolas"
      : selected.length === 1
        ? ((schools ?? []).find((school) => school.id === selected[0])?.name ?? "1 escola")
        : `${selected.length} escolas`;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-lg font-semibold text-primary">VISÃO GERAL</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between sm:w-64">
              <span className="truncate">{schoolLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Filtrar escolas</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setSelected([])}>Todas as escolas</DropdownMenuItem>
            <DropdownMenuSeparator />
            {(schools ?? []).map((school) => (
              <DropdownMenuCheckboxItem
                key={school.id as string}
                checked={selected.includes(school.id as string)}
                onCheckedChange={() => toggleSchool(school.id as string)}
                onSelect={(event) => event.preventDefault()}
              >
                {school.name as string}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isLoading || !data ? (
        <div className="mt-8 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
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

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SeriesChart data={data.series} />
            </div>
            <Card className="flex min-h-64 flex-col justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
                  <ClipboardCheck className="h-4 w-4" />
                </div>
                <h2 className="font-display text-sm font-semibold text-foreground">
                  Matrículas efetivadas
                </h2>
              </div>
              <div>
                <p className="font-display text-4xl font-semibold text-foreground">
                  {data.enrollments.total}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.enrollments.percentage.toLocaleString("pt-BR")}% do total de crianças
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${Math.min(data.enrollments.percentage, 100)}%` }}
                />
              </div>
            </Card>
          </div>

          <div className="mt-3">
            <SourcesChart data={data.sources} />
          </div>

          <Card className="mt-3 p-4">
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
