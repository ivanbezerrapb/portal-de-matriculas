import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { listFunnels } from "@/lib/ext/funis.functions";
import {
  closeOpportunity,
  createOpportunity,
  deleteOpportunity,
  listPipeline,
  moveOpportunity,
  reopenOpportunity,
} from "@/lib/ext/pipeline.functions";
import { listCloseReasons } from "@/lib/ext/motivos.functions";
import { createTask, deleteTask, listTasks, setTaskDone } from "@/lib/ext/tarefas.functions";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import { Button, Card, EmptyState, Input, Label, Select, Spinner, Textarea } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/crm/pipeline")({
  validateSearch: (search: Record<string, unknown>) => ({
    funil: typeof search["funil"] === "string" ? (search["funil"] as string) : undefined,
    card: typeof search["card"] === "string" ? (search["card"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Pipeline — Grupo Inter" },
      {
        name: "description",
        content: "Acompanhe as oportunidades de matrícula por etapa do funil.",
      },
      { property: "og:title", content: "Pipeline — Grupo Inter" },
      {
        property: "og:description",
        content: "Acompanhe as oportunidades de matrícula por etapa do funil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PipelinePage,
});

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

// Cor da data da atividade: no prazo cinza, hoje verde, vencida vermelha.
function activityColor(due: string | null): string {
  if (!due) return "text-muted-foreground";
  const today = new Date();
  const hoje = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (due === hoje) return "text-emerald-600";
  if (due < hoje) return "text-destructive";
  return "text-muted-foreground";
}

function PipelinePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { funil, card } = Route.useSearch();
  const [dragging, setDragging] = useState<string | null>(null);
  const [newIn, setNewIn] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(card ?? null);
  const [statusFilter, setStatusFilter] = useState<"open" | "won" | "lost">("open");
  const [closing, setClosing] = useState<{ id: string; result: "won" | "lost" } | null>(null);

  // Abre o painel quando o endereço traz ?card=... (ex.: vindo da tela Tarefas).
  useEffect(() => {
    if (card) setOpenCard(card);
  }, [card]);

  const { data: perms } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => getMyPermissions(),
  });
  const canClose = perms?.isAdmin || (perms?.managerSchools.length ?? 0) > 0;

  const funnelsQuery = useQuery({ queryKey: ["funnels"], queryFn: () => listFunnels() });
  const funnels = funnelsQuery.data?.funnels ?? [];
  const selected = funil ?? funnels.find((f) => f.is_default)?.id ?? funnels[0]?.id;

  const pipelineQuery = useQuery({
    queryKey: ["pipeline", selected, statusFilter],
    queryFn: () => listPipeline({ data: { funnel_id: selected!, status: statusFilter } }),
    enabled: Boolean(selected),
  });

  const stages = pipelineQuery.data?.stages ?? [];
  const opportunities = pipelineQuery.data?.opportunities ?? [];
  const nextTasks = pipelineQuery.data?.nextTasks ?? {};

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["pipeline", selected] });
  }

  const moveM = useMutation({
    mutationFn: (d: { id: string; stage_id: string; position: number }) =>
      moveOpportunity({ data: d }),
    onSuccess: refresh,
    onError: (e: Error) => {
      toast.error(e.message);
      refresh();
    },
  });

  const createM = useMutation({
    mutationFn: (d: {
      stage_id: string;
      name: string;
      phone: string;
      email: string;
      notes: string;
    }) => createOpportunity({ data: d }),
    onSuccess: () => {
      toast.success("Oportunidade criada.");
      setNewIn(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (d: { id: string }) => deleteOpportunity({ data: d }),
    onSuccess: () => {
      toast.success("Oportunidade removida.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeM = useMutation({
    mutationFn: (d: { id: string; result: "won" | "lost"; reason_id: string; note?: string }) =>
      closeOpportunity({ data: d }),
    onSuccess: () => {
      toast.success("Oportunidade fechada.");
      setClosing(null);
      setOpenCard(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reopenM = useMutation({
    mutationFn: (d: { id: string }) => reopenOpportunity({ data: d }),
    onSuccess: () => {
      toast.success("Oportunidade reaberta.");
      setOpenCard(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">CRM</p>
          <h1 className="font-display text-2xl font-bold text-foreground">Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Arraste os cartões entre as etapas para atualizar o atendimento.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-40">
            <Label>Situação</Label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="open">Em aberto</option>
              <option value="won">Ganhas</option>
              <option value="lost">Perdidas</option>
            </Select>
          </div>
          <div className="min-w-56">
            <Label>Funil</Label>
            <Select
              value={selected ?? ""}
              onChange={(e) =>
                navigate({
                  to: "/crm/pipeline",
                  search: { funil: e.target.value || undefined, card: undefined },
                })
              }
            >
              <option value="">Selecione um funil…</option>
              {funnels.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {funnelsQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : funnels.length === 0 ? (
        <EmptyState
          title="Nenhum funil disponível"
          description="Crie um funil em CRM › Funil para começar a acompanhar as oportunidades."
        />
      ) : !selected ? (
        <EmptyState
          title="Selecione um funil"
          description="Escolha um funil acima para ver as etapas e as oportunidades."
        />
      ) : pipelineQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const cards = opportunities
              .filter((o) => o.stage_id === stage.id)
              .sort((a, b) => a.position - b.position);
            return (
              <div
                key={stage.id}
                className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30 p-3"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!dragging || statusFilter !== "open") return;
                  moveM.mutate({ id: dragging, stage_id: stage.id, position: cards.length });
                  setDragging(null);
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <p className="flex-1 text-sm font-semibold text-foreground">{stage.name}</p>
                  <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
                    {cards.length}
                  </span>
                </div>

                <div className="flex-1 space-y-2">
                  {cards.map((card) => {
                    const activity = nextTasks[card.id];
                    const body = (
                      <>
                        <p className="text-sm font-semibold text-foreground">{card.name}</p>
                        {card.phone && (
                          <p className="text-xs text-muted-foreground">{card.phone}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ backgroundColor: `${stage.color}1a`, color: stage.color }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                            {stage.name}
                          </span>
                          {activity ? (
                            <span
                              className={`text-[11px] font-medium ${activityColor(activity.due_date)}`}
                            >
                              {activity.title}
                              {activity.due_date
                                ? ` · ${new Date(`${activity.due_date}T00:00:00`).toLocaleDateString("pt-BR")}`
                                : ""}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Sem atividade</span>
                          )}
                        </div>
                        {card.status !== "open" && (
                          <p
                            className={`mt-2 text-[11px] font-semibold ${
                              card.status === "won" ? "text-emerald-600" : "text-destructive"
                            }`}
                          >
                            {card.status === "won" ? "Ganha" : "Perdida"}
                            {card.crm_close_reasons?.label
                              ? ` · ${card.crm_close_reasons.label}`
                              : ""}
                          </p>
                        )}
                      </>
                    );
                    return (
                      <div
                        key={card.id}
                        draggable={statusFilter === "open"}
                        onDragStart={() => setDragging(card.id)}
                        onDragEnd={() => setDragging(null)}
                        className="group rounded-lg border border-border bg-card p-3 shadow-sm"
                      >
                        <button
                          type="button"
                          className="block w-full cursor-pointer text-left"
                          onClick={() => setOpenCard(card.id)}
                        >
                          {body}
                        </button>
                        {statusFilter === "open" && (
                          <button
                            type="button"
                            aria-label="Remover oportunidade"
                            className="mt-2 hidden text-xs text-destructive group-hover:inline-flex"
                            onClick={() => deleteM.mutate({ id: card.id })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {statusFilter === "open" ? (
                  newIn === stage.id ? (
                    <form
                      className="mt-2 space-y-2 rounded-lg border border-border bg-card p-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget as HTMLFormElement);
                        createM.mutate({
                          stage_id: stage.id,
                          name: String(fd.get("name") ?? ""),
                          phone: String(fd.get("phone") ?? ""),
                          email: String(fd.get("email") ?? ""),
                          notes: String(fd.get("notes") ?? ""),
                        });
                      }}
                    >
                      <Input name="name" placeholder="Nome" required />
                      <Input name="phone" placeholder="Telefone" />
                      <Input name="email" placeholder="E-mail" />
                      <Textarea name="notes" rows={2} placeholder="Observação" />
                      <div className="flex gap-2">
                        <Button type="submit" disabled={createM.isPending}>
                          Salvar
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setNewIn(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <Button
                      variant="ghost"
                      className="mt-2 w-full justify-start text-muted-foreground"
                      onClick={() => setNewIn(stage.id)}
                    >
                      <Plus className="h-4 w-4" /> Nova oportunidade
                    </Button>
                  )
                ) : null}
              </div>
            );
          })}
          {stages.length === 0 && (
            <Card>
              <p className="text-sm text-muted-foreground">
                Este funil ainda não tem etapas. Adicione etapas em CRM › Funil.
              </p>
            </Card>
          )}
        </div>
      )}

      {(() => {
        const card = opportunities.find((o) => o.id === openCard);
        if (!card) return null;
        const stage = stages.find((s) => s.id === card.stage_id);
        const details = (card.details ?? []) as { label: string; value: string }[];
        return (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-foreground/40"
            onClick={() => setOpenCard(null)}
          >
            <div
              className="h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-xl font-bold text-foreground">{card.name}</h2>
                <Button variant="ghost" onClick={() => setOpenCard(null)}>
                  Fechar
                </Button>
              </div>

              {stage && (
                <span
                  className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: `${stage.color}1a`, color: stage.color }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.name}
                </span>
              )}

              <dl className="mt-4 space-y-3 text-sm">
                {card.phone && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Telefone</dt>
                    <dd className="text-foreground">{card.phone}</dd>
                  </div>
                )}
                {card.email && (
                  <div>
                    <dt className="text-xs text-muted-foreground">E-mail</dt>
                    <dd className="text-foreground">{card.email}</dd>
                  </div>
                )}
                {details.map((d, i) => {
                  const lines = d.value.split(" | ").filter(Boolean);
                  return (
                    <div key={i}>
                      <dt className="text-xs text-muted-foreground">{d.label}</dt>
                      <dd className="text-foreground">
                        {lines.map((line, j) => (
                          <div key={j}>{line}</div>
                        ))}
                      </dd>
                    </div>
                  );
                })}
                {card.notes && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Observação</dt>
                    <dd className="whitespace-pre-line text-foreground">{card.notes}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Entrada</dt>
                  <dd className="text-foreground">{formatDate(card.created_at)}</dd>
                </div>
                {card.status !== "open" && (
                  <>
                    <div>
                      <dt className="text-xs text-muted-foreground">Resultado</dt>
                      <dd
                        className={`font-semibold ${
                          card.status === "won" ? "text-emerald-600" : "text-destructive"
                        }`}
                      >
                        {card.status === "won" ? "Ganha" : "Perdida"}
                        {card.crm_close_reasons?.label ? ` · ${card.crm_close_reasons.label}` : ""}
                      </dd>
                    </div>
                    {card.close_note && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Observação do fechamento</dt>
                        <dd className="whitespace-pre-line text-foreground">{card.close_note}</dd>
                      </div>
                    )}
                    {card.closed_at && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Fechada em</dt>
                        <dd className="text-foreground">{formatDate(card.closed_at)}</dd>
                      </div>
                    )}
                  </>
                )}
              </dl>

              {card.submission_id && (
                <Link
                  to="/cadastros/$submissionId"
                  params={{ submissionId: card.submission_id }}
                  className="mt-6 inline-flex text-sm font-medium text-primary hover:underline"
                >
                  Abrir cadastro
                </Link>
              )}

              <OpportunityTasks opportunityId={card.id} />

              {card.status === "open"
                ? canClose && (
                    <div className="mt-6 flex gap-2 border-t border-border pt-4">
                      <Button
                        variant="outline"
                        className="flex-1 border-emerald-600/40 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => setClosing({ id: card.id, result: "won" })}
                      >
                        Marcar como ganha
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                        onClick={() => setClosing({ id: card.id, result: "lost" })}
                      >
                        Marcar como perdida
                      </Button>
                    </div>
                  )
                : canClose && (
                    <div className="mt-6 border-t border-border pt-4">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => reopenM.mutate({ id: card.id })}
                        disabled={reopenM.isPending}
                      >
                        Reabrir oportunidade
                      </Button>
                    </div>
                  )}
            </div>
          </div>
        );
      })()}

      {closing && (
        <CloseDialog
          result={closing.result}
          saving={closeM.isPending}
          onCancel={() => setClosing(null)}
          onConfirm={(reasonId, note) =>
            closeM.mutate({ id: closing.id, result: closing.result, reason_id: reasonId, note })
          }
        />
      )}
    </div>
  );
}

function OpportunityTasks({ opportunityId }: { opportunityId: string }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  const { data: tasks } = useQuery({
    queryKey: ["crm-tasks", "opp", opportunityId],
    queryFn: () => listTasks({ data: { opportunity_id: opportunityId } }),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
  }

  const createM = useMutation({
    mutationFn: () =>
      createTask({ data: { opportunity_id: opportunityId, title, due_date: due || null } }),
    onSuccess: () => {
      setTitle("");
      setDue("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const doneM = useMutation({
    mutationFn: (d: { id: string; done: boolean }) => setTaskDone({ data: d }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteM = useMutation({
    mutationFn: (d: { id: string }) => deleteTask({ data: d }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-6 border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-foreground">Tarefas</h3>
      <ul className="mt-2 space-y-2">
        {(tasks ?? []).map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-[var(--color-primary)]"
              checked={t.done}
              onChange={(e) => doneM.mutate({ id: t.id, done: e.target.checked })}
              aria-label={t.done ? "Reabrir tarefa" : "Concluir tarefa"}
            />
            <span
              className={`flex-1 ${
                t.done ? "text-muted-foreground line-through" : "text-foreground"
              }`}
            >
              {t.title}
              {t.due_date && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({new Date(`${t.due_date}T00:00:00`).toLocaleDateString("pt-BR")})
                </span>
              )}
            </span>
            <button
              type="button"
              aria-label="Excluir tarefa"
              className="rounded p-1 text-muted-foreground hover:text-destructive"
              onClick={() => deleteM.mutate({ id: t.id })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {(tasks ?? []).length === 0 && (
          <li className="text-xs text-muted-foreground">Nenhuma tarefa ainda.</li>
        )}
      </ul>
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          createM.mutate();
        }}
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nova tarefa…"
        />
        <div className="flex gap-2">
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <Button type="submit" disabled={createM.isPending || !title.trim()}>
            Adicionar
          </Button>
        </div>
      </form>
    </section>
  );
}

function CloseDialog(props: {
  result: "won" | "lost";
  saving: boolean;
  onCancel: () => void;
  onConfirm: (reasonId: string, note: string) => void;
}) {
  const [reasonId, setReasonId] = useState("");
  const [note, setNote] = useState("");
  const { data: reasons, isLoading } = useQuery({
    queryKey: ["close-reasons", "active"],
    queryFn: () => listCloseReasons({ data: { activeOnly: true } }),
  });
  const options = (reasons ?? []).filter((r) => r.kind === props.result);
  const isWon = props.result === "won";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4"
      onClick={props.onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-semibold text-foreground">
          {isWon ? "Marcar como ganha" : "Marcar como perdida"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o motivo {isWon ? "do ganho" : "da perda"}.
        </p>
        {isLoading ? (
          <div className="mt-4 flex justify-center">
            <Spinner />
          </div>
        ) : options.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhum motivo ativo. Cadastre em CRM › Motivos.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <Select value={reasonId} onChange={(e) => setReasonId(e.target.value)}>
              <option value="">Selecione o motivo…</option>
              {options.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
            <Textarea
              rows={2}
              placeholder="Observação (opcional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={props.onCancel}>
            Cancelar
          </Button>
          <Button
            disabled={!reasonId || props.saving}
            onClick={() => props.onConfirm(reasonId, note)}
          >
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}
