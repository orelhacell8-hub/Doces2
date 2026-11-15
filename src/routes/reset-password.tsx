import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Doces que Vendem" },
      { name: "description", content: "Defina uma nova senha para sua conta." },
      { property: "og:title", content: "Redefinir senha — Doces que Vendem" },
      { property: "og:description", content: "Defina uma nova senha para sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    if (password.length < 6) { toast.error("A senha deve ter ao menos 6 caracteres"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error("Link inválido ou expirado. Solicite um novo."); return; }
    toast.success("Senha atualizada!");
    navigate({ to: "/minha-conta" });
  }
  return (
    <AuthShell>
      <h1 className="text-3xl font-semibold text-primary">Nova senha</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-2"><Label htmlFor="np">Nova senha</Label><Input id="np" name="password" type="password" required autoComplete="new-password" /></div>
        <Button type="submit" variant="chocolate" className="h-11 w-full" disabled={busy}>Salvar senha</Button>
      </form>
    </AuthShell>
  );
}
