import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PRICES = {
  monthly: process.env.STRIPE_PRICE_ID_MONTHLY ?? "",
  yearly:  process.env.STRIPE_PRICE_ID_YEARLY  ?? "",
};

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://loop-vocabulary.app";

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const plan = (body.plan ?? "monthly") as "monthly" | "yearly";
  const priceId = PRICES[plan];
  if (!priceId) {
    return NextResponse.json({ error: "price_not_configured" }, { status: 503 });
  }

  const stripe = new Stripe(stripeKey);
  const admin = createAdminClient();

  // 既存の Stripe customer ID を取得
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, is_premium")
    .eq("id", user.id)
    .single();

  // すでにPremiumのユーザーが誤って/直接APIを叩いても二重サブスクリプション（二重課金）を
  // 作らないよう、事前にis_premiumを確認する（UI側では/premiumページが既にチェックアウト
  // ボタン自体を非表示にしているため通常到達しないが、API単体としての安全策）。
  if (profile?.is_premium) {
    return NextResponse.json({ error: "already_premium" }, { status: 409 });
  }

  let customerId = profile?.stripe_customer_id ?? undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${BASE_URL}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${BASE_URL}/premium`,
    allow_promotion_codes: true,
    metadata: { supabase_user_id: user.id, plan },
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
    locale: "ja",
  });

  return NextResponse.json({ url: session.url });
}
