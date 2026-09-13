import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getPrintData } from "@/lib/ext/impressao.functions";
import type { FormField } from "@/lib/ext/model";
import { formatValue } from "@/components/FieldRenderer";
import { Button, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/imprimir/$templateId")({
  validateSearch: (search: Record<string, unknown>) => ({
    ids: z.string().default("").parse(search.ids),
  }),
  component: PrintPage,
});

function PrintPage() {
  const { templateId } = Route.useParams();
  const { ids } = Route.useSearch();

  const submissionIds = ids.split(",").filter(Boolean);

  const { data, isLoading, error } = useQuery({
    queryKey: ["print", templateId, ids],
    queryFn: () =>
      getPrintData({
        data: { template_id: templateId, submission_ids: submissionIds },
      }),
    enabled: submissionIds.length > 0,
  });

  if (isLoading) {
    return (
      <div className="mt-10 flex justify-center">
        <Spinner />
      </div>
    );
  }

  if (error || !data || data.submissions.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-sm text-destructive">
          {error?.message ??
            "Nenhum cadastro encontrado para impressão. Verifique suas permissões."}
        </p>
        <Link
          to="/cadastros"
          className="mt-3 inline-block text-sm text-primary hover:underline"
        >
          ← Voltar para cadastros
        </Link>
      </div>
    );
  }

  const { template, form, fields, submissions } = data;
  const school = form.schools as unknown as {
    name: string;
    logo_url: string | null;
  } | null;
  const typedFields = fields as FormField[];

  return (
    <div className="mx-auto max-w-4xl">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; inset: 0; width: 100%; }
          .print-page { page-break-after: always; box-shadow: none !important; border: none !important; }
          .no-print { display: none !important; }
        }
        @page { size: ${template.page_size}; margin: 12mm; }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between">
        <Link
          to="/cadastros"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar
        </Link>
        <Button onClick={() => window.print()}>
          Imprimir {submissions.length} ficha{submissions.length > 1 ? "s" : ""}
        </Button>
      </div>

      <div id="print-area" className="flex flex-col gap-6">
        {submissions.map((sub) => (
          <div
            key={sub.id}
            className="print-page rounded-xl border border-border bg-card p-8 shadow-sm"
          >
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                {template.show_logo && school?.logo_url && (
                  <img
                    src={school.logo_url}
                    alt={school.name}
                    className="mb-2 h-12 object-contain"
                  />
                )}
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {school?.name ?? ""}
                </p>
                <h2 className="font-display text-xl font-bold text-foreground">
                  {template.title}
                </h2>
                {template.header_text && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {template.header_text}
                  </p>
                )}
              </div>
              <p className="font-mono text-lg font-bold text-foreground">
                {sub.public_id}
              </p>
            </div>

            <dl
              className={`mt-5 grid gap-x-8 gap-y-4 ${
                template.columns === 2 ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {typedFields.map((field) => (
                <div key={field.id}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                    {formatValue(field, sub.values[field.id] ?? "")}
                  </dd>
                </div>
              ))}
            </dl>

            {template.show_signature && (
              <div className="mt-14 flex justify-center">
                <div className="w-72 border-t border-foreground pt-1 text-center text-xs text-muted-foreground">
                  Assinatura do responsável
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <span>{template.footer_text ?? ""}</span>
              <span>
                Impresso em {new Date().toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
