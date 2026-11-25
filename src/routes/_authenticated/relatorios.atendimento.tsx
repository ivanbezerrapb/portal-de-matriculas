import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Clock, Printer } from "lucide-react";
import { Button, Card, Input, Label, Select, Spinner } from "@/components/ui";
import { attendanceReport, reportOptions } from "@/lib/ext/relatorios.functions";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import { totalsByAttendant } from "@/lib/ext/relatorios-logic";
import { ReportPrint, SmallTable, printNow } from "@/components/print/ReportPrint";
import { compareSchoolNames } from "@/lib/school-order";
import { describeCardFreshness, type FreshnessLevel } from "@/lib/ext/card-freshness";

export const Route = createFileRoute("/_authenticated/relatorios/atendimento")({
  head: () => ({
    meta: [
      { title: "Relatório de Atendimento — Grupo Inter" },
      { name: "description", content: "Cartões do CRM por escola, atendente e funil, com pendências e tarefas atrasadas." },
      { property: "og:title", content: "Relatório de Atendimento — Grupo Inter" },
      { property: "og:description", content: "Atendimentos do CRM com totais por atendente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AtendimentoPage,
});

const STATUS = { open: "Aberto", won: "Ganho", lost: "Perdido" } as const;
const br = (d: string) => d.split("-").reverse().join("/");
type Situation = Exclude<FreshnessLevel, "neutral">;
const SITUATIONS: { level: Situation; label: string; range: string; style: string }[] = [
  { level: "fresh", label: "Em dia", range: "Até 2 dias", style: "border-success/30 bg-success/10 text-success-foreground" },
  { level: "warning", label: "Em atenção", range: "3 a 5 dias", style: "border-warning/30 bg-warning/10 text-warning-foreground" },
  { level: "stale", label: "Críticos / Parados", range: "Mais de 5 dias", style: "border-destructive/30 bg-destructive/10 text-destructive" },
];
const BADGE_STYLE: Record<FreshnessLevel, string> = {
  fresh: "bg-success/10 text-success-foreground", warning: "bg-warning/10 text-warning-foreground",
  stale: "bg-destructive/10 text-destructive", neutral: "bg-muted text-muted-foreground",
};
const numberBR = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function AtendimentoPage() {
  const [schoolId, setSchoolId] = useState("");
  const [attendant, setAttendant] = useState("");
  const [funnelId, setFunnelId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [printAt, setPrintAt] = useState<string | null>(null);
  const [situation, setSituation] = useState<Situation | null>(null);
  const [updateOrder, setUpdateOrder] = useState<"asc" | "desc" | null>(null);
  const { data: perms } = useQuery({ queryKey: ["my-permissions"], queryFn: () => getMyPermissions() });
  const { data: opts } = useQuery({ queryKey: ["report-options"], queryFn: () => reportOptions() });
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["report-attendance", schoolId, from, to],
    queryFn: () => attendanceReport({ data: { school_id: schoolId || undefined, from: from || undefined, to: to || undefined } }),
    refetchInterval: 30_000,
    refetchOnMount: "always",
  });
  const schools = [...(opts?.schools ?? [])].sort((a, b) => compareSchoolNames(a.name, b.name));
  const funnels = (opts?.funnels ?? []).filter((f) => !schoolId || f.school_id === schoolId);
  const attendants = [...new Set(all.map((r) => r.attendant || "Sem atendente"))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const now = Date.now();
  const baseRows = all.filter((r) =>
    (!attendant || (r.attendant || "Sem atendente") === attendant) &&
    (!funnelId || r.funnel_id === funnelId) &&
    (!onlyPending || r.restricted) && (!onlyOverdue || r.overdue > 0))
    .map((r) => ({ ...r, freshness: describeCardFreshness(r.last_updated_at, { now, status: r.status }) }));
  const openRows = baseRows.filter((r) => r.status === "open");
  const counts = { fresh: 0, warning: 0, stale: 0 };
  for (const r of openRows) if (r.freshness && r.freshness.level !== "neutral") counts[r.freshness.level]++;
  const elapsed = openRows.map((r) => Date.parse(r.last_updated_at)).filter(Number.isFinite).map((ms) => Math.max(0, now - ms));
  const averageDays = elapsed.length ? elapsed.reduce((sum, ms) => sum + ms, 0) / elapsed.length / 86_400_000 : null;
  const average = averageDays === null ? "—" : averageDays < 1 ? `${numberBR(averageDays * 24)} h` : `${numberBR(averageDays)} dias`;
  const rows = baseRows.filter((r) => !situation || (r.status === "open" && r.freshness?.level === situation));
  if (updateOrder) rows.sort((a, b) => {
    const aMs = Date.parse(a.last_updated_at);
    const bMs = Date.parse(b.last_updated_at);
    if (!Number.isFinite(aMs)) return Number.isFinite(bMs) ? 1 : 0;
    if (!Number.isFinite(bMs)) return -1;
    return updateOrder === "asc" ? aMs - bMs : bMs - aMs;
  });
  const totals = totalsByAttendant(baseRows);
  const staleByAttendant = new Map<string, number>();
  for (const r of openRows) if (r.freshness?.level === "stale") {
    const name = r.attendant || "Sem atendente";
    staleByAttendant.set(name, (staleByAttendant.get(name) ?? 0) + 1);
  }
  const schoolLabel = schoolId ? schools.find((s) => s.id === schoolId)?.name ?? "" : [...new Set(rows.map((r) => r.school))].sort(compareSchoolNames).join(" · ") || "Todas as escolas";
  const filters = [
    schoolId && `Escola: ${schoolLabel}`, attendant && `Atendente: ${attendant}`,
    funnelId && `Funil: ${funnels.find((f) => f.id === funnelId)?.name ?? ""}`,
    from && `De: ${br(from)}`, to && `Até: ${br(to)}`,
    onlyPending && "Só com pendências", onlyOverdue && "Só com tarefas atrasadas",
    situation && `Atualização: ${SITUATIONS.find((s) => s.level === situation)?.label}`,
    updateOrder && `Última atualização: ${updateOrder === "asc" ? "mais antiga primeiro" : "mais recente primeiro"}`,
  ].filter(Boolean) as string[];
  const summary = `${rows.length} cartão${rows.length === 1 ? "" : "es"}`;
  const totalRows = totals.map((t) => [t.attendant, t.cards, t.open, t.won, t.lost, t.pending, t.overdue, staleByAttendant.get(t.attendant) ?? 0]);
  const totalCols = ["Atendente", "Cartões", "Abertos", "Ganhos", "Perdidos", "Com pendência", "Com tarefa atrasada", "Parados (> 5 dias)"];
  const metricRows = SITUATIONS.map((s) => [s.label, counts[s.level], `${numberBR(openRows.length ? counts[s.level] / openRows.length * 100 : 0)}%`]);

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Relatório de Atendimento</h1>
          <p className="text-sm text-muted-foreground">{schoolLabel}</p>
        </div>
        <Button variant="outline" disabled={isLoading || rows.length === 0}
          onClick={() => { setPrintAt(new Date().toLocaleString("pt-BR")); printNow(); }}>
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
      </div>

      <Card className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div><Label htmlFor="a-school">Escola</Label>
            <Select id="a-school" value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setFunnelId(""); }}>
              <option value="">Todas</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select></div>
          <div><Label htmlFor="a-att">Atendente</Label>
            <Select id="a-att" value={attendant} onChange={(e) => setAttendant(e.target.value)}>
              <option value="">Todos</option>{attendants.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select></div>
          <div><Label htmlFor="a-funnel">Funil</Label>
            <Select id="a-funnel" value={funnelId} onChange={(e) => setFunnelId(e.target.value)}>
              <option value="">Todos</option>{funnels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select></div>
          <div><Label htmlFor="a-from">Criado de</Label><Input id="a-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label htmlFor="a-to">Até</Label><Input id="a-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> Só com pendências</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} /> Só com tarefas atrasadas</label>
        </div>
      </Card>

      {isLoading ? <div className="mt-8 flex justify-center"><Spinner /></div> : (
        <>
          <Card className="mt-6 overflow-x-auto">
            <h2 className="mb-2 font-semibold text-foreground">Totais por atendente</h2>
            <table aria-label="Totais por atendente" className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground">{totalCols.map((c) => <th key={c} className="py-2 pr-3">{c}</th>)}</tr></thead>
              <tbody>{totalRows.map((r) => <tr key={String(r[0])} className="border-b border-border">{r.map((c, i) => <td key={i} className="py-2 pr-3">{c}</td>)}</tr>)}</tbody>
            </table>
          </Card>
          <section aria-labelledby="updates-title" className="mt-6 border-y border-border py-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 id="updates-title" className="font-semibold text-foreground">Atualizações dos cartões</h2>
              <span className="text-sm text-muted-foreground">{openRows.length} cartões em aberto</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {SITUATIONS.map((s) => (
                <Button key={s.level} variant="outline" aria-pressed={situation === s.level}
                  onClick={() => setSituation(situation === s.level ? null : s.level)}
                  className={`min-h-36 w-full flex-col items-start justify-between whitespace-normal border p-4 text-left ${s.style} ${situation === s.level ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""}`}>
                  <span className="flex w-full items-center justify-between gap-2"><span>{s.label}</span><Clock aria-hidden="true" className="h-4 w-4 shrink-0" /></span>
                  <span className="flex w-full items-baseline justify-between gap-2"><span className="text-3xl font-bold">{counts[s.level]}</span><span className="text-sm">{numberBR(openRows.length ? counts[s.level] / openRows.length * 100 : 0)}%</span></span>
                  <span className="text-xs font-normal">{s.range}</span>
                </Button>
              ))}
              <div data-testid="average-update" className="flex min-h-36 flex-col justify-between rounded-lg border border-border bg-muted/30 p-4 text-foreground">
                <span className="flex items-center justify-between gap-2 text-sm font-semibold">Média sem atualização<Clock aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" /></span>
                <span className="text-3xl font-bold">{average}</span>
                <span className="text-xs text-muted-foreground">Cartões em aberto</span>
              </div>
            </div>
            {situation && <Button variant="ghost" className="mt-3" onClick={() => setSituation(null)}>Limpar filtro de atualização</Button>}
          </section>
          <Card className="mt-6 overflow-x-auto">
            <p className="mb-2 text-sm text-muted-foreground">{summary}</p>
            <table aria-label="Cartões" className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3">Cliente</th><th className="pr-3">Escola</th><th className="pr-3">Funil</th><th className="pr-3">Etapa</th><th className="pr-3">Atendente</th><th className="pr-3">Status</th><th className="pr-3">Pendência</th><th>Tarefas atrasadas</th>
                <th aria-sort={updateOrder === "asc" ? "ascending" : updateOrder === "desc" ? "descending" : "none"}>
                  <Button variant="ghost" className="text-left" onClick={() => setUpdateOrder(updateOrder === "asc" ? "desc" : "asc")}>
                    Última atualização {updateOrder === "desc" ? <ArrowUp aria-hidden="true" className="h-4 w-4 shrink-0" /> : <ArrowDown aria-hidden="true" className="h-4 w-4 shrink-0" />}
                  </Button>
                </th>
              </tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id} className="border-b border-border">
                  <td className="py-2 pr-3">{r.client}</td><td className="pr-3">{r.school}</td><td className="pr-3">{r.funnel}</td><td className="pr-3">{r.stage}</td>
                  <td className="pr-3">{r.attendant || "—"}</td><td className="pr-3">{STATUS[r.status]}</td>
                  <td className="pr-3">{r.restricted ? <AlertTriangle className="h-4 w-4 text-warning" aria-label="Pendência pedagógica" /> : "—"}</td>
                  <td className={r.overdue ? "font-semibold text-destructive" : ""}>{r.overdue || "—"}</td>
                  <td className="py-2 pl-3">{r.freshness ? <span title={r.freshness.title} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${BADGE_STYLE[r.freshness.level]}`}><Clock aria-hidden="true" className="h-3 w-3 shrink-0" />{r.freshness.label}</span> : "—"}</td>
                </tr>))}</tbody>
            </table>
            {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum cartão encontrado para os filtros selecionados.</p>}
          </Card>
        </>
      )}

      {printAt && (
        <ReportPrint title="Relatório de Atendimento" school={schoolLabel} filters={filters} summary={summary}
          printedBy={perms?.fullName ?? ""} printedAt={printAt}
          extra={<><SmallTable title="Totais por atendente" columns={totalCols} rows={totalRows} /><SmallTable title="Atualizações dos cartões em aberto" columns={["Situação", "Cartões", "Percentual"]} rows={metricRows} /><p>Média sem atualização: {average}</p></>}
          columns={["Cliente", "Escola", "Funil", "Etapa", "Atendente", "Status", "Pendência", "Tarefas atrasadas", "Última atualização"]}
          rows={rows.map((r) => [r.client, r.school, r.funnel, r.stage, r.attendant, STATUS[r.status], r.restricted ? "Sim" : "", r.overdue || "", r.freshness?.title ?? ""])} />
      )}
    </div>
  );
}
