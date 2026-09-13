import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listSubmissions } from "@/lib/ext/cadastros.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import { listForms } from "@/lib/ext/formularios.functions";
import { listPrintTemplates } from "@/lib/ext/impressao.functions";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Select,
  Spinner,
} from "@/components/ui";

export const Route = createFileRoute("/_authenticated/cadastros")({
  component: SubmissionsPage,
});

function SubmissionsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [formId, setFormId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printTemplateId, setPrintTemplateId] = useState("");

  const { data: perms } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => getMyPermissions(),
  });
  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: () => listSchools(),
  });
  const { data: forms } = useQuery({
    queryKey: ["admin-forms"],
    queryFn: () => listForms(),
  });

  const filters = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(schoolId ? { school_id: schoolId } : {}),
    ...(formId ? { form_id: formId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["submissions", filters],
    queryFn: () => listSubmissions({ data: filters }),
  });

  // Modelos de impressão do formulário dos itens selecionados (precisam ser do mesmo formulário)
  const selectedRows = (submissions ?? []).filter((s) => selected.has(s.id));
  const selectedFormIds = new Set(selectedRows.map((s) => s.form_id));
  const singleFormId =
    selectedFormIds.size === 1 ? [...selectedFormIds][0] : undefined;

  const { data: templates } = useQuery({
    queryKey: ["print-templates", singleFormId],
    queryFn: () => listPrintTemplates({ data: { form_id: singleFormId! } }),
    enabled: !!singleFormId,
  });

  const canPrint =
    (perms?.isAdmin ||
      perms?.isEditor ||
      (perms?.managerSchools.length ?? 0) > 0 ||
      (perms?.operatorSchools.length ?? 0) > 0) ??
    false;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-foreground">
        Cadastros
      </h1>

      <Card className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Label htmlFor="q">Buscar por ID</Label>
            <Input
              id="q"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ex.: ESCA-0001"
            />
          </div>
          <div>
            <Label htmlFor="f-school">Escola</Label>
            <Select
              id="f-school"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
            >
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
            <Select
              id="f-form"
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
            >
              <option value="">Todos</option>
              {(forms ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
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
              <Input
                id="f-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {selected.size > 0 && (
        <Card className="mt-4 flex flex-wrap items-center gap-3 border-primary/40">
          <p className="text-sm font-medium text-foreground">
            {selected.size} selecionado{selected.size > 1 ? "s" : ""}
          </p>
          {selectedFormIds.size > 1 ? (
            <p className="text-sm text-muted-foreground">
              Para imprimir em lote, selecione cadastros do mesmo formulário.
            </p>
          ) : canPrint ? (
            <>
              <Select
                value={printTemplateId}
                onChange={(e) => setPrintTemplateId(e.target.value)}
                className="w-56"
              >
                <option value="">Modelo de impressão...</option>
                {(templates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Button
                disabled={!printTemplateId}
                onClick={() =>
                  navigate({
                    to: "/imprimir/$templateId",
                    params: { templateId: printTemplateId },
                    search: { ids: [...selected].join(",") },
                  })
                }
              >
                Imprimir selecionados
              </Button>
            </>
          ) : null}
          <Button variant="ghost" onClick={() => setSelected(new Set())}>
            Limpar seleção
          </Button>
        </Card>
      )}

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : !submissions || submissions.length === 0 ? (
        <EmptyState
          title="Nenhum cadastro encontrado"
          description="Ajuste os filtros ou aguarde novos envios pelo link público."
        />
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Formulário</th>
                <th className="px-4 py-3">Escola</th>
                <th className="px-4 py-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => {
                const form = s.forms as unknown as { title: string } | null;
                const school = s.schools as unknown as { name: string } | null;
                return (
                  <tr
                    key={s.id}
                    className="border-b border-border last:border-0 hover:bg-accent/40"
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        className="accent-[var(--color-primary)]"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                        aria-label={`Selecionar ${s.public_id}`}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        to="/cadastros/$submissionId"
                        params={{ submissionId: s.id }}
                        className="font-mono font-medium text-primary hover:underline"
                      >
                        {s.public_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">
                      {form?.title ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {school?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString("pt-BR")}
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
