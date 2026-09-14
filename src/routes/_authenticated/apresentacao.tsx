import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listPresenters,
  type Presenter,
  type PresenterKind,
} from "@/lib/ext/apresentacao.functions";
import {
  getMyPermissions,
  listSubmissions,
  setSubmissionPeople,
} from "@/lib/ext/cadastros.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import { listForms } from "@/lib/ext/formularios.functions";
import { Card, EmptyState, Input, Label, Select, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/apresentacao")({
  head: () => ({
    meta: [
      { title: "Apresentação — Grupo Inter" },
      {
        name: "description",
        content: "Informe quem atendeu na secretaria e quem apresentou a escola.",
      },
      { property: "og:title", content: "Apresentação — Grupo Inter" },
      {
        property: "og:description",
        content: "Informe quem atendeu na secretaria e quem apresentou a escola.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApresentacaoPage,
});

function ApresentacaoPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [formId, setFormId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filters = {
    search: search || undefined,
    school_id: schoolId || undefined,
    form_id: formId || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const { data: perms } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => getMyPermissions(),
  });
  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: () => listSchools(),
  });
  const { data: forms } = useQuery({
    queryKey: ["forms"],
    queryFn: () => listForms(),
  });

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["submissions", filters],
    queryFn: () => listSubmissions({ data: filters }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const { data: presenters } = useQuery({
    queryKey: ["presenters"],
    queryFn: () => listPresenters({ data: { only_active: true } }),
  });

  const peopleM = useMutation({
    mutationFn: (d: {
      submission_id: string;
      kind: PresenterKind;
      presenter_id?: string | null;
      new_name?: string;
    }) => setSubmissionPeople({ data: d }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["presenters"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function canEdit(rowSchoolId: string) {
    return Boolean(perms?.isAdmin || perms?.managerSchools.includes(rowSchoolId));
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-foreground">Apresentação</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Informe quem atendeu na secretaria e quem apresentou a escola em cada cadastro.
      </p>

      <Card className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Label htmlFor="q">Buscar por ID</Label>
            <Input
              id="q"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ex.: 0001/ESCA"
            />
          </div>
          <div>
            <Label htmlFor="f-school">Escola</Label>
            <Select id="f-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              <option value="">Todas</option>
              {(schools ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="f-form">Formulário</Label>
            <Select id="f-form" value={formId} onChange={(e) => setFormId(e.target.value)}>
              <option value="">Todos</option>
              {(forms ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="f-from">De</Label>
              <Input
                id="f-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="f-to">Até</Label>
              <Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : !submissions || submissions.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nenhum cadastro encontrado"
            description="Ajuste os filtros ou aguarde novos envios pelo link público."
          />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Quem atendeu</th>
                <th className="px-4 py-3">Quem apresentou</th>
                <th className="px-4 py-3">Status matrícula</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => {
                const responsible = (s as unknown as { responsible_name: string | null })
                  .responsible_name;
                const enrolled = Boolean((s as unknown as { enrolled?: boolean }).enrolled);
                const enrolledCount = Number(
                  (s as unknown as { enrollment_count?: number }).enrollment_count ?? 0,
                );
                const editable = canEdit(s.school_id) && !peopleM.isPending;
                return (
                  <tr
                    key={s.id}
                    className="border-b border-border last:border-0 hover:bg-accent/40"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        to="/cadastros/$submissionId"
                        params={{ submissionId: s.id }}
                        className="font-mono font-medium text-primary hover:underline"
                      >
                        {s.public_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{responsible ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <PersonCell
                        kind="secretaria"
                        current={
                          (s as unknown as { attendant: { name?: string } | null }).attendant
                            ?.name ?? null
                        }
                        options={(presenters ?? []).filter(
                          (p) => p.school_id === s.school_id && p.kind === "secretaria",
                        )}
                        disabled={!editable}
                        onPick={(value) =>
                          peopleM.mutate({ submission_id: s.id, kind: "secretaria", ...value })
                        }
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <PersonCell
                        kind="coordenacao"
                        current={
                          (s as unknown as { presenter: { name?: string } | null }).presenter
                            ?.name ?? null
                        }
                        options={(presenters ?? []).filter(
                          (p) => p.school_id === s.school_id && p.kind === "coordenacao",
                        )}
                        disabled={!editable}
                        onPick={(value) =>
                          peopleM.mutate({ submission_id: s.id, kind: "coordenacao", ...value })
                        }
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      {enrolled ? (
                        <span className="font-medium text-emerald-600">
                          Ativo · {enrolledCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PersonCell({
  kind,
  current,
  options,
  disabled,
  onPick,
}: {
  kind: PresenterKind;
  current: string | null;
  options: Presenter[];
  disabled: boolean;
  onPick: (value: { presenter_id?: string | null; new_name?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  if (disabled) {
    return <span className="text-muted-foreground">{current ?? "—"}</span>;
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setText(current ?? "");
          setOpen(true);
        }}
        className="rounded-md px-2 py-1 text-left text-sm text-foreground hover:bg-accent"
      >
        {current ?? <span className="text-muted-foreground">—</span>}
      </button>
    );
  }

  const query = text.trim().toLowerCase();
  const matches = options.filter((o) => o.name.toLowerCase().includes(query));
  const exact = options.find((o) => o.name.toLowerCase() === query);

  return (
    <div className="relative w-44">
      <Input
        autoFocus
        value={text}
        placeholder={kind === "secretaria" ? "Quem atendeu" : "Quem apresentou"}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
        {matches.map((o) => (
          <button
            key={o.id}
            className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
            onMouseDown={(e) => {
              e.preventDefault();
              onPick({ presenter_id: o.id });
              setOpen(false);
            }}
          >
            {o.name}
          </button>
        ))}
        {query.length >= 2 && !exact && (
          <button
            className="block w-full px-3 py-1.5 text-left text-sm font-medium text-primary hover:bg-accent"
            onMouseDown={(e) => {
              e.preventDefault();
              onPick({ new_name: text.trim() });
              setOpen(false);
            }}
          >
            Cadastrar «{text.trim()}»
          </button>
        )}
        {current && (
          <button
            className="block w-full px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
            onMouseDown={(e) => {
              e.preventDefault();
              onPick({ presenter_id: null });
              setOpen(false);
            }}
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}
