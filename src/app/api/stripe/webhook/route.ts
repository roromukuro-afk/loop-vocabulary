import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Next.js は body を自動 parse するが webhook は raw body が必要
export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(stripeKey);
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const userId = session.subscription
        ? undefined
        : (session.metadata?.supabase_user_id ?? undefined);

      await admin.from("profiles").update({
        is_premium: true,
        premium_expires_at: null,
      }).eq("stripe_customer_id", customerId);

      if (userId) {
        await admin.from("profiles").update({
          is_premium: true,
          stripe_customer_id: customerId,
          premium_expires_at: null,
        }).eq("id", userId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const active = sub.status === "active" || sub.status === "trialing";
      const expiresAt = !active
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;
      await admin.from("profiles").update({
        is_premium: active,
        premium_expires_at: expiresAt,
      }).eq("stripe_customer_id", customerId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      await admin.from("profiles").update({
        is_premium: false,
        premium_expires_at: new Date().toISOString(),
      }).eq("stripe_customer_id", customerId);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      // 支払い失敗: プレミアム維持（Stripe が自動リトライ）、必要に応じメール送信
      console.warn("[stripe webhook] payment_failed for customer", customerId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
