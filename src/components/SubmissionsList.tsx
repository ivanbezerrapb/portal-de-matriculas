import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Eye } from "lucide-react";
import { PrintSheets, type PrintSheetsState } from "@/components/print/PrintSheets";
import { formatAddress, parseAddress, parseChildren, type FormField } from "@/lib/ext/model";
import {
  getSubmission,
  listSubmissions,
  sendSubmissionToFunnel,
  setEnrollment,
  setLeadCheckIn,
} from "@/lib/ext/cadastros.functions";
import { listFunnelOwners, listFunnels } from "@/lib/ext/funis.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import { listForms } from "@/lib/ext/formularios.functions";
import { listPrintTemplates } from "@/lib/ext/impressao.functions";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import { Button, Card, EmptyState, Input, Label, Select, Spinner } from "@/components/ui";

export type SubmissionsListType = "visitantes" | "leads";

export function SubmissionsList({
  listType = "visitantes",
  title = "Lista de Visitantes",
}: {
  listType?: SubmissionsListType;
  title?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [formId, setFormId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printTemplateId, setPrintTemplateId] = useState("");
  const [picker, setPicker] = useState<{
    submissionId: string;
    formId: string;
  } | null>(null);
  const [printJob, setPrintJob] = useState<{
    templateId: string;
    submissionId: string;
  } | null>(null);
  const [enrollmentDialog, setEnrollmentDialog] = useState<{
    id: string;
    publicId: string;
    childrenCount: number | null;
    schoolId: string;
  } | null>(null);
  const [enrollmentCount, setEnrollmentCount] = useState("1");
  const [checkInDialog, setCheckInDialog] = useState<{ id: string; publicId: string } | null>(null);
  const [funnelDialog, setFunnelDialog] = useState<{
    submissionId: string;
    publicId: string;
    funnelId: string;
    funnelName: string;
    owners: { userId: string; name: string }[];
  } | null>(null);
  const [funnelAttendant, setFunnelAttendant] = useState("");
  const [restrictedConfirm, setRestrictedConfirm] = useState<{
    submission: { id: string; public_id: string };
    funnelId: string;
    funnelName: string;
  } | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const { data: perms } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => getMyPermissions(),
  });
  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: () => listSchools(),
  });
  const { data: forms } = useQuery({
    queryKey: ["admin-forms"],
    queryFn: () => listForms(),
  });

  const { data: funnelsData } = useQuery({
    queryKey: ["funnels"],
    queryFn: () => listFunnels(),
  });

  const { data: funnelOwners } = useQuery({
    queryKey: ["funnel-owners"],
    queryFn: () => listFunnelOwners(),
  });

  const filters = {
    list_type: listType,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(schoolId ? { school_id: schoolId } : {}),
    ...(formId ? { form_id: formId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };

  const listForms_ = (forms ?? []).filter(
    (f) => ((f as { list_type?: string }).list_type ?? "visitantes") === listType,
  );

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["submissions", filters],
    queryFn: () => listSubmissions({ data: filters }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  // Modelos de impressão do formulário dos itens selecionados (precisam ser do mesmo formulário)
  const selectedRows = (submissions ?? []).filter((s) => selected.has(s.id));
  const selectedFormIds = new Set(selectedRows.map((s) => s.form_id));
  const singleFormId = selectedFormIds.size === 1 ? [...selectedFormIds][0] : undefined;

  const { data: templates } = useQuery({
    queryKey: ["print-templates", singleFormId],
    queryFn: () => listPrintTemplates({ data: { form_id: singleFormId! } }),
    enabled: !!singleFormId,
  });

  // Todos os modelos acessíveis, para o botão de impressão de cada linha.
  const { data: allTemplates } = useQuery({
    queryKey: ["print-templates-all"],
    queryFn: () => listPrintTemplates({ data: {} }),
  });

  function openPrint(templateId: string, submissionId: string) {
    setPrintJob({ templateId, submissionId });
    setPicker(null);
  }

  const closePrint = useCallback(() => setPrintJob(null), []);
  const handlePrintState = useCallback((state: PrintSheetsState) => {
    if (state.status === "error") {
      toast.error(state.message);
      setPrintJob(null);
    }
  }, []);

  function printRow(submissionId: string, rowFormId: string) {
    const list = (allTemplates ?? []).filter((t) => t.form_id === rowFormId);
    if (list.length === 0) {
      toast.error(
        "Este formulário ainda não tem modelo de impressão. Crie um em Formulários › Modelos de impressão.",
      );
      return;
    }
    const first = list[0];
    if (list.length === 1 && first) {
      openPrint(first.id, submissionId);
      return;
    }
    setPicker({ submissionId, formId: rowFormId });
  }

  const canPrint =
    (perms?.isAdmin ||
      perms?.isDirecao ||
      (perms?.managerSchools.length ?? 0) > 0 ||
      (perms?.operatorSchools.length ?? 0) > 0) ??
    false;

  const canEnroll =
    (perms?.isAdmin ||
      (perms?.managerSchools.length ?? 0) > 0 ||
      (perms?.operatorSchools.length ?? 0) > 0) ??
    false;

  const enrollM = useMutation({
    mutationFn: (d: { id: string; enrolled: boolean; enrollment_count?: number }) =>
      setEnrollment({ data: d }),
    onSuccess: (_r, d) => {
      toast.success(d.enrolled ? "Matrícula registrada." : "Matrícula desfeita.");
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setEnrollmentDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkInM = useMutation({
    mutationFn: (id: string) => setLeadCheckIn({ data: { id } }),
    onSuccess: (result) => {
      toast.success(
        result.opportunity_closed
          ? "Check-in confirmado. O cartão foi ganho e as tarefas foram concluídas."
          : "Check-in confirmado. Este LEAD ainda não possui cartão no CRM.",
      );
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
      setCheckInDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const funnelM = useMutation({
    mutationFn: (d: {
      submission_id: string;
      funnel_id: string;
      attendant_user_id?: string;
      attendant_name?: string;
    }) => sendSubmissionToFunnel({ data: d }),
    onSuccess: () => {
      toast.success("Lead enviado para o funil. Tarefa de 1º contato criada.");
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["presenters"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setFunnelDialog(null);
      setFunnelAttendant("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Ao escolher um funil: responsáveis vinculados definem o Atendimento.
  function pickFunnel(
    submission: { id: string; public_id: string; restricted?: boolean },
    funnelId: string,
    funnelName: string,
    confirmed = false,
  ) {
    if (submission.restricted && !confirmed) {
      setRestrictedConfirm({
        submission: { id: submission.id, public_id: submission.public_id },
        funnelId,
        funnelName,
      });
      return;
    }
    const owners = Array.from(
      new Map(
        (funnelOwners ?? [])
          .filter((o) => o.funnel_id === funnelId)
          .map((o) => [o.user_id, { userId: o.user_id, name: o.name.trim() }]),
      ).values(),
    ).filter((owner) => owner.name);
    if (owners.length === 1 && owners[0]) {
      funnelM.mutate({
        submission_id: submission.id,
        funnel_id: funnelId,
        attendant_user_id: owners[0].userId,
        attendant_name: owners[0].name,
      });
      return;
    }
    if (owners.length === 0) {
      funnelM.mutate({ submission_id: submission.id, funnel_id: funnelId });
      return;
    }
    setFunnelAttendant("");
    setFunnelDialog({
      submissionId: submission.id,
      publicId: submission.public_id,
      funnelId,
      funnelName,
      owners,
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="w-full">
      <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>

      <Card className="mt-6">
        <div
          className={`grid gap-3 sm:grid-cols-2 ${perms?.isAdmin || perms?.isDirecao ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
        >
          <div className="lg:col-span-2">
            <Label htmlFor="q">Buscar por ID</Label>
            <Input
              id="q"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ex.: 0001/ESCA"
            />
          </div>
          {(perms?.isAdmin || perms?.isDirecao) && (
            <div>
              <Label htmlFor="f-school">Escola</Label>
              <Select id="f-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                <option value="">Todas</option>
                {(schools ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="f-form">Formulário</Label>
            <Select id="f-form" value={formId} onChange={(e) => setFormId(e.target.value)}>
              <option value="">Todos</option>
              {listForms_.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="f-from">De</Label>
              <Input
                id="f-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="f-to">Até</Label>
              <Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>
      </Card>

      {selected.size > 0 && (
        <Card className="mt-4 flex flex-wrap items-center gap-3 border-primary/40">
          <p className="text-sm font-medium text-foreground">
            {selected.size} selecionado{selected.size > 1 ? "s" : ""}
          </p>
          {selectedFormIds.size > 1 ? (
            <p className="text-sm text-muted-foreground">
              Para imprimir em lote, selecione cadastros do mesmo formulário.
            </p>
          ) : canPrint ? (
            <>
              <Select
                value={printTemplateId}
                onChange={(e) => setPrintTemplateId(e.target.value)}
                className="w-56"
              >
                <option value="">Modelo de impressão...</option>
                {(templates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Button
                disabled={!printTemplateId}
                onClick={() =>
                  navigate({
                    to: "/imprimir/$templateId",
                    params: { templateId: printTemplateId },
                    search: { ids: [...selected].join(",") },
                  })
                }
              >
                Imprimir selecionados
              </Button>
            </>
          ) : null}
          <Button variant="ghost" onClick={() => setSelected(new Set())}>
            Limpar seleção
          </Button>
        </Card>
      )}

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : !submissions || submissions.length === 0 ? (
        <EmptyState
          title="Nenhum cadastro encontrado"
          description="Ajuste os filtros ou aguarde novos envios pelo link público."
        />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Escola</th>
                {listType === "visitantes" && <th className="px-4 py-3">Crianças</th>}
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Série</th>
                <th className="px-4 py-3">Atendimento</th>
                <th className="px-4 py-3">Funil</th>
                <th className="px-4 py-3">{listType === "leads" ? "Check-in" : "Matrícula"}</th>
                {listType === "leads" && <th className="px-4 py-3">Data do check-in</th>}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => {
                const responsible = (s as unknown as { responsible_name: string | null })
                  .responsible_name;
                const school = s.schools as unknown as { name: string } | null;
                const childrenCount = (s as unknown as { children_count: number | null })
                  .children_count;
                const enrolled = Boolean((s as unknown as { enrolled?: boolean }).enrolled);
                const enrolledCount = Number(
                  (s as unknown as { enrollment_count?: number }).enrollment_count ?? 0,
                );
                const checkIn = (s as unknown as { check_in?: { checked_in_at: string } | null })
                  .check_in;
                return (
                  <tr
                    key={s.id}
                    className="border-b border-border last:border-0 hover:bg-accent/40"
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        className="accent-[var(--color-primary)]"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                        aria-label={`Selecionar ${s.public_id}`}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Link
                          to="/cadastros/$submissionId"
                          params={{ submissionId: s.id }}
                          className="font-mono font-medium text-primary hover:underline"
                        >
                          {s.public_id}
                        </Link>
                        {(s as unknown as { restricted?: boolean }).restricted && (
                          <span
                            title="Atenção: cadastro com acompanhamento médico/psicológico informado"
                            aria-label="Cadastro com restrição"
                            className="inline-flex text-[oklch(0.72_0.18_60)]"
                          >
                            <AlertTriangle size={16} strokeWidth={2} className="shrink-0" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 break-words text-foreground">
                      {responsible ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{school?.name ?? "—"}</td>
                    {listType === "visitantes" && (
                      <td className="px-4 py-2.5 text-muted-foreground">{childrenCount ?? "—"}</td>
                    )}
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {new Date(s.created_at).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {(() => {
                        const series = (s as unknown as { series?: string[] }).series ?? [];
                        const filled = series.filter((x) => x);
                        if (filled.length === 0) return "—";
                        return filled.map((serie, i) => (
                          <div key={i} className="whitespace-nowrap">
                            {serie}
                          </div>
                        ));
                      })()}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="break-words text-muted-foreground">
                        {(s as unknown as { attendant: { name?: string } | null }).attendant
                          ?.name ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {(() => {
                        const current = (
                          s as unknown as {
                            funnel: { funnel_id: string; funnel_name: string } | null;
                          }
                        ).funnel;
                        const options = (funnelsData?.funnels ?? []).filter(
                          (f) => f.school_id === s.school_id,
                        );
                        return (
                          <select
                            className="w-full min-w-32 rounded-md border border-border bg-background px-2 py-1 text-xs"
                            value={current?.funnel_id ?? ""}
                            disabled={!canEnroll || funnelM.isPending}
                            onChange={(e) => {
                              const id = e.target.value;
                              if (!id || id === current?.funnel_id) return;
                              const funnel = options.find((f) => f.id === id);
                              pickFunnel(s, id, funnel?.name ?? "");
                            }}
                            aria-label={`Funil de ${s.public_id}`}
                          >
                            <option value="">—</option>
                            {options.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2.5">
                      {listType === "leads" ? (
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            className="accent-[var(--color-primary)]"
                            checked={Boolean(checkIn)}
                            disabled={!canEnroll || checkInM.isPending || Boolean(checkIn)}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setCheckInDialog({ id: s.id, publicId: s.public_id });
                              }
                            }}
                            aria-label={`Check-in de ${s.public_id}`}
                          />
                          {checkIn ? (
                            <span className="font-medium text-emerald-600">Confirmado</span>
                          ) : null}
                        </label>
                      ) : (
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            className="accent-[var(--color-primary)]"
                            checked={enrolled}
                            disabled={!canEnroll || enrollM.isPending}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEnrollmentCount(String(Math.max(childrenCount ?? 1, 1)));
                                setEnrollmentDialog({
                                  id: s.id,
                                  publicId: s.public_id,
                                  childrenCount,
                                  schoolId: s.school_id,
                                });
                              } else {
                                enrollM.mutate({ id: s.id, enrolled: false });
                              }
                            }}
                            aria-label={`Matrícula de ${s.public_id}`}
                          />
                          {enrolled ? (
                            <span className="font-medium text-emerald-600">
                              Ativo · {enrolledCount}
                            </span>
                          ) : null}
                        </label>
                      )}
                    </td>
                    {listType === "leads" && (
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                        {checkIn
                          ? new Date(checkIn.checked_in_at).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                    )}
                    <td className="px-2 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Visualizar dados preenchidos"
                          aria-label={`Visualizar ${s.public_id}`}
                          onClick={() => setViewId(s.id)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Eye size={18} strokeWidth={1.8} />
                        </button>
                        {canPrint && (
                          <button
                            title="Imprimir este cadastro"
                            aria-label={`Imprimir ${s.public_id}`}
                            onClick={() => printRow(s.id, s.form_id)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <PrinterIcon />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {picker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPicker(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-semibold text-foreground">
              Escolha o modelo de impressão
            </h2>
            <div className="mt-4 flex flex-col gap-2">
              {(allTemplates ?? [])
                .filter((t) => t.form_id === picker.formId)
                .map((t) => (
                  <Button
                    key={t.id}
                    variant="outline"
                    className="justify-start"
                    onClick={() => openPrint(t.id, picker.submissionId)}
                  >
                    {t.name}
                  </Button>
                ))}
            </div>
            <Button variant="ghost" className="mt-4" onClick={() => setPicker(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {enrollmentDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => setEnrollmentDialog(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-lg font-semibold text-foreground">
              Quantas matrículas foram efetivadas?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastro {enrollmentDialog.publicId}
              {enrollmentDialog.childrenCount
                ? ` · ${enrollmentDialog.childrenCount} criança${enrollmentDialog.childrenCount > 1 ? "s" : ""} informada${enrollmentDialog.childrenCount > 1 ? "s" : ""}`
                : ""}
            </p>
            <div className="mt-4">
              <Label htmlFor="enrollment-count">Quantidade</Label>
              <Input
                id="enrollment-count"
                type="number"
                min={1}
                step={1}
                value={enrollmentCount}
                onChange={(event) => setEnrollmentCount(event.target.value)}
                autoFocus
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEnrollmentDialog(null)}>
                Cancelar
              </Button>
              <Button
                disabled={
                  enrollM.isPending ||
                  !Number.isInteger(Number(enrollmentCount)) ||
                  Number(enrollmentCount) < 1
                }
                onClick={() => {
                  enrollM.mutate({
                    id: enrollmentDialog.id,
                    enrolled: true,
                    enrollment_count: Number(enrollmentCount),
                  });
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {checkInDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => setCheckInDialog(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-lg font-semibold text-foreground">
              Confirmar check-in?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              LEAD {checkInDialog.publicId}. Esta ação registrará a data e hora atual, dará o cartão
              como ganho e concluirá todas as tarefas pendentes. O check-in não poderá ser desfeito.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCheckInDialog(null)}>
                Cancelar
              </Button>
              <Button
                disabled={checkInM.isPending}
                onClick={() => checkInM.mutate(checkInDialog.id)}
              >
                {checkInM.isPending ? "Confirmando..." : "Confirmar check-in"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {viewId && <SubmissionViewDialog id={viewId} onClose={() => setViewId(null)} />}

      {restrictedConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={22}
                strokeWidth={2}
                className="mt-0.5 shrink-0 text-[oklch(0.72_0.18_60)]"
              />
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Atenção — cadastro com restrição
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  O cadastro{" "}
                  <span className="font-mono">{restrictedConfirm.submission.public_id}</span>{" "}
                  informou acompanhamento médico, psicológico ou psicopedagógico. Ele só deve ser
                  enviado ao funil <strong>{restrictedConfirm.funnelName}</strong> após avaliação.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tem certeza que deseja incluir este cadastro no funil?
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRestrictedConfirm(null)}>
                Cancelar
              </Button>
              <Button
                disabled={funnelM.isPending}
                onClick={() => {
                  const c = restrictedConfirm;
                  setRestrictedConfirm(null);
                  pickFunnel(c.submission, c.funnelId, c.funnelName, true);
                }}
              >
                Sim, incluir no funil
              </Button>
            </div>
          </div>
        </div>
      )}

      {funnelDialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg">
            <h2 className="text-base font-semibold text-foreground">Quem atendeu?</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {funnelDialog.publicId} · funil {funnelDialog.funnelName}
            </p>
            <div className="mt-4">
              <Label>Responsável</Label>
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                value={funnelAttendant}
                onChange={(e) => setFunnelAttendant(e.target.value)}
              >
                <option value="">Selecione o responsável…</option>
                {funnelDialog.owners.map((owner) => (
                  <option key={owner.userId} value={owner.userId}>
                    {owner.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setFunnelDialog(null)}>
                Cancelar
              </Button>
              <Button
                disabled={!funnelAttendant || funnelM.isPending}
                onClick={() => {
                  const attendantName = funnelDialog.owners.find(
                    (owner) => owner.userId === funnelAttendant,
                  )?.name;
                  funnelM.mutate({
                    submission_id: funnelDialog.submissionId,
                    funnel_id: funnelDialog.funnelId,
                    attendant_user_id: funnelAttendant,
                    ...(attendantName ? { attendant_name: attendantName } : {}),
                  });
                }}
              >
                Enviar para o funil
              </Button>
            </div>
          </div>
        </div>
      )}

      {printJob && (
        <>
          <div className="no-print fixed inset-0 z-50 grid place-items-center bg-background/70">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground shadow-lg">
              <Spinner />
              Preparando impressão...
            </div>
          </div>
          <PrintSheets
            templateId={printJob.templateId}
            submissionIds={[printJob.submissionId]}
            autoPrint
            offscreen
            onStateChange={handlePrintState}
            onDone={closePrint}
          />
        </>
      )}
    </div>
  );
}

function PrinterIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  );
}

function formatBRDate(raw: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : raw.trim();
}

function formatFieldValue(value: string | null | undefined): string[] {
  const raw = (value ?? "").trim();
  if (!raw) return [];
  if (raw.startsWith("{")) {
    const line = formatAddress(parseAddress(raw)).trim();
    return line ? [line] : [];
  }
  if (raw.startsWith("[")) {
    const children = parseChildren(raw);
    if (children.length > 0) {
      return children.map((c) => {
        const parts = [
          c.nome.trim(),
          c.nascimento ? `(${formatBRDate(c.nascimento)})` : "",
          c.serie.trim(),
          c.turno.trim(),
        ].filter(Boolean);
        return parts.join(" - ");
      });
    }
  }
  return raw
    .split(" | ")
    .map((part) => part.trim())
    .filter(Boolean);
}

function SubmissionViewDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["submission", id],
    queryFn: () => getSubmission({ data: { id } }),
  });

  const submission = data?.submission as
    | {
        public_id: string;
        created_at: string;
        forms?: { title?: string } | null;
        schools?: { name?: string } | null;
      }
    | undefined;
  const fields = (data?.fields ?? []) as FormField[];
  const values = new Map(
    ((data?.values ?? []) as { field_id: string; value: string | null }[]).map((v) => [
      v.field_id,
      v.value,
    ]),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {submission ? submission.public_id : "Cadastro"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {submission
              ? [
                  submission.schools?.name,
                  submission.forms?.title,
                  new Date(submission.created_at).toLocaleString("pt-BR"),
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Carregando..."}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <dl className="space-y-3">
              {fields.map((f) => {
                const lines = formatFieldValue(values.get(f.id));
                return (
                  <div key={f.id} className="border-b border-border/60 pb-3 last:border-0">
                    <dt className="text-xs font-medium text-muted-foreground">{f.label}</dt>
                    <dd className="mt-0.5 text-sm break-words text-foreground">
                      {lines.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        lines.map((line, i) => <div key={i}>{line}</div>)
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>

        <div className="flex justify-end border-t border-border px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
