import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { refreshOrderStatus } from "@/lib/shop.functions";
import { brl } from "@/lib/order-ui";

export const Route = createFileRoute("/_authenticated/checkout/$orderId")({
  head: () => ({ meta: [
    { title: "Pagamento PIX — Doces que Vendem" },
    { name: "description", content: "Pague seu pedido com PIX e acompanhe a liberação do material." },
    { property: "og:title", content: "Pagamento PIX — Doces que Vendem" },
    { property: "og:description", content: "Pagamento seguro e acompanhamento do seu pedido." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: Checkout,
});

function Checkout() {
  const { orderId } = Route.useParams();
  const refresh = useServerFn(refreshOrderStatus);
  const { data: order, refetch } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!order || order.status !== "pending") return;
    const t = setInterval(async () => {
      try {
        const r = await refresh({ data: { orderId } });
        if (r.status === "paid") refetch();
      } catch {}
    }, 6000);
    return () => clearInterval(t);
  }, [order?.status, orderId, refresh, refetch]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-10">
        {!order ? (
          <p className="text-center text-muted-foreground">Carregando pedido...</p>
        ) : order.status === "paid" ? (
          <div className="rounded-[2rem] bg-card p-8 text-center shadow-soft">
            <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
            <h1 className="mt-4 text-3xl font-semibold text-primary">Pagamento confirmado!</h1>
            <p className="mt-2 text-muted-foreground">Seu material já está liberado.</p>
            <Button asChild variant="hero" size="xl" className="mt-6">
              <Link to="/minha-conta" search={{ tab: "entregues" }}>Acessar meu PDF</Link>
            </Button>
          </div>
        ) : order.status === "failed" || !order.payment_code ? (
          <div className="rounded-[2rem] bg-card p-8 text-center shadow-soft">
            <h1 className="text-2xl font-semibold text-primary">Não foi possível gerar o PIX</h1>
            <p className="mt-2 text-muted-foreground">Tente novamente em instantes.</p>
            <Button asChild variant="chocolate" className="mt-6"><Link to="/">Voltar</Link></Button>
          </div>
        ) : (
          <div className="rounded-[2rem] bg-card p-6 text-center shadow-soft md:p-8">
            <h1 className="text-3xl font-semibold text-primary">Pague com PIX</h1>
            <p className="mt-1 text-muted-foreground">{order.product_name} · <strong>{brl(order.amount)}</strong></p>
            <div className="mx-auto mt-6 w-fit rounded-2xl bg-card p-4 ring-1 ring-border">
              <QRCodeSVG value={order.payment_code} size={220} />
            </div>
            <p className="mt-4 break-all rounded-xl bg-muted p-3 text-left font-mono text-xs">{order.payment_code}</p>
            <Button
              variant="hero"
              className="mt-4 h-12 w-full"
              onClick={async () => {
                if (!order.payment_code) return;
                try {
                  await navigator.clipboard.writeText(order.payment_code);
                  toast.success("Código PIX copiado!");
                } catch { toast.error("Não foi possível copiar. Selecione o código PIX acima."); }
              }}
            >
              <Copy /> Copiar código PIX
            </Button>
            <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Aguardando confirmação da NXGATE...
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
