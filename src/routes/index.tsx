import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Printer, ShieldCheck, School } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Formulários Escolares — Cadastros com ID próprio e impressão" },
      {
        name: "description",
        content:
          "Crie formulários personalizados por escola, publique links públicos, identifique cada cadastro com ID sequencial da escola e imprima com modelos configuráveis.",
      },
      {
        property: "og:title",
        content: "Formulários Escolares — Cadastros com ID próprio e impressão",
      },
      {
        property: "og:description",
        content:
          "Formulários personalizados por escola com links públicos, IDs sequenciais e impressão configurável.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="font-display text-lg font-bold text-foreground">
          Formulários Escolares
        </span>
        <Link
          to="/auth"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Entrar
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20 pt-14 text-center">
        <h1 className="font-display mx-auto max-w-2xl text-4xl font-bold leading-tight text-foreground">
          Formulários personalizados para cada escola, com ID próprio
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Crie formulários, compartilhe um link público e acompanhe cada
          cadastro com a sequência de identificação da sua escola. Imprima
          fichas com modelos configurados do seu jeito.
        </p>
        <Link
          to="/auth"
          className="mt-8 inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Acessar o sistema
        </Link>

        <div className="mt-16 grid gap-6 text-left sm:grid-cols-2">
          {[
            {
              icon: ClipboardList,
              title: "Formulários sob medida",
              desc: "Campos de texto, data, escolhas e mais — com campos internos que só a equipe preenche.",
            },
            {
              icon: School,
              title: "ID sequencial por escola",
              desc: "Cada escola tem seu prefixo e numeração próprios, como ESCA-0001, para identificar cadastros.",
            },
            {
              icon: Printer,
              title: "Impressão configurável",
              desc: "Monte modelos com os campos e o layout que quiser, e imprima fichas individuais ou em lote.",
            },
            {
              icon: ShieldCheck,
              title: "Permissões por perfil",
              desc: "Administrador, gestor de escola, operador de impressão e editor — cada um vê só o que deve.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <Icon className="h-6 w-6 text-primary" />
              <h2 className="mt-3 font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
