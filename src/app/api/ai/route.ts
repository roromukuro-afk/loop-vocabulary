import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

// ============================================================
// AI 例文・解説 API (モック実装)
// ------------------------------------------------------------
// 将来は OpenAI / Anthropic / Gemini に差し替える。
// 環境変数 AI_PROVIDER で切り替える設計にしている。
// ============================================================

const DAILY_LIMIT = 5; // 無料ユーザーの 1 日あたり利用回数

type Kind = "example" | "explain" | "etymology" | "mnemonic";

const TEMPLATES: Record<Kind, (w: string, m: string) => string> = {
  example: (w, m) =>
    `【中学】 I ${w} every day. (毎日${m}します)\n【高校】 We need to ${w} this carefully. (これを慎重に${m}する必要がある)\n【大学受験】 The committee will ${w} the proposal next week. (委員会は来週、提案を${m}するだろう)\n【英検】 ${w} (動) ${m}\n【TOEIC】 Please ${w} the documents before submission. (提出前に書類を${m}してください)`,
  explain: (w, m) =>
    `「${w}」は「${m}」を表す基本語。日常からビジネスまで幅広く使われ、目的語に物・人・事を取る用法が頻出。文法的にはSVO構造で覚えると応用が利く。`,
  etymology: (w) =>
    `「${w}」はラテン語由来とされる単語が多く、接頭辞・語根・接尾辞に分解すると意味が見えてきます (例: pro- "前へ" / -duce "導く" 等)。`,
  mnemonic: (w, m) =>
    `覚え方: 「${w}」を声に出して 3 回。意味の「${m}」を画像化して脳に焼き付ける。例文を 1 つ自作して使ってみる。`,
};

export async function POST(req: NextRequest) {
  if (!getSupabaseEnv().ok) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = (body.kind ?? "example") as Kind;
  const word = String(body.word ?? "").trim();
  const meaning = String(body.meaning ?? "").trim();
  if (!word) return NextResponse.json({ error: "word required" }, { status: 400 });

  // 利用回数チェック (日次リセット)
  const today = new Date().toISOString().slice(0, 10);
  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_ai_used, daily_ai_reset_at, is_premium")
    .eq("id", user.id)
    .single();

  const reset = profile?.daily_ai_reset_at !== today;
  const used = reset ? 0 : (profile?.daily_ai_used ?? 0);

  if (!profile?.is_premium && used >= DAILY_LIMIT) {
    // 残量チェック: リワードチケットを 1 枚消費すれば許可
    const { data: ticket } = await supabase
      .from("reward_tickets")
      .select("id, amount, used_amount")
      .eq("user_id", user.id)
      .eq("kind", "ai_generation")
      .gt("amount", 0)
      .order("granted_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!ticket || ticket.amount - ticket.used_amount <= 0) {
      return NextResponse.json(
        { error: "limit_reached", limit: DAILY_LIMIT },
        { status: 429 },
      );
    }
    await supabase.from("reward_tickets")
      .update({ used_amount: ticket.used_amount + 1 })
      .eq("id", ticket.id);
  } else {
    await supabase.from("profiles").update({
      daily_ai_used: used + 1,
      daily_ai_reset_at: today,
    }).eq("id", user.id);
  }

  // 本来はここで OpenAI 等を呼ぶ
  const result = TEMPLATES[kind]?.(word, meaning) ?? "";

  await supabase.from("ai_usage_logs").insert({
    user_id: user.id, kind, prompt: `${word} / ${meaning}`, result,
  });

  return NextResponse.json({ result, remaining: Math.max(0, DAILY_LIMIT - used - 1) });
}
