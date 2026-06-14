import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import Anthropic from "@anthropic-ai/sdk";

const DAILY_LIMIT = 5;

type Kind = "example" | "explain" | "etymology" | "mnemonic";

// Claude APIキーがなければモックにフォールバック
const MOCK_TEMPLATES: Record<Kind, (w: string, m: string) => string> = {
  example: (w, m) =>
    `【中学】 I ${w} every day. (毎日${m}します)\n【高校】 We need to ${w} this carefully. (これを慎重に${m}する必要がある)\n【大学受験】 The committee will ${w} the proposal next week. (委員会は来週、提案を${m}するだろう)\n【英検】 ${w} (動) ${m}\n【TOEIC】 Please ${w} the documents before submission. (提出前に書類を${m}してください)`,
  explain: (w, m) =>
    `「${w}」は「${m}」を表す基本語。日常からビジネスまで幅広く使われ、目的語に物・人・事を取る用法が頻出。\n\n文法的にはSVO構造で覚えると応用が利く。入試では名詞形・形容詞形との区別も問われやすい。`,
  etymology: (w) =>
    `「${w}」はラテン語・ギリシャ語由来とされる単語です。接頭辞・語根・接尾辞に分解すると意味の連想がしやすくなります。\n\n例: pro- "前へ" / -duce "導く" → produce "産出する"`,
  mnemonic: (w, m) =>
    `覚え方のコツ:\n1. 「${w}」を声に出して3回繰り返す\n2. 「${m}」を具体的な場面でイメージする\n3. 例文を1つ自作してノートに書く\n\nこの3ステップを使うと記憶への定着率が大きく上がります。`,
};

function buildPrompt(kind: Kind, word: string, meaning: string): string {
  const prompts: Record<Kind, string> = {
    example: `英単語「${word}」（意味: ${meaning}）について、以下の5レベル別に自然な英語例文と日本語訳を作成してください。必ず各レベルのラベルを付けてください。

【中学レベル】
（シンプルな日常会話の例文）

【高校レベル】
（少し複雑な文構造）

【大学受験レベル】
（入試頻出の構文・文脈）

【英検2級レベル】
（英検2級に出やすいフォーマル文）

【TOEICレベル】
（ビジネス・オフィス文脈）

余計な説明は不要です。各レベルの例文と和訳のみ出力してください。`,

    explain: `英単語「${word}」（意味: ${meaning}）について、日本人英語学習者向けに以下の観点で解説してください（200字以内）：

・基本的なニュアンスと使い分け
・よく使われる文脈・場面
・入試・英検・TOEICでの出題傾向
・混同しやすい類義語との違い（あれば）

簡潔でわかりやすい日本語で説明してください。`,

    etymology: `英単語「${word}」（意味: ${meaning}）の語源・成り立ちを解説してください（150字以内）：

・語源（ラテン語・ギリシャ語・フランス語など）
・語根・接頭辞・接尾辞の意味
・関連する派生語（2〜3個）

日本人学習者が単語の意味を連想しやすくなる解説をしてください。`,

    mnemonic: `英単語「${word}」（意味: ${meaning}）の覚え方を3つ提案してください：

1. 語呂合わせ・音の連想
2. 画像・ストーリーによる記憶法
3. 派生語・フレーズでまとめて覚える方法

実際に使えて記憶に残りやすい具体的な方法を教えてください。`,
  };
  return prompts[kind];
}

async function callClaude(kind: Kind, word: string, meaning: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // APIキー未設定 → モックにフォールバック
    return MOCK_TEMPLATES[kind](word, meaning);
  }

  const client = new Anthropic({ apiKey });

  // claude-haiku-4-5 → fallback to claude-3-5-haiku
  let message;
  try {
    message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: buildPrompt(kind, word, meaning) }],
    });
  } catch {
    message = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 600,
      messages: [{ role: "user", content: buildPrompt(kind, word, meaning) }],
    });
  }

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}

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

  // 利用回数チェック（日次リセット）
  const today = new Date().toISOString().slice(0, 10);
  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_ai_used, daily_ai_reset_at, is_premium")
    .eq("id", user.id)
    .single();

  const reset = profile?.daily_ai_reset_at !== today;
  const used = reset ? 0 : (profile?.daily_ai_used ?? 0);

  if (!profile?.is_premium && used >= DAILY_LIMIT) {
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
      return NextResponse.json({ error: "limit_reached", limit: DAILY_LIMIT }, { status: 429 });
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

  let result: string;
  try {
    result = await callClaude(kind, word, meaning);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[AI route] callClaude failed:", msg);
    return NextResponse.json({ error: `AI生成に失敗しました: ${msg}` }, { status: 500 });
  }

  await supabase.from("ai_usage_logs").insert({
    user_id: user.id, kind, prompt: `${word} / ${meaning}`, result,
  }).then(() => {}).catch(() => {});

  return NextResponse.json({ result, remaining: Math.max(0, DAILY_LIMIT - used - 1) });
}
