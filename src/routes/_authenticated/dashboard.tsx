import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
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

function SeriesTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const label = payload?.value ?? "";
  const words = label.split(/\s+/);
  const lines = words.reduce<string[]>((result, word) => {
    const last = result[result.length - 1];
    if (!last || `${last} ${word}`.length > 28) result.push(word);
    else result[result.length - 1] = `${last} ${word}`;
    return result;
  }, []);

  return (
    <text x={x - 8} y={y} textAnchor="end" fill="var(--muted-foreground)" fontSize={12}>
      {lines.map((line, index) => (
        <tspan
          key={`${line}-${index}`}
          x={x - 8}
          dy={index === 0 ? `${-(lines.length - 1) * 0.55}em` : "1.1em"}
        >
          {line}
        </tspan>
      ))}
    </text>
  );
}

function SeriesChart({ data }: { data: IndicatorDatum[] }) {
  const labelWidth = Math.min(
    170,
    Math.max(92, Math.max(...data.map((item) => Math.min(item.label.length, 24)), 0) * 6.5),
  );
  const chartHeight = Math.max(208, data.length * 38);

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
          className="mt-3 w-full aspect-auto"
          style={{ height: chartHeight }}
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
              interval={0}
              tick={<SeriesTick />}
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
        <div className="mt-3 grid items-center gap-3">
          <ChartContainer
            config={{ count: { label: "Quantidade" } }}
            className="mx-auto h-40 w-full aspect-auto"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                innerRadius={34}
                outerRadius={62}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((item, index) => (
                  <Cell key={item.label} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
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

type SchoolDatum = { name: string; visits: number; children: number };

function SchoolComparisonChart({ data }: { data: SchoolDatum[] }) {
  return (
    <Card className="min-w-0 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
          <School className="h-4 w-4" />
        </div>
        <h2 className="font-display font-semibold text-foreground">
          Total de cadastros por escola
        </h2>
      </div>
      {data.length === 0 ? (
        <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
          Nenhum cadastro no período.
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Total de visitas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-chart-2" /> Total de crianças
            </span>
          </div>
          <ChartContainer
            config={{
              visits: { label: "Total de visitas", color: "var(--primary)" },
              children: { label: "Total de crianças", color: "var(--chart-2)" },
            }}
            className="mt-2 h-64 w-full aspect-auto"
          >
            <BarChart data={data} margin={{ top: 22, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="visits" fill="var(--color-visits)" radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="visits"
                  position="top"
                  className="fill-foreground"
                  fontSize={11}
                />
              </Bar>
              <Bar dataKey="children" fill="var(--color-children)" radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="children"
                  position="top"
                  className="fill-foreground"
                  fontSize={11}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </>
      )}
    </Card>
  );
}

function LossReasonsChart({ data }: { data: IndicatorDatum[] }) {
  return (
    <Card className="min-w-0 p-4">
      <h2 className="font-display text-sm font-semibold text-foreground">Motivos de perda</h2>
      {data.length === 0 ? (
        <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">
          Nenhuma perda no período.
        </div>
      ) : (
        <div className="mt-2 grid items-center gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(120px,1fr)] lg:grid-cols-1 xl:grid-cols-[minmax(0,0.8fr)_minmax(120px,1fr)]">
          <ChartContainer
            config={{ count: { label: "Quantidade" } }}
            className="mx-auto h-36 w-full aspect-auto"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                innerRadius={30}
                outerRadius={54}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((item, index) => (
                  <Cell key={item.label} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="grid gap-1.5">
            {data.map((item, index) => (
              <li key={item.label} className="flex min-w-0 items-start gap-2 text-xs">
                <span
                  className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm"
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
              label={`${currentYear} (${currentYear - 1})`}
              visits={data.visits}
              children={data.children}
            />
            <YearCard
              label={`${currentYear - 1} (${currentYear - 2})`}
              visits={null}
              children={null}
            />
            <YearCard
              label={`${currentYear - 2} (${currentYear - 3})`}
              visits={null}
              children={null}
            />
          </div>

          <div className="mt-3">
            <SchoolComparisonChart data={data.bySchool} />
          </div>

          <div className="mt-3 grid items-start gap-3 lg:grid-cols-3">
            <SourcesChart data={data.sources} />
            <SeriesChart data={data.series} />
            <div className="grid content-start gap-3">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
                    <ClipboardCheck className="h-4 w-4" />
                  </div>
                  <h2 className="font-display text-sm font-semibold text-foreground">
                    Matrículas efetivadas
                  </h2>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="font-display text-3xl font-semibold text-foreground">
                      {data.enrollments.total}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.enrollments.percentage.toLocaleString("pt-BR")}% do total de crianças
                    </p>
                  </div>
                  <div className="mb-1 h-2 w-24 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${Math.min(data.enrollments.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </Card>
              <LossReasonsChart data={data.lossReasons} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
