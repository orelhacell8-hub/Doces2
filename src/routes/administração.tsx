import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, LogOut, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  adminLogin, adminLogout, adminRefreshOrder, adminStatus, attachPdf, getAdminData, saveSiteBackground,
  getPdfUploadUrl, saveProduct, saveSettings, simulateSandboxPayment, testConnection,
} from "@/lib/admin.functions";
import { brl, fmtDate, payLabel } from "@/lib/order-ui";

export const Route = createFileRoute("/administração")({
  head: () => ({ meta: [
    { title: "Administração — Doces que Vendem" },
    { name: "description", content: "Gerencie produtos, pedidos e configurações de pagamento." },
    { property: "og:title", content: "Administração — Doces que Vendem" },
    { property: "og:description", content: "Área administrativa da loja de cursos de confeitaria." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  loader: () => adminStatus(),
  component: AdminPage,
});

function AdminPage() {
  const { admin } = Route.useLoaderData();
  return admin ? <Panel /> : <Gate />;
}

function Gate() {
  const login = useServerFn(adminLogin);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const r = await login({ data: { password: String(new FormData(e.currentTarget).get("password")) } });
    setBusy(false);
    if (!r.ok) { toast.error("Senha incorreta"); return; }
    router.invalidate();
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-chocolate-gradient px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-[2rem] bg-card p-8 shadow-soft">
        <Lock className="mx-auto h-10 w-10 text-accent" />
        <h1 className="text-center text-2xl font-semibold text-primary">Área administrativa</h1>
        <div className="space-y-2"><Label htmlFor="ap">Senha</Label><Input id="ap" name="password" type="password" required autoFocus /></div>
        <Button type="submit" variant="chocolate" className="h-11 w-full" disabled={busy}>Entrar</Button>
      </form>
    </div>
  );
}

function Panel() {
  const fetchData = useServerFn(getAdminData);
  const logout = useServerFn(adminLogout);
  const router = useRouter();
  const { data, refetch, isFetching } = useQuery({ queryKey: ["admin"], queryFn: () => fetchData() });

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-chocolate-gradient text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <h1 className="font-display text-xl">Painel administrativo</h1>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => refetch()} disabled={isFetching}><RefreshCw /> Atualizar</Button>
            <Button size="sm" variant="secondary" onClick={async () => { await logout(); router.invalidate(); }}><LogOut /> Sair</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {!data ? <p className="text-muted-foreground">Carregando...</p> : (
          <Tabs defaultValue="dash">
            <TabsList className="flex h-auto w-full flex-wrap">
              <TabsTrigger value="dash">Dashboard</TabsTrigger>
              <TabsTrigger value="orders">Pedidos</TabsTrigger>
              <TabsTrigger value="products">Produtos</TabsTrigger>
              <TabsTrigger value="nx">NXGATE</TabsTrigger>
              <TabsTrigger value="appearance">Aparência</TabsTrigger>
            </TabsList>
            <TabsContent value="dash" className="mt-6 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Total de vendas" value={brl(data.stats.totalSales)} />
                <Stat label="Pedidos" value={String(data.stats.orders)} />
                <Stat label="Aprovados" value={String(data.stats.approved)} />
                <Stat label="Pendentes" value={String(data.stats.pending)} />
              </div>
              <div className="rounded-3xl bg-card p-5 shadow-soft">
                <h2 className="mb-3 text-xl font-semibold">Últimas compras</h2>
                <OrdersTable orders={data.orders.slice(0, 8)} env={data.settings.environment} onChange={refetch} />
              </div>
            </TabsContent>
            <TabsContent value="orders" className="mt-6 rounded-3xl bg-card p-5 shadow-soft">
              <OrdersTable orders={data.orders} env={data.settings.environment} onChange={refetch} />
            </TabsContent>
            <TabsContent value="products" className="mt-6 space-y-6">
              {data.products.map((p) => <ProductForm key={p.id} product={p} onSaved={refetch} />)}
              <ProductForm onSaved={refetch} />
            </TabsContent>
            <TabsContent value="nx" className="mt-6">
              <NxSettings settings={data.settings} onSaved={refetch} />
            </TabsContent>
            <TabsContent value="appearance" className="mt-6">
              <AppearanceSettings imageUrl={data.settings.backgroundImageUrl} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-card p-5 shadow-soft">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-3xl font-bold text-primary">{value}</p>
    </div>
  );
}

type AdminData = Awaited<ReturnType<typeof getAdminData>>;

function OrdersTable({ orders, env, onChange }: { orders: AdminData["orders"]; env: string; onChange: () => void }) {
  const refresh = useServerFn(adminRefreshOrder);
  const simulate = useServerFn(simulateSandboxPayment);
  async function run(fn: () => Promise<unknown>) {
    try { await fn(); onChange(); toast.success("Status atualizado"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  if (orders.length === 0) return <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead><TableHead>Comprador</TableHead><TableHead>Produto</TableHead>
            <TableHead>Valor</TableHead><TableHead>Pagamento</TableHead><TableHead>Entrega</TableHead><TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="whitespace-nowrap text-xs">{fmtDate(o.created_at)}</TableCell>
              <TableCell className="text-sm">{o.buyer_name || "—"}<br /><span className="text-xs text-muted-foreground">{o.buyer_email}{o.buyer_document ? ` · ${o.buyer_document}` : ""}</span></TableCell>
              <TableCell className="text-sm">{o.product_name}</TableCell>
              <TableCell>{brl(o.amount)}</TableCell>
              <TableCell><Badge variant={o.status === "paid" ? "default" : "outline"}>{payLabel(o.status)}</Badge></TableCell>
              <TableCell>{o.delivered ? "Entregue" : "—"}</TableCell>
              <TableCell className="space-x-1 whitespace-nowrap">
                {o.status === "pending" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => run(() => refresh({ data: { orderId: o.id } }))}>Consultar</Button>
                    {env === "sandbox" && <Button size="sm" variant="secondary" onClick={() => run(() => simulate({ data: { orderId: o.id } }))}>Simular pago</Button>}
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ProductForm({ product, onSaved }: { product?: AdminData["products"][number]; onSaved: () => void }) {
  const save = useServerFn(saveProduct);
  const getUpload = useServerFn(getPdfUploadUrl);
  const attach = useServerFn(attachPdf);
  const [active, setActive] = useState(product?.active ?? true);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const file = f.get("pdf") as File | null;
    setBusy(true);
    try {
      const { id } = await save({ data: {
        id: product?.id,
        name: String(f.get("name")),
        description: String(f.get("description")),
        price: Number(String(f.get("price")).replace(",", ".")),
        active,
      } });
      if (file && file.size > 0) {
        if (file.type !== "application/pdf") throw new Error("Envie um arquivo PDF.");
        const up = await getUpload({ data: { productId: id, fileName: file.name } });
        const { error } = await supabase.storage.from("pdfs").uploadToSignedUrl(up.path, up.token, file, { contentType: "application/pdf" });
        if (error) throw new Error("Falha no envio do PDF.");
        await attach({ data: { productId: id, path: up.path, fileName: file.name } });
      }
      toast.success("Produto salvo");
      if (!product) e.currentTarget?.reset();
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">{product ? product.name : "Novo produto"}</h3>
        <label className="flex items-center gap-2 text-sm">Ativo <Switch checked={active} onCheckedChange={setActive} /></label>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_160px]">
        <div className="space-y-2"><Label>Nome</Label><Input name="name" defaultValue={product?.name} required /></div>
        <div className="space-y-2"><Label>Preço (R$)</Label><Input name="price" defaultValue={product?.price} required inputMode="decimal" /></div>
      </div>
      <div className="space-y-2"><Label>Descrição</Label><Textarea name="description" defaultValue={product?.description} rows={3} /></div>
      <div className="space-y-2">
        <Label>PDF entregue ao comprador {product?.pdf_name && <span className="text-muted-foreground">— atual: {product.pdf_name}</span>}</Label>
        <Input name="pdf" type="file" accept="application/pdf" />
        {product && !product.pdf_path && <p className="text-sm text-destructive">Nenhum PDF enviado ainda.</p>}
      </div>
      <Button type="submit" variant="chocolate" disabled={busy}>{busy ? "Salvando..." : product ? "Salvar alterações" : "Cadastrar produto"}</Button>
    </form>
  );
}

function NxSettings({ settings, onSaved }: { settings: AdminData["settings"]; onSaved: () => void }) {
  const save = useServerFn(saveSettings);
  const test = useServerFn(testConnection);
  const [env, setEnv] = useState(settings.environment);
  const [busy, setBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const qc = useQueryClient();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await save({ data: {
        apiKey: String(f.get("apiKey") || "") || undefined,
        webhookSecret: String(f.get("webhookSecret") || "") || undefined,
        environment: env,
        siteUrl: String(f.get("siteUrl") || ""),
      } });
      toast.success("Configurações salvas");
      e.currentTarget?.reset();
      onSaved();
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro"); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5 rounded-3xl bg-card p-6 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold">Integração NXGATE</h2>
        <Badge variant={settings.hasApiKey ? "default" : "outline"}>{settings.hasApiKey ? `Configurada (${settings.apiKeyHint})` : "Não configurada"}</Badge>
        <Badge variant="outline">{settings.environment === "sandbox" ? "Sandbox" : "Produção"}</Badge>
        <Badge variant="outline">Assinatura webhook: {settings.hasWebhookSecret ? "ativa" : "não definida"}</Badge>
      </div>
      <div className="space-y-2">
        <Label>API Key (api_key)</Label>
        <Input name="apiKey" type="password" placeholder={settings.hasApiKey ? "Deixe em branco para manter a atual" : "nx_live_... ou nxg_test_..."} autoComplete="off" />
      </div>
      <div className="space-y-2">
        <Label>Segredo de assinatura de webhook (HMAC) — opcional</Label>
        <Input name="webhookSecret" type="password" placeholder={settings.hasWebhookSecret ? "Deixe em branco para manter" : "Painel NXGATE → API"} autoComplete="off" />
        <p className="text-xs text-muted-foreground">Mesmo sem ele, todo pagamento é confirmado consultando a NXGATE antes de liberar o PDF.</p>
      </div>
      <div className="space-y-2">
        <Label>Ambiente</Label>
        <div className="flex gap-2">
          <Button type="button" variant={env === "production" ? "chocolate" : "outline"} onClick={() => setEnv("production")}>Produção</Button>
          <Button type="button" variant={env === "sandbox" ? "chocolate" : "outline"} onClick={() => setEnv("sandbox")}>Sandbox (testes)</Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Endereço do site (para o webhook)</Label>
        <Input name="siteUrl" defaultValue={settings.siteUrl ?? ""} placeholder="https://seudominio.com.br" />
        <p className="text-xs text-muted-foreground">Webhook usado: {(settings.siteUrl || "endereço atual do site") + "/api/public/nxgate-webhook"}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="chocolate" disabled={busy}>Salvar configurações</Button>
        <Button type="button" variant="outline" onClick={async () => setTestMsg(await test())}>Testar conexão</Button>
      </div>
      {testMsg && <p className={testMsg.ok ? "text-success" : "text-destructive"}>{testMsg.message}</p>}
    </form>
  );
}

function AppearanceSettings({ imageUrl }: { imageUrl: string | null }) {
  const save = useServerFn(saveSiteBackground);
  const [url, setUrl] = useState(imageUrl ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ data: { imageUrl: url } });
      toast.success("Imagem de fundo atualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5 rounded-3xl bg-card p-6 shadow-soft">
      <div>
        <h2 className="text-xl font-semibold">Imagem de fundo da página inicial</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe uma URL HTTPS pública. Deixe em branco para usar o fundo padrão.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="background-image-url">Endereço da imagem</Label>
        <Input
          id="background-image-url"
          type="url"
          inputMode="url"
          placeholder="https://seudominio.com.br/imagem.jpg"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </div>
      {url && (
        <div className="overflow-hidden rounded-2xl border border-border">
          <img src={url} alt="Prévia do fundo do site" className="h-48 w-full object-cover" />
        </div>
      )}
      <Button type="submit" variant="chocolate" disabled={busy}>
        {busy ? "Salvando..." : "Salvar aparência"}
      </Button>
    </form>
  );
}
