import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, Download, FileText, KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";
import { createApiKey, getApiCatalog, listApiKeys, revokeApiKey } from "@/lib/ext/api.functions";
import { API_BASE, curl, ENDPOINTS, ERRORS, jsCode, markdownDoc, pyCode, type Endpoint } from "@/lib/api-docs";
import { Badge, Button, Card, Input, Label, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/api")({
  head: () => ({
    meta: [
      { title: "API — Grupo Inter" },
      { name: "description", content: "Chaves de acesso e documentação da API do Portal de Matrículas." },
      { property: "og:title", content: "API — Grupo Inter" },
      { property: "og:description", content: "Integração de outros sistemas com o Portal de Matrículas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApiPage,
});

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
const copy = (t: string) => { void navigator.clipboard.writeText(t); toast.success("Copiado."); };

function ApiPage() {
  const [tab, setTab] = useState<"chaves" | "docs" | "opcoes">("chaves");
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">API</h1>
          <p className="text-sm text-muted-foreground">Permite que outros sistemas criem leads, agendem visitas e atualizem cards no portal.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => {
            const url = URL.createObjectURL(new Blob([markdownDoc()], { type: "text/markdown" }));
            const a = document.createElement("a"); a.href = url; a.download = "api-portal-matriculas.md"; a.click(); URL.revokeObjectURL(url);
          }}><Download className="h-4 w-4" /> Baixar documentação</Button>
          <Button variant="secondary" onClick={async () => {
            const { apiDocsPdfBlob } = await import("@/lib/api-docs-pdf");
            const blob = apiDocsPdfBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = "api-portal-matriculas.pdf"; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 30_000);
          }}><FileText className="h-4 w-4" /> Baixar PDF</Button>
        </div>
      </div>
      <div className="flex gap-2 border-b border-border">
        {([["chaves", "Chaves de acesso"], ["docs", "Documentação"], ["opcoes", "Escolas e opções"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>
      {tab === "chaves" && <Keys />}
      {tab === "docs" && <Docs />}
      {tab === "opcoes" && <Options />}
    </div>
  );
}

function Keys() {
  const qc = useQueryClient();
  const listFn = useServerFn(listApiKeys);
  const createFn = useServerFn(createApiKey);
  const revokeFn = useServerFn(revokeApiKey);
  const { data, isLoading } = useQuery({ queryKey: ["api-keys"], queryFn: () => listFn() });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    try { const r = await createFn({ data: { name } }); setCreated(r.value); setName(""); qc.invalidateQueries({ queryKey: ["api-keys"] }); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function revoke(id: string, n: string) {
    if (!confirm(`Revogar a chave "${n}"? O sistema que usa essa chave deixará de funcionar.`)) return;
    try { await revokeFn({ data: { id } }); toast.success("Chave revogada."); qc.invalidateQueries({ queryKey: ["api-keys"] }); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <Label>Nova chave (dê o nome do sistema que vai usar)</Label>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: CRM Comercial" />
          <Button onClick={create} disabled={busy || name.trim().length < 2}><Plus className="h-4 w-4" /> Gerar chave</Button>
        </div>
        {created && (
          <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-4">
            <p className="text-sm font-semibold text-foreground">Copie a chave agora. Por segurança ela não será mostrada de novo.</p>
            <div className="flex gap-2">
              <code className="flex-1 break-all rounded bg-muted px-3 py-2 text-xs">{created}</code>
              <Button variant="secondary" onClick={() => copy(created)}><Copy className="h-4 w-4" /> Copiar</Button>
            </div>
            <Button variant="ghost" onClick={() => setCreated(null)}>Já copiei</Button>
          </div>
        )}
      </Card>
      <Card className="p-0">
        {isLoading ? <div className="p-6"><Spinner /></div> : !data?.length ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhuma chave criada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Sistema</th><th className="p-3">Chave</th><th className="p-3">Criada</th><th className="p-3">Último uso</th><th className="p-3">Chamadas</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {data.map((k) => (
                <tr key={k.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium text-foreground"><KeyRound className="mr-1 inline h-4 w-4 text-muted-foreground" />{k.name}</td>
                  <td className="p-3"><code className="text-xs">{k.preview}</code></td>
                  <td className="p-3 text-xs">{fmt(k.created_at)}<br /><span className="text-muted-foreground">{k.created_by_name ?? ""}</span></td>
                  <td className="p-3 text-xs">{fmt(k.last_used_at)}</td>
                  <td className="p-3">{k.uses}</td>
                  <td className="p-3 text-right">
                    {k.revoked_at ? <Badge>Revogada</Badge> : <Button variant="ghost" onClick={() => revoke(k.id, k.name)}>Revogar</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Code({ text }: { text: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground"><code>{text}</code></pre>
      <button onClick={() => copy(text)} className="absolute right-2 top-2 rounded bg-background/80 p-1 text-muted-foreground hover:text-foreground" aria-label="Copiar"><Copy className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function EndpointCard({ e }: { e: Endpoint }) {
  const [lang, setLang] = useState<"curl" | "js" | "py">("curl");
  const fields = e.campos ?? e.query;
  return (
    <Card className="space-y-3 p-5" >
      <div id={e.id} className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-bold ${e.metodo === "GET" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"}`}>{e.metodo}</span>
        <code className="text-sm font-semibold text-foreground">{e.caminho}</code>
        <span className="text-sm text-muted-foreground">— {e.titulo}</span>
      </div>
      <p className="text-sm text-foreground">{e.descricao}</p>
      {fields && (
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground"><tr><th className="py-1 pr-3">Campo</th><th className="pr-3">Tipo</th><th className="pr-3">Obrigatório</th><th>Descrição</th></tr></thead>
          <tbody>{fields.map((f) => (
            <tr key={f.nome} className="border-t border-border"><td className="py-1.5 pr-3 font-mono">{f.nome}</td><td className="pr-3">{f.tipo}</td><td className="pr-3">{f.obrigatorio ? "sim" : "não"}</td><td>{f.descricao}</td></tr>
          ))}</tbody>
        </table>
      )}
      <div className="flex gap-1">
        {([["curl", "cURL"], ["js", "JavaScript"], ["py", "Python"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setLang(k)} className={`rounded px-2 py-1 text-xs ${lang === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      <Code text={lang === "curl" ? curl(e) : lang === "js" ? jsCode(e) : pyCode(e)} />
      <p className="text-xs font-semibold text-muted-foreground">Resposta</p>
      <Code text={JSON.stringify(e.resposta, null, 2)} />
    </Card>
  );
}

function Docs() {
  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5 text-sm">
        <p><strong>URL base:</strong> <code>{API_BASE}</code> <button onClick={() => copy(API_BASE)} aria-label="Copiar"><Copy className="inline h-3.5 w-3.5" /></button></p>
        <p><strong>Autenticação:</strong> todas as chamadas levam o cabeçalho <code>Authorization: Bearer &lt;chave&gt;</code>, gerada na aba Chaves de acesso.</p>
        <p><strong>Formato:</strong> JSON em UTF-8. Datas em ISO 8601 com fuso (ex.: <code>2026-12-03T09:00:00-03:00</code>). Toda resposta traz <code>ok</code>; em erro vem <code>{"{"} ok: false, erro, mensagem {"}"}</code>.</p>
        <p><strong>Fluxo sugerido:</strong> 1) GET /escolas para conhecer séries e origens; 2) POST /leads; 3) POST /agendamentos com o código devolvido.</p>
      </Card>
      {ENDPOINTS.map((e) => <EndpointCard key={e.id} e={e} />)}
      <Card className="p-5">
        <h2 className="mb-2 font-semibold text-foreground">Erros</h2>
        <table className="w-full text-xs">
          <tbody>{ERRORS.map(([s, c, d]) => (
            <tr key={s} className="border-t border-border"><td className="py-1.5 pr-3 font-mono">{s}</td><td className="pr-3 font-mono">{c}</td><td>{d}</td></tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}

function Options() {
  const fn = useServerFn(getApiCatalog);
  const { data, isLoading } = useQuery({ queryKey: ["api-catalog"], queryFn: () => fn() });
  if (isLoading || !data) return <Spinner />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.map((s) => (
        <Card key={s.id} className="space-y-2 p-5 text-sm">
          <h2 className="font-semibold text-foreground">{s.nome}</h2>
          <p className="text-xs text-muted-foreground">ID: <code>{s.id}</code></p>
          <p><strong>Séries:</strong> {s.series.join(", ") || "—"}</p>
          <p><strong>Origens:</strong> {s.origens.join(", ") || "—"}</p>
          {s.funis.map((f) => (
            <div key={f.id}><strong>{f.nome}:</strong> <span className="text-muted-foreground">{f.etapas.map((e) => e.nome).join(" → ")}</span></div>
          ))}
        </Card>
      ))}
    </div>
  );
}
