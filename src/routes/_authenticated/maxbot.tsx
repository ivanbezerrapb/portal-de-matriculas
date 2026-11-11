import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Eye, EyeOff, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { getMaxbotSettings, saveMaxbotSettings, testMaxbotConnection } from "@/lib/ext/maxbot.functions";
import { Badge, Button, Card, Input, Label, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/maxbot")({
  head: () => ({
    meta: [
      { title: "Maxbot — Grupo Inter" },
      { name: "description", content: "Credenciais e configurações da integração com o Maxbot." },
      { property: "og:title", content: "Maxbot — Grupo Inter" },
      { property: "og:description", content: "Configuração da integração do portal com o Maxbot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MaxbotPage,
});

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString("pt-BR") : "—";
}

function MaxbotPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMaxbotSettings);
  const saveFn = useServerFn(saveMaxbotSettings);
  const testFn = useServerFn(testMaxbotConnection);
  const { data, isLoading } = useQuery({ queryKey: ["maxbot-settings"], queryFn: () => getFn() });
  const [apiUrl, setApiUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (data) { setApiUrl(data.api_url); setEnabled(data.enabled); }
  }, [data]);

  async function save(clear = false) {
    setSaving(true);
    try {
      await saveFn({ data: { api_url: apiUrl, enabled: clear ? false : enabled, token: token || undefined, clear_token: clear } });
      setToken("");
      toast.success(clear ? "Token removido." : "Configuração salva.");
      qc.invalidateQueries({ queryKey: ["maxbot-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally { setSaving(false); }
  }

  async function test() {
    setTesting(true);
    try {
      const r = await testFn();
      r.ok ? toast.success(r.message) : toast.error(r.message);
      qc.invalidateQueries({ queryKey: ["maxbot-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no teste.");
    } finally { setTesting(false); }
  }

  if (isLoading || !data) return <div className="p-8"><Spinner /></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Maxbot</h1>
        <p className="text-sm text-muted-foreground">Credenciais e configurações da integração com o Maxbot.</p>
      </div>
      <Card className="space-y-5 p-6">
        <div className="space-y-2">
          <Label>Token da API</Label>
          {data.token_set && (
            <div className="flex items-center gap-2">
              <Badge>Token configurado</Badge>
              <button type="button" className="text-xs text-destructive hover:underline" onClick={() => { if (confirm("Remover o token? A integração será desativada.")) save(true); }}>Remover token</button>
            </div>
          )}
          <div className="relative">
            <Input type={show ? "text" : "password"} value={token} onChange={(e) => setToken(e.target.value)}
              placeholder={data.token_set ? "Digite um novo token para substituir" : "Cole aqui o token gerado no Maxbot"} autoComplete="off" className="pr-10" />
            <button type="button" aria-label={show ? "Ocultar token" : "Mostrar token"} onClick={() => setShow(!show)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">O token fica guardado com segurança e nunca é exibido depois de salvo.</p>
        </div>
        <div className="space-y-2">
          <Label>Endereço da API</Label>
          <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
        </div>
        <label className="flex items-center gap-3 text-sm font-medium text-foreground">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Integração ativa
        </label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save()} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          <Button variant="outline" onClick={test} disabled={testing || !data.token_set}>
            <PlugZap className="h-4 w-4" />{testing ? "Testando..." : "Testar conexão"}
          </Button>
        </div>
      </Card>
      <Card className="space-y-1 p-6 text-sm">
        <p><span className="text-muted-foreground">Última alteração:</span> {fmt(data.updated_at)}{data.updated_by_name ? ` por ${data.updated_by_name}` : ""}</p>
        <p><span className="text-muted-foreground">Último teste:</span> {fmt(data.last_test_at)}
          {data.last_test_at && <span className={data.last_test_ok ? " text-primary" : " text-destructive"}> — {data.last_test_message}</span>}</p>
      </Card>
    </div>
  );
}
