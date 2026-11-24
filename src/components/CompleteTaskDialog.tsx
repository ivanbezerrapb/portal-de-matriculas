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
  onConfirm: (payload: { note: string; nextTask?: NextTaskInput }) => void;
}) {
  const [note, setNote] = useState(props.initialNote ?? "");
  const [nextTitle, setNextTitle] = useState("");
  const [nextDue, setNextDue] = useState("");

  const { data: taskTypes } = useQuery({
    queryKey: ["task-types", "active"],
    queryFn: () => listTaskTypes({ data: { activeOnly: true } }),
    enabled: props.requireNextTask,
  });

  const hasTypes = (taskTypes ?? []).length > 0;
  const canConfirm =
    !props.saving &&
    Boolean(note.trim()) &&
    (!props.requireNextTask || (Boolean(nextTitle.trim()) && Boolean(nextDue)));

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
            <Label htmlFor="next-task-title" className="mt-3 block">
              Atividade
            </Label>
            {hasTypes ? (
              <Select
                id="next-task-title"
                value={nextTitle}
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
              onChange={(e) => setNextDue(e.target.value)}
            />
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={props.onCancel} disabled={props.saving}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              props.onConfirm({
                note: note.trim(),
                ...(props.requireNextTask
                  ? { nextTask: { title: nextTitle.trim(), due_date: nextDue } }
                  : {}),
              })
            }
            disabled={!canConfirm}
          >
            {props.requireNextTask ? "Concluir e agendar próxima" : "Concluir"}
          </Button>
        </div>
      </div>
    </div>
  );
}
