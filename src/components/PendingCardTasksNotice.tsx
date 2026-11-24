import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import type { NoticeItem } from "@/lib/ext/task-notice";

const MAX_ROWS = 15;

function fmtDate(due: string) {
  return new Date(`${due}T00:00:00`).toLocaleDateString("pt-BR");
}

/**
 * Pop-up que só avisa: estes cartões têm tarefas pendentes.
 * Cada linha abre o cartão; nada é concluído aqui.
 */
export function PendingCardTasksNotice(props: {
  items: NoticeItem[];
  onClose: () => void;
  onOpenCard: (item: NoticeItem) => void;
}) {
  const shown = props.items.slice(0, MAX_ROWS);
  const hidden = props.items.length - shown.length;

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
              Cartões com tarefas pendentes ({props.items.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              Abra um cartão para ver a tarefa e o que registrar no histórico.
            </p>
          </div>
        </div>

        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {shown.map((item) => (
            <li key={item.taskId}>
              <button
                type="button"
                className="w-full px-4 py-3 text-left hover:bg-muted/60"
                onClick={() => props.onOpenCard(item)}
              >
                <p className="break-words text-sm font-semibold text-foreground">
                  {item.cardName}
                </p>
                <p className="mt-0.5 break-words text-xs text-muted-foreground">
                  {item.funnelName}
                  {item.schoolName ? ` · ${item.schoolName}` : ""}
                  {item.ownerName ? ` · ${item.ownerName}` : ""}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {item.taskTitle}
                  {item.dueDate ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({fmtDate(item.dueDate)})
                    </span>
                  ) : null}
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
            <li className="px-4 py-3 text-xs text-muted-foreground">
              e mais {hidden} {hidden === 1 ? "cartão" : "cartões"} com tarefa pendente.
            </li>
          )}
        </ul>

        <div className="flex justify-end border-t border-border p-3">
          <Button variant="outline" onClick={props.onClose}>
            Entendi
          </Button>
        </div>
      </div>
    </div>
  );
}
