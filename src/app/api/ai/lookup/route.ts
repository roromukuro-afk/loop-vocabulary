import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { word } = await req.json().catch(() => ({}));
  if (!word || typeof word !== "string") {
    return NextResponse.json({ error: "word required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `英単語「${word.trim()}」について、以下をJSON形式で返してください。余計な説明は不要です。

{
  "meaning": "日本語訳（簡潔に、品詞込みで。例: 動 〜を記憶する）",
  "pos": "品詞（名詞/動詞/形容詞/副詞/前置詞/接続詞/その他）",
  "phonetic": "発音記号（IPA形式）",
  "example": "自然な英語例文（中学〜高校レベル）",
  "example_ja": "その例文の日本語訳"
}`,
    }],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const data = JSON.parse(match?.[0] ?? "{}");
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "parse_error" }, { status: 500 });
  }
}
