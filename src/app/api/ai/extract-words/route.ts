import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_premium").eq("id", user.id).maybeSingle();
  if (!(profile?.is_premium ?? false)) {
    return NextResponse.json({ error: "Premium required" }, { status: 403 });
  }

  const { text, level } = await req.json() as { text: string; level?: string };
  if (!text || typeof text !== "string" || text.length > 3000) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const levelHint = level ? `想定レベル: ${level}` : "英検2級〜準1級レベル";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const client = new Anthropic({ apiKey });

  const prompt = `以下の英文テキストから、日本人英語学習者が知らない可能性が高い英単語・熟語を抽出し、日本語の意味を付けてください。${levelHint}。

ルール:
- 基本すぎる単語(the, is, have, good, etc.)は除外する
- 学習価値の高い語彙を最大20語まで選ぶ
- 以下のJSON配列形式のみ出力する（他の説明は一切不要）

[
  { "word": "英単語または熟語", "meaning": "日本語の意味（簡潔に）", "pos": "品詞(n./v./adj./adv./phrase)"},
  ...
]

テキスト:
${text.slice(0, 2000)}`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ words: [] });

    const words = JSON.parse(jsonMatch[0]) as { word: string; meaning: string; pos: string }[];
    return NextResponse.json({ words: words.slice(0, 20) });
  } catch {
    return NextResponse.json({ error: "AI error" }, { status: 500 });
  }
}
