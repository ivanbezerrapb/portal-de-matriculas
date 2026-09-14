import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteTask, listTasks, setTaskDone, type TaskRow } from "@/lib/ext/tarefas.functions";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import { Button, Card, EmptyState, Select, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/crm/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas — Grupo Inter" },
      { name: "description", content: "Acompanhe as tarefas das oportunidades do CRM." },
      { property: "og:title", content: "Tarefas — Grupo Inter" },
      { property: "og:description", content: "Acompanhe as tarefas das oportunidades do CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TarefasPage,
});

function taskDate(t: TaskRow) {
  if (!t.due_date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${t.due_date}T00:00:00`);
  const overdue = !t.done && due < today;
  return { text: due.toLocaleDateString("pt-BR"), overdue };
}

function TarefasPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "done" | "all">("pending");

  const { data: perms } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => getMyPermissions(),
  });
  // Direção acompanha as tarefas apenas em leitura.
  const canWrite = !(perms?.isDirecao ?? false);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["crm-tasks", filter],
    queryFn: () =>
      listTasks({
        data: filter === "all" ? {} : { done: filter === "done" },
      }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
  }

  const doneM = useMutation({
    mutationFn: (d: { id: string; done: boolean }) => setTaskDone({ data: d }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteM = useMutation({
    mutationFn: (d: { id: string }) => deleteTask({ data: d }),
    onSuccess: () => {
      toast.success("Tarefa removida.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">CRM</p>
          <h1 className="font-display text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Afazeres das oportunidades, ordenados por data.
          </p>
        </div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="pending">Pendentes</option>
          <option value="done">Feitas</option>
          <option value="all">Todas</option>
        </Select>
      </div>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nenhuma tarefa"
            description="As tarefas são criadas no painel da oportunidade, no CRM › Pipeline."
          />
        </div>
      ) : (
        <Card className="mt-6 p-0">
          <ul className="divide-y divide-border">
            {tasks.map((t) => {
              const d = taskDate(t);
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    className="accent-[var(--color-primary)]"
                    checked={t.done}
                    disabled={!canWrite}
                    onChange={(e) => doneM.mutate({ id: t.id, done: e.target.checked })}
                    aria-label={t.done ? "Reabrir tarefa" : "Concluir tarefa"}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${
                        t.done ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {t.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.opportunities?.name ?? "Oportunidade"}
                      {d && (
                        <span className={d.overdue ? "font-semibold text-destructive" : ""}>
                          {" · "}
                          {d.text}
                          {d.overdue && " (atrasada)"}
                        </span>
                      )}
                    </p>
                  </div>
                  {t.opportunities && (
                    <Link
                      to="/crm/pipeline"
                      search={{ funil: undefined, card: t.opportunities.id }}
                    >
                      <Button variant="outline" className="text-xs">
                        Abrir
                      </Button>
                    </Link>
                  )}
                  {canWrite && (
                    <button
                      type="button"
                      aria-label="Excluir tarefa"
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => deleteM.mutate({ id: t.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
