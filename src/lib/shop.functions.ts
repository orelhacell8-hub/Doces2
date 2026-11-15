import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { checkoutInput } from "./checkout-input";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { confirmOrderWithNxgate, getNxSettings, nxCreateCharge } from "./nxgate.server";

export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data } = await sb
    .from("products")
    .select("id,name,description,price")
    .eq("active", true)
    .order("created_at");
  return data ?? [];
});

export const getSiteBackgroundImage = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "site_background_image_url")
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar a aparência do site.");
  return data?.value ?? null;
});

function webhookUrl(siteUrl: string | null) {
  let origin = siteUrl;
  if (!origin) {
    try {
      origin = new URL(getRequest().url).origin;
    } catch {
      origin = null;
    }
  }
  if (!origin) return undefined;
  const u = new URL(origin);
  if (u.hostname === "localhost" || u.hostname.startsWith("127.") || u.protocol !== "https:") return undefined;
  return `${u.origin}/api/public/nxgate-webhook`;
}

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => checkoutInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("id", data.productId)
      .eq("active", true)
      .maybeSingle();
    if (!product) throw new Error("Produto indisponível.");

    const { data: profile } = await supabaseAdmin.from("profiles").select("*").eq("id", context.userId).maybeSingle();

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: context.userId,
        product_id: product.id,
        product_name: product.name,
        amount: product.price,
        buyer_name: profile?.full_name ?? null,
        buyer_email: profile?.email ?? (context.claims as any)?.email ?? null,
      })
      .select("*")
      .single();
    if (error || !order) throw new Error("Não foi possível criar o pedido.");

    const settings = await getNxSettings();
    try {
      const charge = await nxCreateCharge({
        valor: Number(product.price),
        webhook: webhookUrl(settings.siteUrl),
        magic_id: order.id,
        idempotencyKey: order.idempotency_key,
        nome_pagador: order.buyer_name ?? undefined,
        email_pagador: order.buyer_email ?? undefined,
        descricao: product.name.slice(0, 255),
      });
      await supabaseAdmin
        .from("orders")
        .update({
          nx_transaction_id: charge.idTransaction,
          payment_code: charge.paymentCode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
    } catch (e) {
      await supabaseAdmin.from("orders").update({ status: "failed" }).eq("id", order.id);
      throw e;
    }
    return { orderId: order.id };
  });

export const refreshOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: own } = await context.supabase.from("orders").select("id").eq("id", data.orderId).maybeSingle();
    if (!own) throw new Error("Pedido não encontrado.");
    const r = await confirmOrderWithNxgate(data.orderId);
    return { status: r.status };
  });

export const getPdfLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid(), download: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: order } = await context.supabase
      .from("orders")
      .select("id,user_id,status,delivered,product_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.user_id !== context.userId || order.status !== "paid" || !order.delivered)
      throw new Error("Acesso não autorizado a este arquivo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("pdf_path,pdf_name,name")
      .eq("id", order.product_id)
      .single();
    if (!product?.pdf_path) throw new Error("O arquivo deste produto ainda não está disponível.");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("pdfs")
      .createSignedUrl(product.pdf_path, 120, data.download ? { download: product.pdf_name || `${product.name}.pdf` } : undefined);
    if (error || !signed) throw new Error("Não foi possível gerar o acesso ao arquivo.");
    return { url: signed.signedUrl };
  });
