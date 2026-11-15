import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth";
import { createCheckout } from "@/lib/shop.functions";

export function BuyButton({ productId, label = "Quero comprar agora" }: { productId: string; label?: string }) {
  const { user, loading } = useAuthUser();
  const navigate = useNavigate();
  const checkout = useServerFn(createCheckout);
  const [busy, setBusy] = useState(false);

  async function start() {
    if (busy || loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/", product: productId } });
      return;
    }
    setBusy(true);
    try {
      const { orderId } = await checkout({ data: { productId } });
      navigate({ to: "/checkout/$orderId", params: { orderId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar pagamento");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="hero" size="xl" onClick={start} disabled={busy || loading} className="max-w-full whitespace-normal" aria-busy={busy}>
      {busy ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : <ArrowRight className="h-5 w-5 shrink-0" />}
      {busy ? "Gerando PIX..." : label}
    </Button>
  );
}
