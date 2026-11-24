import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import type { NoticeItem } from "@/lib/ext/task-notice";

const MAX_ROWS_PER_GROUP = 15;

function fmtDate(due: string) {
  return new Date(`${due}T00:00:00`).toLocaleDateString("pt-BR");
}

function NoticeGroup(props: {
  title: string;
  items: NoticeItem[];
  tone: "overdue" | "today";
  onOpenCard: (item: NoticeItem) => void;
}) {
  if (props.items.length === 0) return null;
  const shown = props.items.slice(0, MAX_ROWS_PER_GROUP);
  const hidden = props.items.length - shown.length;
  const isOverdue = props.tone === "overdue";

  return (
    <section>
      <div
        className={
          isOverdue
            ? "sticky top-0 flex items-center justify-between border-b border-border bg-destructive/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-destructive"
            : "sticky top-0 flex items-center justify-between border-b border-border bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-foreground"
        }
      >
        <span>{props.title}</span>
        <span>{props.items.length}</span>
      </div>
      <ul className="divide-y divide-border">
        {shown.map((item) => (
          <li key={item.taskId}>
            <button
              type="button"
              className="w-full px-4 py-3 text-left hover:bg-muted/60"
              onClick={() => props.onOpenCard(item)}
            >
              <p className="break-words text-sm font-semibold text-foreground">{item.cardName}</p>
              <p className="mt-0.5 break-words text-xs text-muted-foreground">
                {item.funnelName}
                {item.schoolName ? ` · ${item.schoolName}` : ""}
              </p>
              <p className="mt-1 text-sm text-foreground">
                {item.taskTitle}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({fmtDate(item.dueDate)})
                </span>
                {item.overdue && (
                  <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold text-destructive-foreground">
                    Atrasada
                  </span>
                )}
              </p>
            </button>
          </li>
        ))}
        {hidden > 0 && (
          <li className="px-4 py-2.5 text-xs text-muted-foreground">
            e mais {hidden}{" "}
            {isOverdue
              ? hidden === 1
                ? "atividade atrasada"
                : "atividades atrasadas"
              : hidden === 1
                ? "atividade para hoje"
                : "atividades para hoje"}
            .
          </li>
        )}
      </ul>
    </section>
  );
}

/**
 * Pop-up que avisa sobre atividades atrasadas e do dia, agrupadas.
 * Cada linha abre o cartão; nada é concluído aqui.
 */
export function PendingCardTasksNotice(props: {
  items: NoticeItem[];
  onClose: () => void;
  onOpenCard: (item: NoticeItem) => void;
}) {
  const overdue = props.items.filter((item) => item.overdue);
  const dueToday = props.items.filter((item) => !item.overdue);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={props.onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-border p-4">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-[oklch(0.72_0.18_60)]" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Atividades atrasadas e do dia ({props.items.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              Abra um cartão para ver a tarefa e o que registrar no histórico.
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          <NoticeGroup
            title="Atrasadas"
            items={overdue}
            tone="overdue"
            onOpenCard={props.onOpenCard}
          />
          <NoticeGroup
            title="Do dia"
            items={dueToday}
            tone="today"
            onOpenCard={props.onOpenCard}
          />
        </div>

        <div className="flex justify-end border-t border-border p-3">
          <Button variant="outline" onClick={props.onClose}>
            Entendi
          </Button>
        </div>
      </div>
    </div>
  );
}
