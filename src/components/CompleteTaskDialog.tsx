import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listTaskTypes } from "@/lib/ext/atividades.functions";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import type { NextTaskInput } from "@/lib/ext/task-flow";

export function CompleteTaskDialog(props: {
  taskTitle: string;
  saving: boolean;
  requireNextTask: boolean;
  initialNote?: string;
  fromHistory?: boolean;
  onCancel: () => void;
  onConfirm: (payload: { note: string; nextTask?: NextTaskInput; skipNext?: boolean }) => void;
}) {
  const [note, setNote] = useState(props.initialNote ?? "");
  const [nextTitle, setNextTitle] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [skipNext, setSkipNext] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);

  const { data: taskTypes } = useQuery({
    queryKey: ["task-types", "active"],
    queryFn: () => listTaskTypes({ data: { activeOnly: true } }),
    enabled: props.requireNextTask,
  });

  const hasTypes = (taskTypes ?? []).length > 0;
  const needsNext = props.requireNextTask && !skipNext;
  const canConfirm =
    !props.saving &&
    Boolean(note.trim()) &&
    (!needsNext || (Boolean(nextTitle.trim()) && Boolean(nextDue)));

  const submitLabel = props.requireNextTask
    ? skipNext
      ? "Concluir sem próxima tarefa"
      : "Concluir e agendar próxima"
    : "Concluir";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-lg">
        <h2 className="font-display text-lg font-bold text-foreground">
          {props.requireNextTask ? "Concluir e agendar próxima" : "Concluir tarefa"}
        </h2>
        {props.fromHistory ? (
          <p className="mt-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground">
            Existe a tarefa pendente <span className="font-semibold">{props.taskTitle}</span>.
            Confirme abaixo para concluí-la com este histórico
            {props.requireNextTask ? " e agendar a próxima." : "."}
          </p>
        ) : (
          <p className="mt-1 break-words text-sm text-muted-foreground">{props.taskTitle}</p>
        )}
        <Label htmlFor="complete-note" className="mt-4 block">
          O que foi feito? (obrigatório)
        </Label>
        <Textarea
          id="complete-note"
          rows={3}
          autoFocus={!props.initialNote}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="O que foi feito e como foi?"
        />
        {props.requireNextTask && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-sm font-semibold text-foreground">Próxima tarefa (obrigatório)</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Todo cartão em andamento precisa ter um próximo passo agendado.
            </p>
            <div className={skipNext ? "opacity-50" : undefined}>
              <Label htmlFor="next-task-title" className="mt-3 block">
                Atividade
              </Label>
              {hasTypes ? (
                <Select
                  id="next-task-title"
                  value={nextTitle}
                  disabled={props.saving || skipNext}
                  onChange={(e) => setNextTitle(e.target.value)}
                >
                  <option value="">Selecione a próxima atividade…</option>
                  {(taskTypes ?? []).map((t) => (
                    <option key={t.id} value={t.label}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id="next-task-title"
                  value={nextTitle}
                  disabled={props.saving || skipNext}
                  onChange={(e) => setNextTitle(e.target.value)}
                  placeholder="Descreva a próxima atividade"
                />
              )}
              <Label htmlFor="next-task-due" className="mt-3 block">
                Data
              </Label>
              <Input
                id="next-task-due"
                type="date"
                value={nextDue}
                disabled={props.saving || skipNext}
                onChange={(e) => setNextDue(e.target.value)}
              />
            </div>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-primary)]"
                checked={skipNext}
                disabled={props.saving}
                onChange={(e) => setSkipNext(e.target.checked)}
              />
              <span>Não criar próxima tarefa</span>
            </label>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={props.onCancel} disabled={props.saving}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (props.requireNextTask && skipNext) {
                setConfirmSkip(true);
                return;
              }
              props.onConfirm({
                note: note.trim(),
                ...(props.requireNextTask
                  ? { nextTask: { title: nextTitle.trim(), due_date: nextDue } }
                  : {}),
              });
            }}
            disabled={!canConfirm}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
      {confirmSkip && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/50 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-skip-title"
            className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl"
          >
            <h3 id="confirm-skip-title" className="font-display text-base font-bold text-foreground">
              Concluir sem próxima tarefa?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Tem certeza que não irá criar a próxima tarefa? Este cartão ficará sem próximo passo
              agendado.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmSkip(false)} disabled={props.saving}>
                Voltar
              </Button>
              <Button
                onClick={() => props.onConfirm({ note: note.trim(), skipNext: true })}
                disabled={props.saving}
              >
                Sim, concluir sem próxima
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
