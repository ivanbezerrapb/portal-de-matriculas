import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/crm/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — Grupo Inter" },
      { name: "description", content: "Acompanhamento de oportunidades de matrícula em breve." },
      { property: "og:title", content: "Pipeline — Grupo Inter" },
      {
        property: "og:description",
        content: "Acompanhamento de oportunidades de matrícula em breve.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">CRM</p>
        <h1 className="font-display text-2xl font-bold text-foreground">Pipeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe as oportunidades de matrícula por etapa.
        </p>
      </div>
      <EmptyState
        title="Em breve"
        description="Esta área ainda está em construção e será liberada em uma próxima atualização."
      />
    </div>
  );
}
