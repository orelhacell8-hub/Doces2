// Server-only NXGATE integration, following https://nxgate.com.br/doc/llms-full.txt
import { createHmac, timingSafeEqual } from "node:crypto";

export type NxSettings = {
  apiKey: string | null;
  environment: "production" | "sandbox";
  webhookSecret: string | null;
  siteUrl: string | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function getNxSettings(): Promise<NxSettings> {
  const db = await admin();
  const { data } = await db.from("app_settings").select("key,value");
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  return {
    apiKey: map.get("nxgate_api_key") || null,
    environment: map.get("nxgate_environment") === "sandbox" ? "sandbox" : "production",
    webhookSecret: map.get("nxgate_webhook_secret") || null,
    siteUrl: map.get("site_url") || null,
  };
}

export function nxBaseUrl(env: NxSettings["environment"]) {
  return env === "sandbox" ? "https://sandbox.nxgate.com.br" : "https://api.nxgate.com.br";
}

async function nxPost(path: string, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const s = await getNxSettings();
  if (!s.apiKey) throw new Error("A integração NXGATE ainda não foi configurada.");
  const res = await fetch(nxBaseUrl(s.environment) + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ api_key: s.apiKey, ...body }),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  return { status: res.status, json };
}

export async function nxCreateCharge(input: {
  valor: number;
  webhook?: string | undefined;
  magic_id: string;
  idempotencyKey: string;
  nome_pagador?: string | undefined;
  email_pagador?: string | undefined;
  documento_pagador?: string | undefined;
  descricao?: string | undefined;
}) {
  const { idempotencyKey, ...body } = input;
  const clean = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined && v !== ""));
  const r = await nxPost("/v2/cobranca", clean, { "X-Idempotency-Key": idempotencyKey });
  if (r.status !== 200 || r.json.status !== "success") {
    console.error("NXGATE cobranca error", r.status, r.json);
    const msg = r.json.message || r.json.error || "Não foi possível gerar a cobrança.";
    throw new Error(typeof msg === "string" ? msg : "Não foi possível gerar a cobrança.");
  }
  return r.json as {
    paymentCode: string | null;
    idTransaction: string;
    paymentCodeBase64: string | null;
  };
}

export async function nxConsult(transactionId: string) {
  return nxPost("/v2/consultar", { transaction_id: transactionId });
}

export function verifyWebhookSignature(secret: string, timestamp: string | null, signature: string | null, rawBody: string) {
  if (!timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const given = signature.replace(/^sha256=/, "");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(given, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Confirms an order ONLY through POST /v2/consultar returning "paid".
 * Idempotent: the update only matches orders not yet paid, so delivery happens once.
 */
export async function confirmOrderWithNxgate(orderId: string) {
  const db = await admin();
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return { status: "not_found" as const };
  if (order.status === "paid") return { status: "paid" as const };
  if (!order.nx_transaction_id) return { status: order.status };
  const r = await nxConsult(order.nx_transaction_id);
  if (r.status !== 200) {
    console.error("NXGATE consultar error", r.status, r.json);
    return { status: order.status, error: r.json.error || "Falha ao consultar" };
  }
  if (r.json.status === "paid") {
    const paidAt = r.json.paid_at || new Date().toISOString();
    await db
      .from("orders")
      .update({ status: "paid", paid_at: paidAt, delivered: true, delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .neq("status", "paid");
    return { status: "paid" as const };
  }
  return { status: "pending" as const };
}
