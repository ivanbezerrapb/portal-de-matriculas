import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  deleteTemplate,
  duplicateTemplate,
  listTemplates,
  saveTemplate,
} from "@/lib/ext/templates.functions";
import { getForm, listForms } from "@/lib/ext/formularios.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import { LayoutEditor } from "@/components/print/LayoutEditor";
import {
  emptyLayout,
  parseLayout,
  type PrintLayout,
} from "@/lib/ext/print-layout";
import type { FormField } from "@/lib/ext/model";
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  Spinner,
} from "@/components/ui";

export const Route = createFileRoute("/_authenticated/templates")({
  component: TemplatesLibraryPage,
});

type Editing = {
  id?: string;
  name: string;
  title: string;
  header_text: string;
  footer_text: string;
  show_logo: boolean;
  columns: 1 | 2;
  page_size: "A4" | "A5";
  show_signature: boolean;
  layout: PrintLayout;
  school_ids: string[];
  ref_form_id: string;
  prev_field_labels: { id: string; label: string }[];
};

const emptyEditing: Editing = {
  name: "",
  title: "",
  header_text: "",
  footer_text: "",
  show_logo: false,
  columns: 1,
  page_size: "A4",
  show_signature: false,
  layout: emptyLayout("A4"),
  school_ids: [],
  ref_form_id: "",
  prev_field_labels: [],
};

function TemplatesLibraryPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Editing | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["template-library"],
    queryFn: () => listTemplates(),
  });
  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: () => listSchools(),
  });
  const { data: forms } = useQuery({
    queryKey: ["admin-forms"],
    queryFn: () => listForms(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["template-library"] });

  const { data: refForm } = useQuery({
    queryKey: ["form", editing?.ref_form_id],
    queryFn: () => getForm({ data: { id: editing!.ref_form_id } }),
    enabled: Boolean(editing?.ref_form_id),
  });
  const refFields = (refForm?.fields ?? []) as FormField[];

  const saveMut = useMutation({
    mutationFn: (t: Editing) =>
      saveTemplate({
        data: {
          ...(t.id ? { id: t.id } : {}),
          name: t.name,
          title: t.title,
          header_text: t.header_text || null,
          footer_text: t.footer_text || null,
          show_logo: t.show_logo,
          columns: t.columns,
          page_size: t.page_size,
          show_signature: t.show_signature,
          layout: t.layout.pages.some((p) => p.blocks.length > 0)
            ? t.layout
            : null,
          field_labels: [
            ...refFields.map((f) => ({ id: f.id, label: f.label })),
            ...t.prev_field_labels.filter(
              (p) => !refFields.some((f) => f.id === p.id),
            ),
          ],
          school_ids: t.school_ids,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        res.applied > 0
          ? `Template salvo e atualizado em ${res.applied} formulário(s).`
          : "Template salvo.",
      );
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dupMut = useMutation({
    mutationFn: (v: { id: string; name: string }) =>
      duplicateTemplate({ data: v }),
    onSuccess: () => {
      toast.success("Template duplicado.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteTemplate({ data: { id } }),
    onSuccess: () => {
      toast.success("Template excluído.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Ao abrir um template sem formulário de referência, sugere o primeiro.
  useEffect(() => {
    if (editing && !editing.ref_form_id && forms && forms.length > 0) {
      setEditing({ ...editing, ref_form_id: forms[0].id });
    }
  }, [editing, forms]);

  const schoolName = (id: string) =>
    (schools ?? []).find((s) => s.id === id)?.name ?? "";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Templates de impressão
          </h1>
          <p className="text-sm text-muted-foreground">
            Modelos reutilizáveis: use em qualquer formulário e marque as
            escolas que devem recebê-los automaticamente.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setEditing({ ...emptyEditing })}
        >
          + Novo template
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {isLoading && <Spinner className="h-5 w-5" />}
        {!isLoading && (templates ?? []).length === 0 && !editing && (
          <Card>
            <p className="text-sm text-muted-foreground">
              Nenhum template ainda. Crie um aqui ou use "Salvar como template"
              dentro de um formulário.
            </p>
          </Card>
        )}
        {(templates ?? []).map((t) => (
          <Card key={t.id} className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{t.name}</p>
              <p className="text-xs text-muted-foreground">
                {t.page_size} · {t.columns} coluna{t.columns > 1 ? "s" : ""}
                {(t.school_ids ?? []).length > 0
                  ? " · " +
                    (t.school_ids as string[]).map(schoolName).join(", ")
                  : " · nenhuma escola marcada"}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                setEditing({
                  id: t.id,
                  name: t.name,
                  title: t.title,
                  header_text: t.header_text ?? "",
                  footer_text: t.footer_text ?? "",
                  show_logo: t.show_logo,
                  columns: t.columns as 1 | 2,
                  page_size: t.page_size as "A4" | "A5",
                  show_signature: t.show_signature,
                  layout:
                    parseLayout(t.layout) ??
                    emptyLayout(t.page_size as "A4" | "A5"),
                  school_ids: (t.school_ids ?? []) as string[],
                  ref_form_id: "",
                  prev_field_labels: ((t.field_labels ?? []) as {
                    id: string;
                    label: string;
                  }[]).map((p) => ({ id: p.id, label: p.label })),
                })
              }
            >
              Editar
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const name = window.prompt(
                  "Nome do novo template:",
                  `Cópia de ${t.name}`,
                );
                if (name?.trim()) dupMut.mutate({ id: t.id, name: name.trim() });
              }}
            >
              Duplicar
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm(`Excluir o template "${t.name}"?`)) {
                  delMut.mutate(t.id);
                }
              }}
            >
              Excluir
            </Button>
          </Card>
        ))}
      </div>

      {editing && (
        <Card className="mt-5">
          <h2 className="font-semibold text-foreground">
            {editing.id ? "Editar template" : "Novo template"}
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nome do template</Label>
              <Input
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
                placeholder="Ex.: Ficha padrão"
              />
            </div>
            <div>
              <Label>Título impresso na ficha</Label>
              <Input
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Texto do cabeçalho (opcional)</Label>
              <Input
                value={editing.header_text}
                onChange={(e) =>
                  setEditing({ ...editing, header_text: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Texto do rodapé (opcional)</Label>
              <Input
                value={editing.footer_text}
                onChange={(e) =>
                  setEditing({ ...editing, footer_text: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Tamanho do papel</Label>
              <Select
                value={editing.page_size}
                onChange={(e) => {
                  const ps = e.target.value as "A4" | "A5";
                  setEditing({
                    ...editing,
                    page_size: ps,
                    layout: { ...editing.layout, pageSize: ps },
                  });
                }}
              >
                <option value="A4">A4</option>
                <option value="A5">A5</option>
              </Select>
            </div>
            <div>
              <Label>Formulário de referência</Label>
              <Select
                value={editing.ref_form_id}
                onChange={(e) =>
                  setEditing({ ...editing, ref_form_id: e.target.value })
                }
              >
                <option value="">Selecione…</option>
                {(forms ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Os campos deste formulário são usados para montar o layout. Em
                outras escolas, os campos são ligados pelo nome.
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-6 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                className="accent-[var(--color-primary)]"
                checked={editing.show_logo}
                onChange={(e) =>
                  setEditing({ ...editing, show_logo: e.target.checked })
                }
              />
              Mostrar logo da escola
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                className="accent-[var(--color-primary)]"
                checked={editing.show_signature}
                onChange={(e) =>
                  setEditing({ ...editing, show_signature: e.target.checked })
                }
              />
              Linha de assinatura
            </label>
          </div>

          <div className="mt-5">
            <Label>Escolas que usam este template</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Ao salvar, uma cópia do template é criada (ou atualizada) nos
              formulários das escolas marcadas.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              {(schools ?? []).map((s) => (
                <label key={s.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-[var(--color-primary)]"
                    checked={editing.school_ids.includes(s.id)}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        school_ids: e.target.checked
                          ? [...editing.school_ids, s.id]
                          : editing.school_ids.filter((x) => x !== s.id),
                      })
                    }
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <Label>Layout da folha</Label>
            {editing.ref_form_id ? (
              <LayoutEditor
                layout={editing.layout}
                onChange={(l) => setEditing({ ...editing, layout: l })}
                fields={refFields}
                formTitle={editing.title || "Formulário"}
                schoolName="Escola"
                formId={editing.ref_form_id}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Escolha um formulário de referência para montar o layout.
              </p>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <Button
              disabled={saveMut.isPending}
              onClick={() => {
                if (!editing.name.trim() || !editing.title.trim()) {
                  toast.error("Preencha o nome e o título do template.");
                  return;
                }
                saveMut.mutate(editing);
              }}
            >
              Salvar template
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
