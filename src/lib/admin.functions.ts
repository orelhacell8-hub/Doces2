import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminPasswordMatches, getAdminSession, requireAdmin } from "./admin-session.server";
import { confirmOrderWithNxgate, getNxSettings, nxBaseUrl } from "./nxgate.server";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const s = await getAdminSession();
  return { admin: !!s.data.admin };
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    if (!adminPasswordMatches(data.password)) return { ok: false as const };
    const s = await getAdminSession();
    await s.update({ admin: true });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const s = await getAdminSession();
  await s.clear();
  return { ok: true };
});

export const getAdminData = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const sb = await db();
  const [
    { data: orders },
    { data: products },
    settings,
    { data: backgroundSetting, error: backgroundError },
  ] = await Promise.all([
    sb.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
    sb.from("products").select("*").order("created_at"),
    getNxSettings(),
    sb.from("app_settings").select("value").eq("key", "site_background_image_url").maybeSingle(),
  ]);
  if (backgroundError) throw new Error("Falha ao carregar a aparência do site.");
  const o = orders ?? [];
  const paid = o.filter((x) => x.status === "paid");
  return {
    stats: {
      totalSales: paid.reduce((a, x) => a + Number(x.amount), 0),
      orders: o.length,
      approved: paid.length,
      pending: o.filter((x) => x.status === "pending").length,
    },
    orders: o,
    products: products ?? [],
    settings: {
      hasApiKey: !!settings.apiKey,
      apiKeyHint: settings.apiKey ? `${settings.apiKey.slice(0, 8)}••••` : null,
      environment: settings.environment,
      hasWebhookSecret: !!settings.webhookSecret,
      siteUrl: settings.siteUrl,
      backgroundImageUrl: backgroundSetting?.value ?? null,
    },
  };
});

export const saveSettings = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        apiKey: z.string().trim().max(500).optional(),
        webhookSecret: z.string().trim().max(500).optional(),
        environment: z.enum(["production", "sandbox"]),
        siteUrl: z.string().trim().url().max(300).or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();
    const rows: { key: string; value: string; updated_at: string }[] = [];
    const now = new Date().toISOString();
    if (data.apiKey) rows.push({ key: "nxgate_api_key", value: data.apiKey, updated_at: now });
    if (data.webhookSecret) rows.push({ key: "nxgate_webhook_secret", value: data.webhookSecret, updated_at: now });
    rows.push({ key: "nxgate_environment", value: data.environment, updated_at: now });
    rows.push({ key: "site_url", value: data.siteUrl.replace(/\/$/, ""), updated_at: now });
    const { error } = await sb.from("app_settings").upsert(rows);
    if (error) throw new Error("Falha ao salvar.");
    return { ok: true };
  });

export const saveSiteBackground = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        imageUrl: z
          .string()
          .trim()
          .max(2048)
          .refine(
            (value) => {
              if (!value) return true;
              try {
                return new URL(value).protocol === "https:";
              } catch {
                return false;
              }
            },
            "Informe uma URL HTTPS válida.",
          ),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();
    const { error } = await sb.from("app_settings").upsert({
      key: "site_background_image_url",
      value: data.imageUrl || null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Falha ao salvar a imagem de fundo.");
    return { ok: true };
  });

export const testConnection = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const s = await getNxSettings();
  if (!s.apiKey) return { ok: false, message: "Nenhuma API Key configurada." };
  // /v2/consultar with an unknown id: 404 => key accepted; 401 => invalid; 403 => no cashin scope.
  const res = await fetch(nxBaseUrl(s.environment) + "/v2/consultar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: s.apiKey, transaction_id: "teste-conexao-" + Date.now() }),
  });
  if (res.status === 404 || res.status === 200) return { ok: true, message: "Conexão OK — API Key aceita pela NXGATE." };
  if (res.status === 401) return { ok: false, message: "API Key inválida para este ambiente." };
  if (res.status === 403) return { ok: false, message: "A API Key não tem permissão de cobrança (cashin)." };
  if (res.status === 429) return { ok: false, message: "Muitas tentativas. Aguarde um pouco." };
  return { ok: false, message: `Resposta inesperada da NXGATE (HTTP ${res.status}).` };
});

export const saveProduct = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(200),
        description: z.string().trim().max(5000),
        price: z.number().min(1).max(100000),
        active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();
    const { id, ...fields } = data;
    if (id) {
      const { error } = await sb.from("products").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error("Falha ao salvar produto.");
      return { id };
    }
    const { data: row, error } = await sb.from("products").insert(fields).select("id").single();
    if (error || !row) throw new Error("Falha ao criar produto.");
    return { id: row.id };
  });

export const getPdfUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ productId: z.string().uuid(), fileName: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();
    const path = `${data.productId}/${crypto.randomUUID()}.pdf`;
    const { data: up, error } = await sb.storage.from("pdfs").createSignedUploadUrl(path);
    if (error || !up) throw new Error("Falha ao preparar envio.");
    return { path, token: up.token };
  });

export const attachPdf = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ productId: z.string().uuid(), path: z.string().min(1), fileName: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();
    const { data: prev } = await sb.from("products").select("pdf_path").eq("id", data.productId).single();
    await sb.from("products").update({ pdf_path: data.path, pdf_name: data.fileName, updated_at: new Date().toISOString() }).eq("id", data.productId);
    if (prev?.pdf_path && prev.pdf_path !== data.path) await sb.storage.from("pdfs").remove([prev.pdf_path]);
    return { ok: true };
  });

export const adminRefreshOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    return confirmOrderWithNxgate(data.orderId);
  });

// Sandbox only (documented POST /v2/sandbox/simular). Disabled in production.
export const simulateSandboxPayment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const s = await getNxSettings();
    if (s.environment !== "sandbox" || !s.apiKey) throw new Error("Disponível apenas no ambiente sandbox.");
    const sb = await db();
    const { data: order } = await sb.from("orders").select("nx_transaction_id").eq("id", data.orderId).single();
    if (!order?.nx_transaction_id) throw new Error("Pedido sem cobrança.");
    const res = await fetch(nxBaseUrl("sandbox") + "/v2/sandbox/simular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: s.apiKey, transaction_id: order.nx_transaction_id, resultado: "pago" }),
    });
    if (res.status !== 200) throw new Error(`Simulação recusada (HTTP ${res.status}).`);
    return confirmOrderWithNxgate(data.orderId);
  });
