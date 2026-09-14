import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createPresenter,
  deletePresenter,
  listPresenters,
  updatePresenter,
  type Presenter,
  type PresenterKind,
} from "@/lib/ext/apresentacao.functions";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import { Button, Card, EmptyState, Input, Label, Select, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/apresentacao")({
  head: () => ({
    meta: [
      { title: "Apresentação — Grupo Inter" },
      {
        name: "description",
        content: "Cadastre quem atendeu na secretaria e quem apresentou a escola.",
      },
      { property: "og:title", content: "Apresentação — Grupo Inter" },
      {
        property: "og:description",
        content: "Cadastre quem atendeu na secretaria e quem apresentou a escola.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PresentersPage,
});

function PresentersPage() {
  const [schoolId, setSchoolId] = useState("");

  const { data: perms } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => getMyPermissions(),
  });
  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: () => listSchools(),
  });

  const allowedSchools = (schools ?? []).filter(
    (s) => perms?.isAdmin || perms?.managerSchools.includes(s.id),
  );

  useEffect(() => {
    if (!schoolId && allowedSchools.length > 0) {
      const first = allowedSchools[0];
      if (first) setSchoolId(first.id);
    }
  }, [allowedSchools, schoolId]);

  const { data: presenters, isLoading } = useQuery({
    queryKey: ["presenters", schoolId],
    queryFn: () => listPresenters({ data: { school_id: schoolId } }),
    enabled: !!schoolId,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Apresentação</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nomes usados nos cadastros: quem atendeu na secretaria e quem apresentou a escola.
          </p>
        </div>
        <div className="w-56">
          <Label htmlFor="p-school">Unidade</Label>
          <Select
            id="p-school"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            disabled={allowedSchools.length <= 1}
          >
            {allowedSchools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <KindCard
            title="Secretaria (quem atendeu)"
            kind="secretaria"
            schoolId={schoolId}
            rows={(presenters ?? []).filter((p) => p.kind === "secretaria")}
          />
          <KindCard
            title="Coordenação (quem apresentou)"
            kind="coordenacao"
            schoolId={schoolId}
            rows={(presenters ?? []).filter((p) => p.kind === "coordenacao")}
          />
        </div>
      )}
    </div>
  );
}

function KindCard({
  title,
  kind,
  schoolId,
  rows,
}: {
  title: string;
  kind: PresenterKind;
  schoolId: string;
  rows: Presenter[];
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["presenters"] });
    queryClient.invalidateQueries({ queryKey: ["submissions"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  const createM = useMutation({
    mutationFn: () => createPresenter({ data: { school_id: schoolId, kind, name } }),
    onSuccess: () => {
      setName("");
      toast.success("Nome cadastrado.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateM = useMutation({
    mutationFn: (d: { id: string; name?: string; active?: boolean }) =>
      updatePresenter({ data: d }),
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deletePresenter({ data: { id } }),
    onSuccess: () => {
      toast.success("Nome removido.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length < 2 || !schoolId) return;
          createM.mutate();
        }}
      >
        <div className="flex-1">
          <Label htmlFor={`new-${kind}`}>Novo nome</Label>
          <Input
            id={`new-${kind}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Maria Silva"
          />
        </div>
        <Button type="submit" disabled={createM.isPending || name.trim().length < 2}>
          Adicionar
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Nenhum nome cadastrado" description="Adicione o primeiro nome acima." />
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-2">
              {editing?.id === p.id ? (
                <>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ id: p.id, name: e.target.value })}
                  />
                  <Button
                    disabled={updateM.isPending || editing.name.trim().length < 2}
                    onClick={() => updateM.mutate({ id: p.id, name: editing.name })}
                  >
                    Salvar
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <span
                    className={`flex-1 text-sm ${p.active ? "text-foreground" : "text-muted-foreground line-through"}`}
                  >
                    {p.name}
                  </span>
                  <Button variant="ghost" onClick={() => setEditing({ id: p.id, name: p.name })}>
                    Renomear
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => updateM.mutate({ id: p.id, active: !p.active })}
                  >
                    {p.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Remover "${p.name}"?`)) deleteM.mutate(p.id);
                    }}
                  >
                    Excluir
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
