import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import Anthropic from "@anthropic-ai/sdk";
import { consumeAiQuota } from "@/lib/ai/aiQuota";

export const runtime = "nodejs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase } = await requireUser();

  // プレミアムチェック
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_premium) {
    return NextResponse.json({ error: "プレミアムプランが必要です" }, { status: 403 });
  }

  const { id } = await params;
  const { count } = (await req.json().catch(() => ({}))) as { count?: number };
  const n = Math.min(Math.max(Number(count ?? 10), 5), 20);

  // 単語帳の単語を取得
  const { data: words } = await supabase
    .from("words")
    .select("word, meaning")
    .eq("word_book_id", id)
    .eq("user_id", user.id)
    .limit(50);

  if (!words || words.length === 0) {
    return NextResponse.json({ error: "単語帳に単語が登録されていません" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const quota = await consumeAiQuota(supabase);
  if (!quota.allowed) {
    return NextResponse.json({ error: quota.reason }, { status: 429 });
  }

  const wordList = words.map((w) => `${w.word}（${w.meaning}）`).join("、");

  let raw: string;
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `以下の英単語帳に登録されている単語から学習者の語彙レベルと学習テーマを推測し、関連する英単語を${n}語提案してください。

登録済み単語: ${wordList}

以下のJSON形式で返してください。説明文は不要です。
[
  { "word": "英単語", "meaning": "日本語の意味（短く）", "pos": "品詞略称（n./v./adj.等）" },
  ...
]`,
        },
      ],
    });
    raw = message.content[0].type === "text" ? message.content[0].text : "";
  } catch (e) {
    console.error("[ai-suggest] messages.create failed:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "AI応答の取得に失敗しました" }, { status: 500 });
  }

  // JSON部分を抽出
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) {
    return NextResponse.json({ error: "AI応答のパースに失敗しました" }, { status: 500 });
  }

  try {
    const suggestions = JSON.parse(match[0]) as { word: string; meaning: string; pos: string }[];
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: "AI応答のパースに失敗しました" }, { status: 500 });
  }
}
