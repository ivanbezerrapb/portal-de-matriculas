import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getPublicForm, submitPublicForm } from "@/lib/ext/publico.functions";
import type { FormField } from "@/lib/ext/model";
import { parseChildren } from "@/lib/ext/model";
import { FieldRenderer } from "@/components/FieldRenderer";
import { Button, Card } from "@/components/ui";

const publicFormQuery = (slug: string) =>
  queryOptions({
    queryKey: ["public-form", slug],
    queryFn: () => getPublicForm({ data: { slug } }),
  });

export const Route = createFileRoute("/f/$slug")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(publicFormQuery(params.slug)),
  head: ({ params }) => ({
    meta: [
      { title: "Formulário — Formulários Escolares" },
      { name: "description", content: `Preencha o formulário ${params.slug}.` },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PublicFormPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-destructive">
        Erro ao carregar: {error.message}
      </p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Formulário não encontrado.</p>
    </div>
  ),
});

function PublicFormPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(publicFormQuery(slug));
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);


  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-foreground">
            Formulário indisponível
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link não está ativo ou o formulário foi encerrado.
          </p>
        </Card>
      </div>
    );
  }

  const { form, fields } = data;
  const school = form.schools as unknown as {
    name: string;
    logo_url: string | null;
  } | null;

  if (confirmedId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
            ✓
          </div>
          <h1 className="mt-4 text-xl font-semibold text-foreground">
            Cadastro enviado com sucesso!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Guarde o número de identificação do seu cadastro:
          </p>
          <p className="mt-3 rounded-md bg-muted px-4 py-3 font-mono text-2xl font-bold tracking-wide text-foreground">
            {confirmedId}
          </p>
        </Card>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      const v = values[field.id];
      const empty =
        v == null ||
        (typeof v === "string" && v.trim() === "") ||
        (Array.isArray(v) && v.length === 0);
      if (field.required && empty) newErrors[field.id] = "Campo obrigatório";
      if (
        !empty &&
        field.type === "email" &&
        typeof v === "string" &&
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)
      ) {
        newErrors[field.id] = "E-mail inválido";
      }
      if (field.type === "children" && !empty && typeof v === "string") {
        const list = parseChildren(v);
        const incomplete = list.findIndex(
          (c) => !c.nome.trim() || !c.nascimento || !c.serie || !c.turno,
        );
        if (field.required && incomplete >= 0) {
          newErrors[field.id] =
            `Preencha todos os dados da criança ${incomplete + 1}`;
        }
      }
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    try {
      const result = await submitPublicForm({ data: { slug, values } });
      setConfirmedId(result.publicId);
      window.scrollTo(0, 0);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível enviar.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="mx-auto max-w-xl px-4">
        <Card>
          {school?.logo_url && (
            <img
              src={school.logo_url}
              alt={school.name}
              className="mb-4 h-14 object-contain"
            />
          )}
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {school?.name ?? "Escola"}
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold text-foreground">
            {form.title}
          </h1>
          {form.description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {form.description}
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
            {fields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field as FormField}
                value={values[field.id] ?? (field.type === "multiple_choice" ? [] : "")}
                error={errors[field.id]}
                onChange={(v) => setValues((prev) => ({ ...prev, [field.id]: v }))}
              />
            ))}
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? "Enviando..." : "Enviar cadastro"}
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Ao enviar, você receberá um número de identificação do cadastro.
        </p>
      </div>
    </div>
  );
}
