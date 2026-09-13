import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createFunnel,
  createStage,
  deleteFunnel,
  deleteStage,
  duplicateFunnel,
  listFunnels,
  reorderStages,
  updateFunnel,
  updateStage,
} from "@/lib/ext/funis.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import type { Funnel, FunnelStage } from "@/lib/ext/model";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";

export const Route = createFileRoute("/_authenticated/crm/funil")({
  head: () => ({
    meta: [
      { title: "Funil — Grupo Inter" },
      { name: "description", content: "Crie funis por escola e organize as etapas de atendimento." },
      { property: "og:title", content: "Funil — Grupo Inter" },
      {
        property: "og:description",
        content: "Crie funis por escola e organize as etapas de atendimento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FunilPage,
});

const STAGE_COLORS = [
  "#1e40af",
  "#0284c7",
  "#7c3aed",
  "#d97706",
  "#059669",
  "#dc2626",
  "#475569",
];

type StageDraft = { name: string; description: string; color: string };
const emptyStage: StageDraft = { name: "", description: "", color: STAGE_COLORS[0] };

function StageForm({
  value,
  saving,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  value: StageDraft;
  saving: boolean;
  submitLabel: string;
  onSubmit: (draft: StageDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<StageDraft>(value);
  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
    >
      <div className="flex flex-wrap gap-3">
        <div className="min-w-48 flex-1">
          <Label>Nome da etapa</Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>Cor</Label>
          <div className="flex min-h-11 items-center gap-2">
            {STAGE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor ${c}`}
                onClick={() => setDraft({ ...draft, color: c })}
                className={
                  "h-7 w-7 rounded-full border-2 transition " +
                  (draft.color === c ? "border-foreground" : "border-transparent")
                }
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>
      <div>
        <Label>Descrição</Label>
        <Textarea
          rows={2}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function FunilPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [funnelForm, setFunnelForm] = useState({ school_id: "", name: "", description: "" });
  const [editingFunnel, setEditingFunnel] = useState<string | null>(null);
  const [addingStageIn, setAddingStageIn] = useState<string | null>(null);
  const [editingStage, setEditingStage] = useState<string | null>(null);

  const { data: perms } = useQuery({ queryKey: ["my-permissions"], queryFn: () => getMyPermissions() });
  const isAdmin = perms?.isAdmin ?? false;

  const schoolsQuery = useQuery({ queryKey: ["schools"], queryFn: () => listSchools() });
  const funnelsQuery = useQuery({ queryKey: ["funnels"], queryFn: () => listFunnels() });

  const schools = schoolsQuery.data ?? [];
  const funnels: Funnel[] = funnelsQuery.data?.funnels ?? [];
  const stages: FunnelStage[] = funnelsQuery.data?.stages ?? [];

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["funnels"] });
  }

  function useAction<T>(fn: (input: T) => Promise<unknown>, message: string) {
    return useMutation({
      mutationFn: (input: T) => fn(input),
      onSuccess: () => {
        toast.success(message);
        refresh();
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  const createFunnelM = useAction(
    (d: { school_id: string; name: string; description: string }) => createFunnel({ data: d }),
    "Funil criado.",
  );
  const updateFunnelM = useAction(
    (d: { id: string; school_id: string; name: string; description: string }) =>
      updateFunnel({ data: d }),
    "Funil atualizado.",
  );
  const duplicateFunnelM = useAction(
    (d: { id: string }) => duplicateFunnel({ data: d }),
    "Funil duplicado.",
  );
  const deleteFunnelM = useAction(
    (d: { id: string }) => deleteFunnel({ data: d }),
    "Funil excluído.",
  );
  const createStageM = useAction(
    (d: { funnel_id: string } & StageDraft) => createStage({ data: d }),
    "Etapa adicionada.",
  );
  const updateStageM = useAction(
    (d: { id: string } & StageDraft) => updateStage({ data: d }),
    "Etapa atualizada.",
  );
  const deleteStageM = useAction(
    (d: { id: string }) => deleteStage({ data: d }),
    "Etapa removida.",
  );
  const reorderM = useAction(
    (d: { funnel_id: string; ids: string[] }) => reorderStages({ data: d }),
    "Ordem atualizada.",
  );

  function move(funnelId: string, list: FunnelStage[], index: number, delta: number) {
    const next = [...list];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const a = next[index];
    next[index] = next[target];
    next[target] = a;
    reorderM.mutate({ funnel_id: funnelId, ids: next.map((s) => s.id) });
  }

  const loading = funnelsQuery.isLoading || schoolsQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">CRM</p>
          <h1 className="font-display text-2xl font-bold text-foreground">Funil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada escola pode ter seus próprios funis com etapas de atendimento.
          </p>
        </div>
        {isAdmin && !creating && (
          <Button
            onClick={() => {
              setFunnelForm({ school_id: schools[0]?.id ?? "", name: "", description: "" });
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4" /> Novo funil
          </Button>
        )}
      </div>

      {creating && (
        <Card>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createFunnelM.mutate(funnelForm, { onSuccess: () => setCreating(false) });
            }}
          >
            <div className="flex flex-wrap gap-3">
              <div className="min-w-48 flex-1">
                <Label>Nome do funil</Label>
                <Input
                  value={funnelForm.name}
                  onChange={(e) => setFunnelForm({ ...funnelForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="min-w-48 flex-1">
                <Label>Escola</Label>
                <Select
                  value={funnelForm.school_id}
                  onChange={(e) => setFunnelForm({ ...funnelForm, school_id: e.target.value })}
                  required
                >
                  <option value="">Selecione…</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                rows={2}
                value={funnelForm.description}
                onChange={(e) => setFunnelForm({ ...funnelForm, description: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={createFunnelM.isPending}>
                Criar funil
              </Button>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : funnels.length === 0 ? (
        <EmptyState
          title="Nenhum funil criado"
          description={
            isAdmin
              ? "Crie o primeiro funil para organizar as etapas de atendimento da escola."
              : "Nenhum funil disponível para a sua escola por enquanto."
          }
        />
      ) : (
        <div className="space-y-4">
          {funnels.map((funnel) => {
            const funnelStages = stages
              .filter((s) => s.funnel_id === funnel.id)
              .sort((a, b) => a.position - b.position);
            const school = schools.find((s) => s.id === funnel.school_id);
            return (
              <Card key={funnel.id}>
                {editingFunnel === funnel.id ? (
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget as HTMLFormElement;
                      const fd = new FormData(form);
                      updateFunnelM.mutate(
                        {
                          id: funnel.id,
                          name: String(fd.get("name") ?? ""),
                          school_id: String(fd.get("school_id") ?? ""),
                          description: String(fd.get("description") ?? ""),
                        },
                        { onSuccess: () => setEditingFunnel(null) },
                      );
                    }}
                  >
                    <div className="flex flex-wrap gap-3">
                      <div className="min-w-48 flex-1">
                        <Label>Nome do funil</Label>
                        <Input name="name" defaultValue={funnel.name} required />
                      </div>
                      <div className="min-w-48 flex-1">
                        <Label>Escola</Label>
                        <Select name="school_id" defaultValue={funnel.school_id} required>
                          {schools.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea name="description" rows={2} defaultValue={funnel.description ?? ""} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={updateFunnelM.isPending}>
                        Salvar
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setEditingFunnel(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-foreground">
                        {funnel.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {school?.name ?? "Escola não encontrada"}
                        {funnel.description ? ` · ${funnel.description}` : ""}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          aria-label="Editar funil"
                          onClick={() => setEditingFunnel(funnel.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label="Duplicar funil"
                          onClick={() => duplicateFunnelM.mutate({ id: funnel.id })}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label="Excluir funil"
                          onClick={() => {
                            if (confirm(`Excluir o funil "${funnel.name}" e suas etapas?`))
                              deleteFunnelM.mutate({ id: funnel.id });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  {funnelStages.map((stage, index) =>
                    editingStage === stage.id ? (
                      <StageForm
                        key={stage.id}
                        value={{
                          name: stage.name,
                          description: stage.description ?? "",
                          color: stage.color,
                        }}
                        saving={updateStageM.isPending}
                        submitLabel="Salvar etapa"
                        onCancel={() => setEditingStage(null)}
                        onSubmit={(draft) =>
                          updateStageM.mutate(
                            { id: stage.id, ...draft },
                            { onSuccess: () => setEditingStage(null) },
                          )
                        }
                      />
                    ) : (
                      <div
                        key={stage.id}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2"
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <div className="min-w-40 flex-1">
                          <p className="text-sm font-semibold text-foreground">{stage.name}</p>
                          {stage.description && (
                            <p className="text-xs text-muted-foreground">{stage.description}</p>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              aria-label="Mover para cima"
                              disabled={index === 0}
                              onClick={() => move(funnel.id, funnelStages, index, -1)}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              aria-label="Mover para baixo"
                              disabled={index === funnelStages.length - 1}
                              onClick={() => move(funnel.id, funnelStages, index, 1)}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              aria-label="Editar etapa"
                              onClick={() => setEditingStage(stage.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              aria-label="Remover etapa"
                              onClick={() => deleteStageM.mutate({ id: stage.id })}
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ),
                  )}

                  {isAdmin &&
                    (addingStageIn === funnel.id ? (
                      <StageForm
                        value={emptyStage}
                        saving={createStageM.isPending}
                        submitLabel="Adicionar etapa"
                        onCancel={() => setAddingStageIn(null)}
                        onSubmit={(draft) =>
                          createStageM.mutate(
                            { funnel_id: funnel.id, ...draft },
                            { onSuccess: () => setAddingStageIn(null) },
                          )
                        }
                      />
                    ) : (
                      <Button variant="outline" onClick={() => setAddingStageIn(funnel.id)}>
                        <Plus className="h-4 w-4" /> Adicionar etapa
                      </Button>
                    ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
