import { createFileRoute } from "@tanstack/react-router";
import { confirmOrderWithNxgate, getNxSettings, verifyWebhookSignature } from "@/lib/nxgate.server";

export const Route = createFileRoute("/api/public/nxgate-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const settings = await getNxSettings();
        if (settings.webhookSecret) {
          const ok = verifyWebhookSignature(
            settings.webhookSecret,
            request.headers.get("x-nxgate-timestamp"),
            request.headers.get("x-nxgate-signature"),
            raw,
          );
          if (!ok) return new Response("invalid signature", { status: 401 });
        }
        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("bad request", { status: 400 });
        }
        if (payload?.type !== "QR_CODE_COPY_AND_PASTE_PAID") return new Response("ok");
        const txId = typeof payload?.data?.tx_id === "string" ? payload.data.tx_id : null;
        if (!txId) return new Response("ok");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin.from("orders").select("id").eq("nx_transaction_id", txId).maybeSingle();
        if (!order) return new Response("ok");
        // Never trust the webhook body alone: confirm via POST /v2/consultar before releasing.
        await confirmOrderWithNxgate(order.id);
        return new Response("ok");
      },
    },
  },
});
