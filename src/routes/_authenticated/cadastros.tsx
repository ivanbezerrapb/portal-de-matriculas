import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  setSubmissionPeople,
} from "@/lib/ext/cadastros.functions";
import { listFunnelOwners, listFunnels } from "@/lib/ext/funis.functions";
import { listPresenters, type PresenterKind } from "@/lib/ext/apresentacao.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import { listForms } from "@/lib/ext/formularios.functions";
import { listPrintTemplates } from "@/lib/ext/impressao.functions";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import { Button, Card, EmptyState, Input, Label, Select, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/cadastros")({
  head: () => ({
    meta: [
      { title: "Lista de Visitantes — Grupo Inter" },
      { name: "description", content: "Consulte e gerencie as visitas escolares." },
      { property: "og:title", content: "Lista de Visitantes — Grupo Inter" },
      { property: "og:description", content: "Consulte e gerencie as visitas escolares." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubmissionsPage,
});

function SubmissionsPage() {
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
  const [dialogAttendant, setDialogAttendant] = useState<PersonChoice | null>(null);
  const [dialogPresenter, setDialogPresenter] = useState<PersonChoice | null>(null);
  const [savingEnrollment, setSavingEnrollment] = useState(false);
  const [funnelDialog, setFunnelDialog] = useState<{
    submissionId: string;
    publicId: string;
    funnelId: string;
    funnelName: string;
    owners: string[];
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

  const { data: presenters } = useQuery({
    queryKey: ["presenters"],
    queryFn: () => listPresenters({ data: { only_active: true } }),
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
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(schoolId ? { school_id: schoolId } : {}),
    ...(formId ? { form_id: formId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };

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

  const peopleM = useMutation({
    mutationFn: (d: {
      submission_id: string;
      kind: PresenterKind;
      presenter_id?: string | null;
      new_name?: string;
    }) => setSubmissionPeople({ data: d }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["presenters"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const funnelM = useMutation({
    mutationFn: (d: { submission_id: string; funnel_id: string; attendant_name?: string }) =>
      sendSubmissionToFunnel({ data: d }),
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
    const owners = [
      ...new Set(
        (funnelOwners ?? []).filter((o) => o.funnel_id === funnelId).map((o) => o.name.trim()),
      ),
    ].filter(Boolean);
    if (owners.length === 1 && owners[0]) {
      funnelM.mutate({
        submission_id: submission.id,
        funnel_id: funnelId,
        attendant_name: owners[0],
      });
      return;
    }
    if (owners.length === 0) {
      funnelM.mutate({ submission_id: submission.id, funnel_id: funnelId });
      return;
    }
    setFunnelAttendant(owners[0] ?? "");
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
      <h1 className="font-display text-2xl font-bold text-foreground">Lista de Visitantes</h1>

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
              {(forms ?? []).map((f) => (
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
                <th className="px-4 py-3">Crianças</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Apresentação</th>
                <th className="px-4 py-3">Atendimento</th>
                <th className="px-4 py-3">Funil</th>
                <th className="px-4 py-3">Matrícula</th>
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
                          <AlertTriangle
                            size={16}
                            strokeWidth={2}
                            className="shrink-0 text-[oklch(0.72_0.18_60)]"
                            aria-label="Cadastro com restrição"
                            title="Atenção: cadastro com acompanhamento médico/psicológico informado"
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 break-words text-foreground">
                      {responsible ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{school?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{childrenCount ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {new Date(s.created_at).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <PersonCell
                        kind="coordenacao"
                        current={
                          (s as unknown as { presenter: { name?: string } | null }).presenter
                            ?.name ?? null
                        }
                        options={(presenters ?? []).filter(
                          (p) => p.school_id === s.school_id && p.kind === "coordenacao",
                        )}
                        disabled={!canEnroll || peopleM.isPending}
                        onPick={(value) =>
                          peopleM.mutate({ submission_id: s.id, kind: "coordenacao", ...value })
                        }
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <PersonCell
                        kind="secretaria"
                        current={
                          (s as unknown as { attendant: { name?: string } | null }).attendant
                            ?.name ?? null
                        }
                        options={(presenters ?? []).filter(
                          (p) => p.school_id === s.school_id && p.kind === "secretaria",
                        )}
                        disabled={!canEnroll || peopleM.isPending}
                        onPick={(value) =>
                          peopleM.mutate({ submission_id: s.id, kind: "secretaria", ...value })
                        }
                      />
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
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          className="accent-[var(--color-primary)]"
                          checked={enrolled}
                          disabled={!canEnroll || enrollM.isPending}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEnrollmentCount(String(Math.max(childrenCount ?? 1, 1)));
                              const att = (
                                s as unknown as { attendant: { id?: string; name?: string } | null }
                              ).attendant;
                              const pre = (
                                s as unknown as { presenter: { id?: string; name?: string } | null }
                              ).presenter;
                              setDialogAttendant(
                                att?.id && att.name
                                  ? { presenter_id: att.id, label: att.name }
                                  : null,
                              );
                              setDialogPresenter(
                                pre?.id && pre.name
                                  ? { presenter_id: pre.id, label: pre.name }
                                  : null,
                              );

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
                    </td>
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
            <div className="mt-4">
              <Label>Quem atendeu (Secretaria)</Label>
              <PersonPicker
                kind="secretaria"
                value={dialogAttendant}
                options={(presenters ?? []).filter(
                  (p) => p.school_id === enrollmentDialog.schoolId && p.kind === "secretaria",
                )}
                onChange={setDialogAttendant}
              />
            </div>
            <div className="mt-4">
              <Label>Quem apresentou (Coordenação)</Label>
              <PersonPicker
                kind="coordenacao"
                value={dialogPresenter}
                options={(presenters ?? []).filter(
                  (p) => p.school_id === enrollmentDialog.schoolId && p.kind === "coordenacao",
                )}
                onChange={setDialogPresenter}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEnrollmentDialog(null)}>
                Cancelar
              </Button>
              <Button
                disabled={
                  enrollM.isPending ||
                  savingEnrollment ||
                  !dialogAttendant ||
                  !dialogPresenter ||
                  !Number.isInteger(Number(enrollmentCount)) ||
                  Number(enrollmentCount) < 1
                }
                onClick={async () => {
                  if (!dialogAttendant || !dialogPresenter) return;
                  setSavingEnrollment(true);
                  try {
                    await setSubmissionPeople({
                      data: {
                        submission_id: enrollmentDialog.id,
                        kind: "secretaria",
                        ...(dialogAttendant.presenter_id
                          ? { presenter_id: dialogAttendant.presenter_id }
                          : { new_name: dialogAttendant.label }),
                      },
                    });
                    await setSubmissionPeople({
                      data: {
                        submission_id: enrollmentDialog.id,
                        kind: "coordenacao",
                        ...(dialogPresenter.presenter_id
                          ? { presenter_id: dialogPresenter.presenter_id }
                          : { new_name: dialogPresenter.label }),
                      },
                    });

                    queryClient.invalidateQueries({ queryKey: ["presenters"] });
                    enrollM.mutate({
                      id: enrollmentDialog.id,
                      enrolled: true,
                      enrollment_count: Number(enrollmentCount),
                    });
                  } catch (err) {
                    toast.error((err as Error).message);
                  } finally {
                    setSavingEnrollment(false);
                  }
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {viewId && <SubmissionViewDialog id={viewId} onClose={() => setViewId(null)} />}

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
                {funnelDialog.owners.map((name) => (
                  <option key={name} value={name}>
                    {name}
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
                onClick={() =>
                  funnelM.mutate({
                    submission_id: funnelDialog.submissionId,
                    funnel_id: funnelDialog.funnelId,
                    attendant_name: funnelAttendant,
                  })
                }
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

type PersonChoice = { presenter_id?: string; label: string };

const PLACEHOLDERS: Record<PresenterKind, string> = {
  secretaria: "Quem atendeu",
  coordenacao: "Quem apresentou",
  efetivacao: "Quem efetivou",
};

function PersonPicker({
  kind,
  value,
  options,
  onChange,
}: {
  kind: PresenterKind;
  value: PersonChoice | null;
  options: { id: string; name: string }[];
  onChange: (value: PersonChoice | null) => void;
}) {
  const [text, setText] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);

  const query = text.trim().toLowerCase();
  const matches = options.filter((o) => o.name.toLowerCase().includes(query));
  const exact = options.find((o) => o.name.toLowerCase() === query);

  return (
    <div className="relative">
      <Input
        value={text}
        placeholder={PLACEHOLDERS[kind]}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          onChange(null);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
          {matches.map((o) => (
            <button
              key={o.id}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange({ presenter_id: o.id, label: o.name });
                setText(o.name);
                setOpen(false);
              }}
            >
              {o.name}
            </button>
          ))}
          {query.length >= 2 && !exact && (
            <button
              className="block w-full px-3 py-1.5 text-left text-sm font-medium text-primary hover:bg-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange({ label: text.trim() });
                setOpen(false);
              }}
            >
              Cadastrar «{text.trim()}»
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PersonCell({
  kind,
  current,
  options,
  disabled,
  onPick,
}: {
  kind: PresenterKind;
  current: string | null;
  options: { id: string; name: string }[];
  disabled: boolean;
  onPick: (value: { presenter_id?: string | null; new_name?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  if (disabled) {
    return <span className="break-words text-muted-foreground">{current ?? "—"}</span>;
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setText(current ?? "");
          setOpen(true);
        }}
        className="w-full break-words rounded-md px-2 py-1 text-left text-sm text-foreground hover:bg-accent"
      >
        {current ?? <span className="text-muted-foreground">—</span>}
      </button>
    );
  }

  const query = text.trim().toLowerCase();
  const matches = options.filter((o) => o.name.toLowerCase().includes(query));
  const exact = options.find((o) => o.name.toLowerCase() === query);

  return (
    <div className="relative w-full min-w-32">
      <Input
        autoFocus
        value={text}
        placeholder={PLACEHOLDERS[kind]}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
        {matches.map((o) => (
          <button
            key={o.id}
            className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
            onMouseDown={(e) => {
              e.preventDefault();
              onPick({ presenter_id: o.id });
              setOpen(false);
            }}
          >
            {o.name}
          </button>
        ))}
        {query.length >= 2 && !exact && (
          <button
            className="block w-full px-3 py-1.5 text-left text-sm font-medium text-primary hover:bg-accent"
            onMouseDown={(e) => {
              e.preventDefault();
              onPick({ new_name: text.trim() });
              setOpen(false);
            }}
          >
            Cadastrar «{text.trim()}»
          </button>
        )}
        {current && (
          <button
            className="block w-full px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
            onMouseDown={(e) => {
              e.preventDefault();
              onPick({ presenter_id: null });
              setOpen(false);
            }}
          >
            Limpar
          </button>
        )}
      </div>
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
