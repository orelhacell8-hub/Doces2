import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createCheckout } from "@/lib/shop.functions";
import { z } from "zod";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional(), product: z.string().uuid().optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — Doces que Vendem" },
      { name: "description", content: "Acesse sua conta para comprar e baixar seus materiais." },
      { property: "og:title", content: "Entrar — Doces que Vendem" },
      { property: "og:description", content: "Acesse sua área do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("E-mail inválido").max(255);
const passSchema = z.string().min(6, "A senha deve ter ao menos 6 caracteres").max(72);

function AuthPage() {
  const { redirect, product } = Route.useSearch();
  const checkout = useServerFn(createCheckout);
  const navigate = useNavigate();
  const target = redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/minha-conta";
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"main" | "forgot">("main");

  async function continuePurchase() {
    if (!product) { await navigate({ to: target }); return; }
    setBusy(true);
    try {
      const { orderId } = await checkout({ data: { productId: product } });
      await navigate({ to: "/checkout/$orderId", params: { orderId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o PIX. Tente novamente.");
    } finally { setBusy(false); }
  }

  async function onLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = emailSchema.safeParse(f.get("email"));
    if (!email.success) { toast.error(email.error.issues[0]?.message ?? "Dados inválidos"); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.data, password: String(f.get("password")) });
    setBusy(false);
    if (error) { toast.error("E-mail ou senha incorretos, ou e-mail ainda não confirmado."); return; }
    await continuePurchase();
  }

  async function onSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = z.string().trim().min(2, "Informe seu nome").max(100).safeParse(f.get("name"));
    const email = emailSchema.safeParse(f.get("email"));
    const pass = passSchema.safeParse(f.get("password"));
    if (!name.success || !email.success || !pass.success) { toast.error("Informe nome, e-mail válido e senha com ao menos 6 caracteres."); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.data,
      password: pass.data,
      options: { emailRedirectTo: `${window.location.origin}/auth${product ? `?product=${encodeURIComponent(product)}` : ""}`, data: { full_name: name.data } },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (data.session) await continuePurchase();
    else toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
  }

  async function onForgot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = emailSchema.safeParse(new FormData(e.currentTarget).get("email"));
    if (!email.success) { toast.error(email.error.issues[0]?.message ?? "Dados inválidos"); return; }
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    toast.success("Se o e-mail existir, você receberá um link para redefinir a senha.");
    setMode("main");
  }

  if (mode === "forgot")
    return (
      <AuthShell>
        <h1 className="text-3xl font-semibold text-primary">Recuperar senha</h1>
        <form onSubmit={onForgot} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fe">E-mail</Label>
            <Input id="fe" name="email" type="email" required />
          </div>
          <Button type="submit" variant="chocolate" className="h-11 w-full" disabled={busy}>Enviar link</Button>
          <Button type="button" variant="link" className="w-full" onClick={() => setMode("main")}>Voltar</Button>
        </form>
      </AuthShell>
    );

  return (
    <AuthShell>
      <h1 className="text-center text-3xl font-semibold text-primary">{product ? "Seu próximo passo" : "Bem-vinda(o)!"}</h1>
      <Tabs defaultValue="login" className="mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Entrar</TabsTrigger>
          <TabsTrigger value="signup">Criar conta</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form onSubmit={onLogin} className="mt-4 space-y-4">
            <div className="space-y-2"><Label htmlFor="le">E-mail</Label><Input id="le" name="email" type="email" required autoComplete="email" /></div>
            <div className="space-y-2"><Label htmlFor="lp">Senha</Label><Input id="lp" name="password" type="password" required autoComplete="current-password" /></div>
            <Button type="submit" variant="chocolate" className="h-11 w-full" disabled={busy}>{busy ? "Aguarde..." : product ? "Entrar e pagar com PIX" : "Entrar"}</Button>
            <Button type="button" variant="link" className="w-full" onClick={() => setMode("forgot")}>Esqueci minha senha</Button>
          </form>
        </TabsContent>
        <TabsContent value="signup">
          <form onSubmit={onSignup} className="mt-4 space-y-4">
            <div className="space-y-2"><Label htmlFor="sn">Nome completo</Label><Input id="sn" name="name" required /></div>
            <div className="space-y-2"><Label htmlFor="se">E-mail</Label><Input id="se" name="email" type="email" required autoComplete="email" /></div>
            <div className="space-y-2"><Label htmlFor="sp">Senha</Label><Input id="sp" name="password" type="password" required autoComplete="new-password" /></div>
            <Button type="submit" variant="hero" className="h-11 w-full" disabled={busy}>Criar conta</Button>
          </form>
        </TabsContent>
      </Tabs>
    </AuthShell>
  );
}
