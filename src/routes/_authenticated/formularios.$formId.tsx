import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  deletePrintTemplate,
  getForm,
  saveFormFields,
  savePrintTemplate,
  setFormStatus,
  updateFormInfo,
} from "@/lib/ext/formularios.functions";
import {
  FIELD_TYPE_LABELS,
  type FieldType,
  type FormField,
  type PrintTemplate,
} from "@/lib/ext/model";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";

export const Route = createFileRoute("/_authenticated/formularios/$formId")({
  component: FormConfigPage,
});

const FIELD_TYPES = Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][];
const NEEDS_OPTIONS: FieldType[] = ["single_choice", "multiple_choice"];

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  closed: "Encerrado",
};
const STATUS_COLOR: Record<string, "amber" | "green" | "muted"> = {
  draft: "amber",
  published: "green",
  closed: "muted",
};

type EditableField = Omit<FormField, "form_id">;

function FormConfigPage() {
  const { formId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["form", formId],
    queryFn: () => getForm({ data: { id: formId } }),
  });
  const [tab, setTab] = useState<"campos" | "impressao" | "publicar">(
    "campos",
  );

  if (isLoading || !data) {
    return (
      <div className="mt-10 flex justify-center">
        <Spinner />
      </div>
    );
  }

  const school = data.form.schools as unknown as { name: string } | null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to="/formularios"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Voltar para formulários
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-foreground">
          {data.form.title}
        </h1>
        <Badge color={STATUS_COLOR[data.form.status] ?? "muted"}>
          {STATUS_LABEL[data.form.status] ?? data.form.status}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{school?.name ?? ""}</p>

      <div className="mt-6 flex gap-1 border-b border-border">
        {(
          [
            ["campos", "Campos"],
            ["impressao", "Modelos de impressão"],
            ["publicar", "Publicar"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "campos" && (
        <FieldsTab formId={formId} initialFields={data.fields as FormField[]} />
      )}
      {tab === "impressao" && (
        <TemplatesTab
          formId={formId}
          fields={data.fields as FormField[]}
          templates={data.templates as PrintTemplate[]}
        />
      )}
      {tab === "publicar" && (
        <PublishTab
          formId={formId}
          form={data.form}
          onChanged={() =>
            queryClient.invalidateQueries({ queryKey: ["form", formId] })
          }
        />
      )}
    </div>
  );
}

// ---------- Aba Campos ----------

function FieldsTab({
  formId,
  initialFields,
}: {
  formId: string;
  initialFields: FormField[];
}) {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<EditableField[]>(
    initialFields.map(({ ...f }) => f),
  );
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFormFields({
        data: {
          form_id: formId,
          fields: fields.map((f, i) => ({
            id: f.id,
            label: f.label,
            help_text: f.help_text,
            type: f.type,
            options: f.options,
            required: f.required,
            internal: f.internal,
            position: i,
          })),
          deleted_ids: deletedIds,
        },
      }),
    onSuccess: () => {
      toast.success("Campos salvos.");
      setDeletedIds([]);
      queryClient.invalidateQueries({ queryKey: ["form", formId] });
    },
    onError: (e) => toast.error(e.message),
  });

  function updateField(id: string, patch: Partial<EditableField>) {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  }

  function move(id: string, dir: -1 | 1) {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const item = next[idx];
      next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Campos internos não aparecem no link público — só a equipe preenche.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              setFields((prev) => [
                ...prev,
                {
                  id: `new-${crypto.randomUUID()}`,
                  label: "",
                  help_text: null,
                  type: "short_text",
                  options: null,
                  required: false,
                  internal: false,
                  position: prev.length,
                },
              ])
            }
          >
            + Adicionar campo
          </Button>
          <Button
            onClick={() => {
              if (fields.some((f) => !f.label.trim())) {
                toast.error("Preencha o nome de todos os campos.");
                return;
              }
              saveMut.mutate();
            }}
            disabled={saveMut.isPending}
          >
            Salvar campos
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {fields.length === 0 && (
          <Card>
            <p className="text-sm text-muted-foreground">
              Nenhum campo ainda. Clique em "Adicionar campo".
            </p>
          </Card>
        )}
        {fields.map((field, idx) => (
          <Card key={field.id}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1">
                <Label>Nome do campo</Label>
                <Input
                  value={field.label}
                  onChange={(e) =>
                    updateField(field.id, { label: e.target.value })
                  }
                  placeholder="Ex.: Nome do aluno"
                />
              </div>
              <div className="w-44">
                <Label>Tipo</Label>
                <Select
                  value={field.type}
                  onChange={(e) => {
                    const type = e.target.value as FieldType;
                    updateField(field.id, {
                      type,
                      options: NEEDS_OPTIONS.includes(type)
                        ? (field.options ?? [])
                        : null,
                    });
                  }}
                >
                  {FIELD_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-4 pb-2 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-[var(--color-primary)]"
                    checked={field.required}
                    onChange={(e) =>
                      updateField(field.id, { required: e.target.checked })
                    }
                  />
                  Obrigatório
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-[var(--color-primary)]"
                    checked={field.internal}
                    onChange={(e) =>
                      updateField(field.id, { internal: e.target.checked })
                    }
                  />
                  Campo interno
                </label>
              </div>
              <div className="flex gap-1 pb-1">
                <Button
                  variant="ghost"
                  onClick={() => move(field.id, -1)}
                  disabled={idx === 0}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => move(field.id, 1)}
                  disabled={idx === fields.length - 1}
                >
                  ↓
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (!field.id.startsWith("new-")) {
                      setDeletedIds((prev) => [...prev, field.id]);
                    }
                    setFields((prev) => prev.filter((f) => f.id !== field.id));
                  }}
                >
                  Excluir
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <div className="min-w-48 flex-1">
                <Label>Texto de ajuda (opcional)</Label>
                <Input
                  value={field.help_text ?? ""}
                  onChange={(e) =>
                    updateField(field.id, { help_text: e.target.value || null })
                  }
                  placeholder="Ex.: Como está no documento oficial"
                />
              </div>
              {NEEDS_OPTIONS.includes(field.type) && (
                <div className="min-w-48 flex-1">
                  <Label>Opções (uma por linha)</Label>
                  <Textarea
                    rows={3}
                    value={(field.options ?? []).join("\n")}
                    onChange={(e) =>
                      updateField(field.id, {
                        options: e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- Aba Modelos de impressão ----------

const emptyTemplate = {
  name: "",
  title: "",
  header_text: "",
  footer_text: "",
  show_logo: true,
  columns: 1 as 1 | 2,
  page_size: "A4" as "A4" | "A5",
  show_signature: true,
  field_ids: [] as string[],
};

function TemplatesTab({
  formId,
  fields,
  templates,
}: {
  formId: string;
  fields: FormField[];
  templates: PrintTemplate[];
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<
    (typeof emptyTemplate & { id?: string }) | null
  >(null);

  const saveMut = useMutation({
    mutationFn: (t: typeof emptyTemplate & { id?: string }) =>
      savePrintTemplate({
        data: {
          ...(t.id ? { id: t.id } : {}),
          form_id: formId,
          name: t.name,
          title: t.title,
          header_text: t.header_text || null,
          footer_text: t.footer_text || null,
          show_logo: t.show_logo,
          columns: t.columns,
          page_size: t.page_size,
          show_signature: t.show_signature,
          field_ids: t.field_ids,
        },
      }),
    onSuccess: () => {
      toast.success("Modelo salvo.");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["form", formId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePrintTemplate({ data: { id } }),
    onSuccess: () => {
      toast.success("Modelo excluído.");
      queryClient.invalidateQueries({ queryKey: ["form", formId] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Monte como a ficha impressa vai sair: quais campos, em qual ordem e
          com qual layout.
        </p>
        <Button
          variant="secondary"
          onClick={() =>
            setEditing({
              ...emptyTemplate,
              field_ids: fields.map((f) => f.id),
            })
          }
        >
          + Novo modelo
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {templates.length === 0 && !editing && (
          <Card>
            <p className="text-sm text-muted-foreground">
              Nenhum modelo ainda. Clique em "Novo modelo".
            </p>
          </Card>
        )}
        {templates.map((t) => (
          <Card key={t.id} className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{t.name}</p>
              <p className="text-xs text-muted-foreground">
                {t.page_size} · {t.columns} coluna{t.columns > 1 ? "s" : ""} ·{" "}
                {(t.field_ids ?? []).length} campos
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
                  columns: t.columns,
                  page_size: t.page_size,
                  show_signature: t.show_signature,
                  field_ids: t.field_ids ?? [],
                })
              }
            >
              Editar
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm(`Excluir o modelo "${t.name}"?`)) {
                  deleteMut.mutate(t.id);
                }
              }}
            >
              Excluir
            </Button>
          </Card>
        ))}
      </div>

      {editing && (
        <Card className="mt-4">
          <h3 className="font-semibold text-foreground">
            {editing.id ? "Editar modelo" : "Novo modelo"}
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nome do modelo</Label>
              <Input
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
                placeholder="Ex.: Ficha do aluno"
              />
            </div>
            <div>
              <Label>Título impresso na ficha</Label>
              <Input
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
                placeholder="Ex.: Ficha de Matrícula"
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
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    page_size: e.target.value as "A4" | "A5",
                  })
                }
              >
                <option value="A4">A4</option>
                <option value="A5">A5</option>
              </Select>
            </div>
            <div>
              <Label>Colunas</Label>
              <Select
                value={String(editing.columns)}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    columns: Number(e.target.value) as 1 | 2,
                  })
                }
              >
                <option value="1">1 coluna</option>
                <option value="2">2 colunas</option>
              </Select>
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

          <div className="mt-4">
            <Label>Campos que aparecem na impressão (na ordem)</Label>
            <div className="mt-2 flex flex-col gap-1.5">
              {editing.field_ids.map((fid, idx) => {
                const field = fields.find((f) => f.id === fid);
                if (!field) return null;
                return (
                  <div
                    key={fid}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm"
                  >
                    <span className="flex-1 text-foreground">
                      {field.label}
                      {field.internal && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (interno)
                        </span>
                      )}
                    </span>
                    <button
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={idx === 0}
                      onClick={() => {
                        const ids = [...editing.field_ids];
                        const prev = ids[idx - 1];
                        const cur = ids[idx];
                        if (prev == null || cur == null) return;
                        ids[idx - 1] = cur;
                        ids[idx] = prev;
                        setEditing({ ...editing, field_ids: ids });
                      }}
                    >
                      ↑
                    </button>
                    <button
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={idx === editing.field_ids.length - 1}
                      onClick={() => {
                        const ids = [...editing.field_ids];
                        const next = ids[idx + 1];
                        const cur = ids[idx];
                        if (next == null || cur == null) return;
                        ids[idx + 1] = cur;
                        ids[idx] = next;
                        setEditing({ ...editing, field_ids: ids });
                      }}
                    >
                      ↓
                    </button>
                    <button
                      className="text-destructive hover:underline"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          field_ids: editing.field_ids.filter(
                            (id) => id !== fid,
                          ),
                        })
                      }
                    >
                      Remover
                    </button>
                  </div>
                );
              })}
            </div>
            {fields.filter((f) => !editing.field_ids.includes(f.id)).length >
              0 && (
              <Select
                className="mt-2"
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  setEditing({
                    ...editing,
                    field_ids: [...editing.field_ids, e.target.value],
                  });
                }}
              >
                <option value="">+ Adicionar campo ao modelo...</option>
                {fields
                  .filter((f) => !editing.field_ids.includes(f.id))
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                      {f.internal ? " (interno)" : ""}
                    </option>
                  ))}
              </Select>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <Button
              disabled={saveMut.isPending}
              onClick={() => {
                if (!editing.name.trim() || !editing.title.trim()) {
                  toast.error("Preencha o nome do modelo e o título impresso.");
                  return;
                }
                saveMut.mutate(editing);
              }}
            >
              Salvar modelo
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

// ---------- Aba Publicar ----------

function PublishTab({
  formId,
  form,
  onChanged,
}: {
  formId: string;
  form: {
    title: string;
    description: string | null;
    status: string;
    public_slug: string;
  };
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(form.title);
  const [description, setDescription] = useState(form.description ?? "");

  const publicUrl = `${window.location.origin}/f/${form.public_slug}`;

  const infoMut = useMutation({
    mutationFn: () =>
      updateFormInfo({ data: { id: formId, title, description } }),
    onSuccess: () => {
      toast.success("Informações salvas.");
      onChanged();
      queryClient.invalidateQueries({ queryKey: ["admin-forms"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (status: "draft" | "published" | "closed") =>
      setFormStatus({ data: { id: formId, status } }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      onChanged();
      queryClient.invalidateQueries({ queryKey: ["admin-forms"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mt-6 flex flex-col gap-4">
      <Card>
        <h3 className="font-semibold text-foreground">Informações</h3>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Descrição (aparece no formulário público)</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Button
              onClick={() => infoMut.mutate()}
              disabled={infoMut.isPending}
            >
              Salvar informações
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-foreground">Link público</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          O link só funciona enquanto o formulário estiver publicado.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 text-sm">
            {publicUrl}
          </code>
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              toast.success("Link copiado.");
            }}
          >
            Copiar link
          </Button>
          {form.status === "published" && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Abrir ↗
            </a>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Badge color={STATUS_COLOR[form.status] ?? "muted"}>
            {STATUS_LABEL[form.status] ?? form.status}
          </Badge>
          {form.status !== "published" ? (
            <Button
              variant="secondary"
              onClick={() => statusMut.mutate("published")}
            >
              Publicar
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => statusMut.mutate("closed")}
            >
              Encerrar
            </Button>
          )}
          {form.status === "closed" && (
            <Button variant="ghost" onClick={() => statusMut.mutate("draft")}>
              Voltar para rascunho
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
