import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listPortfolioSummary, transferFunnelPortfolio } from "@/lib/ext/pipeline.functions";
import { Button, Label, Select, Spinner, Textarea } from "@/components/ui";

const UNASSIGNED_KEY = "__unassigned__";

export function TransferPortfolioDialog({
  funnelId,
  funnelName,
  onDone,
}: {
  funnelId: string;
  funnelName: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fromKey, setFromKey] = useState("");
  const [toId, setToId] = useState("");
  const [note, setNote] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["portfolio-summary", funnelId],
    queryFn: () => listPortfolioSummary({ data: { funnel_id: funnelId } }),
    enabled: open,
  });

  const sources = summaryQuery.data?.sources ?? [];
  const targets = summaryQuery.data?.targets ?? [];
  const selectedSource = sources.find(
    (s) => (s.owner_id ?? UNASSIGNED_KEY) === fromKey,
  );
  const availableTargets = targets.filter((t) => t.user_id !== fromKey);
  const selectedTarget = availableTargets.find((t) => t.user_id === toId);

  const mutation = useMutation({
    mutationFn: () =>
      transferFunnelPortfolio({
        data: {
          funnel_id: funnelId,
          from_owner_id: fromKey === UNASSIGNED_KEY ? null : fromKey,
          to_owner_id: toId,
          note: note.trim() || null,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        `${res.count} ${res.count === 1 ? "oportunidade transferida" : "oportunidades transferidas"} para ${res.to_name}.`,
      );
      setOpen(false);
      setFromKey("");
      setToId("");
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-notes"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["portfolio-summary", funnelId] });
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível transferir a carteira."),
  });

  function close() {
    if (mutation.isPending) return;
    setOpen(false);
    setFromKey("");
    setToId("");
    setNote("");
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Transferir carteira
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-foreground">Transferir carteira no funil</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Transfere todas as oportunidades abertas do funil{" "}
              <span className="font-medium text-foreground">{funnelName}</span> para outro atendente
              com permissão neste funil.
            </p>

            {summaryQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : summaryQuery.isError ? (
              <p className="mt-4 text-sm text-destructive">
                {summaryQuery.error instanceof Error
                  ? summaryQuery.error.message
                  : "Erro ao carregar os atendentes."}
              </p>
            ) : sources.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Não há oportunidades abertas neste funil para transferir.
              </p>
            ) : (
              <>
                <div className="mt-4">
                  <Label htmlFor="portfolio-from">Atendente de origem</Label>
                  <Select
                    id="portfolio-from"
                    value={fromKey}
                    onChange={(e) => {
                      const next = e.target.value;
                      setFromKey(next);
                      if (next === toId) setToId("");
                    }}
                  >
                    <option value="">Selecione quem sai…</option>
                    {sources.map((s) => {
                      const key = s.owner_id ?? UNASSIGNED_KEY;
                      return (
                        <option key={key} value={key}>
                          {s.name} ({s.count} {s.count === 1 ? "cartão" : "cartões"})
                        </option>
                      );
                    })}
                  </Select>
                </div>

                <div className="mt-3">
                  <Label htmlFor="portfolio-to">Atendente de destino</Label>
                  <Select
                    id="portfolio-to"
                    value={toId}
                    disabled={!fromKey || availableTargets.length === 0}
                    onChange={(e) => setToId(e.target.value)}
                  >
                    <option value="">Selecione quem assume…</option>
                    {availableTargets.map((t) => (
                      <option key={t.user_id} value={t.user_id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                  {fromKey && availableTargets.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Não há outro atendente com permissão neste funil.
                    </p>
                  )}
                </div>

                <div className="mt-3">
                  <Label htmlFor="portfolio-note">Observação (opcional)</Label>
                  <Textarea
                    id="portfolio-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={300}
                    rows={2}
                    placeholder="Ex.: cobertura de férias"
                  />
                </div>

                {selectedSource && selectedTarget && (
                  <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-foreground">
                    Serão transferidas{" "}
                    <strong>
                      {selectedSource.count}{" "}
                      {selectedSource.count === 1 ? "oportunidade aberta" : "oportunidades abertas"}
                    </strong>{" "}
                    de <strong>{selectedSource.name}</strong> para{" "}
                    <strong>{selectedTarget.name}</strong>.
                  </p>
                )}
              </>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={close} disabled={mutation.isPending}>
                Cancelar
              </Button>
              <Button
                disabled={!selectedSource || !selectedTarget || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? "Transferindo…" : "Transferir carteira"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}