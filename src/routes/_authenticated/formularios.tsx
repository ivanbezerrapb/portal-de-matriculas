import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  createForm,
  listAdminForms,
  updateForm,
} from "@/lib/ext/formularios.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Select,
  Spinner,
} from "@/components/ui";

export const Route = createFileRoute("/_authenticated/formularios")({
  component: FormsPage,
});

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function FormsPage() {
  const queryClient = useQueryClient();
  const { data: forms, isLoading } = useQuery({
    queryKey: ["admin-forms"],
    queryFn: () => listAdminForms(),
  });
  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: () => listSchools(),
  });

  const [title, setTitle] = useState("");
  const [schoolId, setSchoolId] = useState("");

  const createMut = useMutation({
    mutationFn: () => {
      const base = slugify(title) || "formulario";
      const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      return createForm({ data: { title, schoolId, slug } });
    },
    onSuccess: () => {
      toast.success("Formulário criado.");
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["admin-forms"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (vars: { formId: string; published: boolean }) =>
      updateForm({ data: { formId: vars.formId, published: vars.published } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-forms"] }),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-foreground">
        Formulários
      </h1>

      <Card className="mt-6">
        <h2 className="font-semibold text-foreground">Novo formulário</h2>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!schoolId) {
              toast.error("Selecione a escola.");
              return;
            }
            createMut.mutate();
          }}
        >
          <div className="min-w-48 flex-1">
            <Label htmlFor="form-title">Título</Label>
            <Input
              id="form-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Matrícula 2026"
              required
            />
          </div>
          <div className="min-w-48 flex-1">
            <Label htmlFor="form-school">Escola</Label>
            <Select
              id="form-school"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {(schools ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={createMut.isPending}>
            Criar
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : !forms || forms.length === 0 ? (
        <EmptyState
          title="Nenhum formulário criado"
          description="Crie o primeiro formulário acima."
        />
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {forms.map((f) => {
            const school = f.schools as unknown as {
              name: string;
              id_prefix: string;
            } | null;
            return (
              <Card key={f.id} className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{f.title}</p>
                    {f.published ? (
                      <Badge className="bg-emerald-100 text-emerald-800">
                        Publicado
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800">
                        Rascunho
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {school?.name ?? "—"} · link:{" "}
                    <span className="font-mono">/f/{f.slug}</span>
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    toggleMut.mutate({
                      formId: f.id,
                      published: !f.published,
                    })
                  }
                >
                  {f.published ? "Despublicar" : "Publicar"}
                </Button>
                <Link
                  to="/formularios/$formId"
                  params={{ formId: f.id }}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Configurar
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
