import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";
import { getSupabase } from "@/lib/ext/browser";
import { Button, Card, Input, Label } from "@/components/ui";
import logoAsset from "@/assets/grupo-inter-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Formulários Escolares" },
      { name: "description", content: "Acesse o sistema de formulários escolares." },
      { property: "og:title", content: "Entrar — Grupo Inter" },
      { property: "og:description", content: "Acesse o portal de formulários escolares do Grupo Inter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = await getSupabase();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/dashboard" });
        } else {
          setSignupDone(true);
        }
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível entrar.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-primary" />
      <Card className="relative w-full max-w-md border-border/70 p-7 shadow-[0_24px_70px_-36px_oklch(0.34_0.105_287_/_0.5)] sm:p-10">
        <div className="mb-9 text-center">
          <img
            src={logoAsset.url}
            alt="Grupo Inter"
            className="mx-auto h-auto w-56 max-w-full"
          />
          <h1 className="mt-7 font-display text-xl font-semibold text-foreground">
            Portal de formulários
          </h1>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? "Entre com sua conta" : "Crie sua conta"}
        </p>

        {signupDone ? (
          <div className="mt-6 rounded-md bg-emerald-50 p-4 text-sm text-emerald-800">
            Conta criada! Se a confirmação por e-mail estiver ativa, verifique
            sua caixa de entrada antes de entrar.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            {mode === "signup" && (
              <div className="relative">
                <Label htmlFor="name">Nome completo</Label>
                <UserRound className="pointer-events-none absolute bottom-3.5 left-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="pl-10"
                />
              </div>
            )}
            <div className="relative">
              <Label htmlFor="email">E-mail</Label>
              <Mail className="pointer-events-none absolute bottom-3.5 left-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10"
              />
            </div>
            <div className="relative">
              <Label htmlFor="password">Senha</Label>
              <LockKeyhole className="pointer-events-none absolute bottom-3.5 left-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={loading} className="mt-1 w-full">
              {loading
                ? "Aguarde..."
                : mode === "login"
                  ? "Entrar"
                  : "Criar conta"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        )}

        <Button
          type="button"
          variant="ghost"
          className="mt-4 w-full text-primary"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setSignupDone(false);
          }}
        >
          {mode === "login"
            ? "Não tem conta? Cadastre-se"
            : "Já tem conta? Entrar"}
        </Button>
      </Card>
    </main>
  );
}
