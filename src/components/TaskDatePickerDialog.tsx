import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isPastTaskDate, parseLocalISODate, toLocalISODate } from "@/lib/ext/task-flow";
import { todayISO } from "@/lib/ext/task-notice";

export function TaskDatePickerDialog(props: {
  open: boolean;
  taskTitle: string;
  initialDue: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (dueDateISO: string) => void;
}) {
  const today = todayISO();
  const todayDate = parseLocalISODate(today);
  const [picked, setPicked] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (!props.open) return;
    const existing = props.initialDue >= today ? parseLocalISODate(props.initialDue) : undefined;
    setPicked(existing);
  }, [props.open, props.initialDue, today]);

  const defaultMonth = picked ?? todayDate;

  return (
    <Dialog
      open={props.open}
      onOpenChange={(next) => {
        if (!next && !props.saving) props.onCancel();
      }}
    >
      <DialogContent className="z-[70] max-w-sm">
        <DialogHeader>
          <DialogTitle>Quando será esta tarefa?</DialogTitle>
          <DialogDescription>
            Atividade: <span className="font-medium text-foreground">{props.taskTitle}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-2">
          <Calendar
            mode="single"
            locale={ptBR}
            {...(picked ? { selected: picked } : {})}
            onSelect={setPicked}
            {...(defaultMonth ? { defaultMonth } : {})}
            {...(todayDate ? { today: todayDate } : {})}
            disabled={(date) => isPastTaskDate(date, today)}
            className="rounded-md border border-border p-3 pointer-events-auto"
          />
          <p className="text-xs text-muted-foreground">
            {picked
              ? `Data escolhida: ${format(picked, "dd/MM/yyyy")}`
              : "Selecione uma data no calendário."}
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={props.onCancel} disabled={props.saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!picked || props.saving}
            onClick={() => {
              if (!picked) return;
              props.onConfirm(toLocalISODate(picked));
            }}
          >
            {props.saving ? "Agendando…" : "Agendar tarefa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}