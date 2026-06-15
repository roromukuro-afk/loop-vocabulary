import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PACKS = {
  "30":  { amount: 300,  credits: 30,  label: "AI解説 30回パック" },
  "100": { amount: 800,  credits: 100, label: "AI解説 100回パック" },
} as const;

type Pack = keyof typeof PACKS;

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const pack = String(body.pack ?? "30") as Pack;
  if (!PACKS[pack]) return NextResponse.json({ error: "invalid_pack" }, { status: 400 });

  const { amount, credits, label } = PACKS[pack];
  const stripe = new Stripe(stripeKey);

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  let customerId = (profile as Record<string, unknown>)?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabase.from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const origin = req.headers.get("origin") ?? "https://loop-vocabulary.vercel.app";
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "jpy",
        product_data: { name: label, description: `Loop Vocabulary ${label}` },
        unit_amount: amount,
      },
      quantity: 1,
    }],
    metadata: {
      kind: "ai_credits",
      supabase_user_id: user.id,
      credits: String(credits),
    },
    success_url: `${origin}/ai?credits_added=${credits}`,
    cancel_url: `${origin}/ai`,
    locale: "ja",
  });

  return NextResponse.json({ url: session.url });
}
