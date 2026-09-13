import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/crm/funil")({
  head: () => ({
    meta: [
      { title: "Funil — Grupo Inter" },
      { name: "description", content: "Criação de funis e etapas de atendimento em breve." },
      { property: "og:title", content: "Funil — Grupo Inter" },
      { property: "og:description", content: "Criação de funis e etapas de atendimento em breve." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FunilPage,
});

function FunilPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">CRM</p>
        <h1 className="font-display text-2xl font-bold text-foreground">Funil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie funis e defina as etapas de atendimento.
        </p>
      </div>
      <EmptyState
        title="Em breve"
        description="Esta área ainda está em construção e será liberada em uma próxima atualização."
      />
    </div>
  );
}
