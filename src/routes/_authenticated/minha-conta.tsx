import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Download, Eye, FileText } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { getPdfLink } from "@/lib/shop.functions";
import { brl, fmtDate, payLabel } from "@/lib/order-ui";

export const Route = createFileRoute("/_authenticated/minha-conta")({
  validateSearch: z.object({ tab: z.enum(["painel", "compras", "entregues"]).optional() }),
  head: () => ({ meta: [
    { title: "Minha conta — Doces que Vendem" },
    { name: "description", content: "Consulte suas compras e acesse seus PDFs de confeitaria." },
    { property: "og:title", content: "Minha conta — Doces que Vendem" },
    { property: "og:description", content: "Sua área de compras e materiais entregues." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: Account,
});

function Account() {
  const { tab } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const pdf = useServerFn(getPdfLink);
  const { data } = useQuery({
    queryKey: ["my-account"],
    queryFn: async () => {
      const [{ data: profile }, { data: orders }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
      ]);
      return { profile, orders: orders ?? [] };
    },
  });
  const orders = data?.orders ?? [];
  const delivered = orders.filter((o) => o.status === "paid" && o.delivered);

  async function openPdf(orderId: string, download: boolean) {
    const w = download ? null : window.open("", "_blank");
    try {
      const { url } = await pdf({ data: { orderId, download } });
      if (w) w.location.href = url;
      else window.location.href = url;
    } catch (e) {
      w?.close();
      toast.error(e instanceof Error ? e.message : "Erro ao acessar arquivo");
    }
  }

  const name = data?.profile?.full_name || user.email;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-semibold text-primary md:text-4xl">Olá, {name}!</h1>
        <p className="text-muted-foreground">Bem-vinda(o) à sua área exclusiva.</p>
        <Tabs defaultValue={tab ?? "painel"} className="mt-8">
          <TabsList className="flex w-full flex-wrap h-auto">
            <TabsTrigger value="painel">Dashboard</TabsTrigger>
            <TabsTrigger value="compras">Minhas compras</TabsTrigger>
            <TabsTrigger value="entregues">Produtos entregues</TabsTrigger>
          </TabsList>

          <TabsContent value="painel" className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl bg-card p-6 shadow-soft">
              <h2 className="text-xl font-semibold">Informações da conta</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div><dt className="text-muted-foreground">Nome</dt><dd className="font-semibold">{data?.profile?.full_name || "—"}</dd></div>
                <div><dt className="text-muted-foreground">E-mail</dt><dd className="font-semibold">{user.email}</dd></div>
                <div><dt className="text-muted-foreground">Cliente desde</dt><dd className="font-semibold">{fmtDate(user.created_at)}</dd></div>
              </dl>
            </div>
            <div className="rounded-3xl bg-card p-6 shadow-soft">
              <h2 className="text-xl font-semibold">Histórico de compras</h2>
              {orders.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Você ainda não fez compras. <Link to="/" className="text-accent underline">Ver curso</Link></p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {orders.slice(0, 5).map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>{o.product_name}<br /><span className="text-muted-foreground">{fmtDate(o.created_at)}</span></span>
                      <StatusBadge status={o.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="compras" className="mt-6 space-y-4">
            {orders.length === 0 && <p className="text-muted-foreground">Nenhuma compra ainda.</p>}
            {orders.map((o) => (
              <div key={o.id} className="flex flex-col gap-3 rounded-3xl bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{o.product_name}</p>
                  <p className="text-sm text-muted-foreground">{brl(o.amount)} · {fmtDate(o.created_at)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={o.status} />
                  <Badge variant="outline">{o.delivered ? "Entregue" : "Não entregue"}</Badge>
                  {o.status === "pending" && o.payment_code && (
                    <Button asChild size="sm" variant="chocolate"><Link to="/checkout/$orderId" params={{ orderId: o.id }}>Pagar</Link></Button>
                  )}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="entregues" className="mt-6 grid gap-4 md:grid-cols-2">
            {delivered.length === 0 && <p className="text-muted-foreground">Seus produtos aparecem aqui após a confirmação do pagamento.</p>}
            {delivered.map((o) => (
              <div key={o.id} className="rounded-3xl bg-card p-6 shadow-soft">
                <FileText className="h-8 w-8 text-accent" />
                <p className="mt-3 text-lg font-semibold">{o.product_name}</p>
                <p className="text-sm text-muted-foreground">Liberado em {fmtDate(o.delivered_at)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="chocolate" onClick={() => openPdf(o.id, false)}><Eye /> Acessar PDF</Button>
                  <Button variant="outline" className="rounded-full" onClick={() => openPdf(o.id, true)}><Download /> Baixar PDF</Button>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "paid" ? "bg-success text-success-foreground" : status === "failed" ? "bg-destructive text-destructive-foreground" : "bg-warning text-foreground";
  return <Badge className={cls}>{payLabel(status)}</Badge>;
}
