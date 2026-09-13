import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/ext/browser";
import { Button, Card, Input, Label } from "@/components/ui";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Formulários Escolares" },
      { name: "description", content: "Acesse o sistema de formulários escolares." },
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <h1 className="font-display text-xl font-bold text-foreground">
          Formulários Escolares
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
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
              <div>
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Aguarde..."
                : mode === "login"
                  ? "Entrar"
                  : "Criar conta"}
            </Button>
          </form>
        )}

        <button
          className="mt-4 w-full text-center text-sm text-primary hover:underline"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setSignupDone(false);
          }}
        >
          {mode === "login"
            ? "Não tem conta? Cadastre-se"
            : "Já tem conta? Entrar"}
        </button>
      </Card>
    </div>
  );
}
