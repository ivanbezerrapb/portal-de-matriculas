import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import { PendingAttendanceSection, usePendingAttendance } from "@/components/PendingAttendanceDialog";
import { PendingFunnelSection, usePendingFunnel } from "@/components/PendingFunnelDialog";

const SNOOZE_KEY = "pending-tasks-snooze";
const SNOOZE_MS = 60 * 60 * 1000;
type Tab = "agenda" | "funil";

export function PendingTasksDialog({ enabled }: { enabled: boolean }) {
  const { data: att = [] } = usePendingAttendance(enabled);
  const { data: fun } = usePendingFunnel(enabled);
  const nA = att.length;
  const nF = Array.isArray(fun) ? fun.length : 0;
  const total = nA + nF;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("agenda");

  useEffect(() => {
    if (!total) { setOpen(false); return; }
    if (!open && Date.now() >= Number(localStorage.getItem(SNOOZE_KEY) ?? 0)) {
      setTab(nA ? "agenda" : "funil");
      setOpen(true);
    }
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !total) return null;
  const snooze = () => { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); setOpen(false); };
  const tabBtn = (t: Tab, label: string, n: number) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
    >
      {label}
      <span className={`rounded-full px-2 text-xs ${n ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}`}>{n}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-start gap-3 border-b border-border p-4">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-[oklch(0.72_0.18_60)]" />
          <div>
            <h2 className="text-lg font-semibold">Pendências ({total})</h2>
            <p className="text-sm text-muted-foreground">Resolva os itens de cada aba.</p>
          </div>
        </div>
        <div className="flex border-b border-border">
          {tabBtn("agenda", "Agendamentos sem resposta", nA)}
          {tabBtn("funil", "Visitas sem funil", nF)}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {tab === "agenda" ? <PendingAttendanceSection enabled={enabled} /> : <PendingFunnelSection enabled={enabled} />}
        </div>
        <div className="flex justify-end border-t border-border p-3">
          <Button variant="outline" onClick={snooze}>Lembrar depois</Button>
        </div>
      </div>
    </div>
  );
}
