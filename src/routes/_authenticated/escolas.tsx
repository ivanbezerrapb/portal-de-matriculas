import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  createSchool,
  listSchools,
  updateSchool,
} from "@/lib/ext/escolas.functions";
import { Button, Card, EmptyState, Input, Label, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/escolas")({
  component: SchoolsPage,
});

function SchoolsPage() {
  const queryClient = useQueryClient();
  const { data: schools, isLoading } = useQuery({
    queryKey: ["schools"],
    queryFn: () => listSchools(),
  });
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [digits, setDigits] = useState(4);

  const createMut = useMutation({
    mutationFn: () =>
      createSchool({
        data: { name, idPrefix: prefix, idDigits: digits },
      }),
    onSuccess: () => {
      toast.success("Escola criada.");
      setName("");
      setPrefix("");
      queryClient.invalidateQueries({ queryKey: ["schools"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const resetSeqMut = useMutation({
    mutationFn: (vars: { schoolId: string; next: number }) =>
      updateSchool({ data: { schoolId: vars.schoolId, idNextNumber: vars.next } }),
    onSuccess: () => {
      toast.success("Sequência atualizada.");
      queryClient.invalidateQueries({ queryKey: ["schools"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-foreground">
        Escolas
      </h1>

      <Card className="mt-6">
        <h2 className="font-semibold text-foreground">Nova escola</h2>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate();
          }}
        >
          <div className="min-w-48 flex-1">
            <Label htmlFor="school-name">Nome</Label>
            <Input
              id="school-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: E.M. Monteiro Lobato"
              required
            />
          </div>
          <div className="w-32">
            <Label htmlFor="school-prefix">Prefixo do ID</Label>
            <Input
              id="school-prefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              placeholder="ESCA"
              maxLength={8}
              required
            />
          </div>
          <div className="w-28">
            <Label htmlFor="school-digits">Dígitos</Label>
            <Input
              id="school-digits"
              type="number"
              min={2}
              max={8}
              value={digits}
              onChange={(e) => setDigits(Number(e.target.value))}
              required
            />
          </div>
          <Button type="submit" disabled={createMut.isPending}>
            Criar
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Exemplo de ID com prefixo {prefix || "ESCA"} e {digits} dígitos:{" "}
          <span className="font-mono">
            {(prefix || "ESCA") + "-" + "1".padStart(digits, "0")}
          </span>
        </p>
      </Card>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : !schools || schools.length === 0 ? (
        <EmptyState
          title="Nenhuma escola cadastrada"
          description="Crie a primeira escola acima."
        />
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {schools.map((s) => (
            <Card key={s.id} className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  Prefixo <span className="font-mono">{s.id_prefix}</span> ·
                  próximo número: {s.id_next_number}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  const input = window.prompt(
                    `Próximo número da sequência de ${s.name} (atual: ${s.id_next_number})`,
                    String(s.id_next_number),
                  );
                  if (!input) return;
                  const next = Number(input);
                  if (!Number.isInteger(next) || next < 1) {
                    toast.error("Número inválido.");
                    return;
                  }
                  if (
                    window.confirm(
                      `Reiniciar a sequência de ${s.name} para ${next}? Isso pode gerar IDs duplicados se houver cadastros anteriores.`,
                    )
                  ) {
                    resetSeqMut.mutate({ schoolId: s.id, next });
                  }
                }}
              >
                Ajustar sequência
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
