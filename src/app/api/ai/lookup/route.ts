import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { consumeAiQuota } from "@/lib/ai/aiQuota";

export const runtime = "nodejs";

const MAX_WORD_LENGTH = 100;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { word } = await req.json().catch(() => ({}));
  if (!word || typeof word !== "string" || word.trim().length === 0) {
    return NextResponse.json({ error: "word required" }, { status: 400 });
  }
  if (word.length > MAX_WORD_LENGTH) {
    return NextResponse.json({ error: "input_too_long" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  // AI辞書ルックアップも「AI利用」の一種として、メイン解説APIと同じ日次カウンター・
  // ai_generationチケット救済・Premium安全網をDB側RPCでatomicに共有する
  // （無料5回/日、超過分はチケット消費、Premiumは300回/日ソフト上限）。
  const quota = await consumeAiQuota(supabase);
  if (!quota.allowed) {
    return NextResponse.json({ error: quota.reason }, { status: 429 });
  }

  const client = new Anthropic({ apiKey });
  let raw: string;
  try {
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
    raw = msg.content[0].type === "text" ? msg.content[0].text : "";
  } catch (e) {
    console.error("[AI lookup] messages.create failed:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "ai_error" }, { status: 500 });
  }

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const data = JSON.parse(match?.[0] ?? "{}");
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "parse_error" }, { status: 500 });
  }
}
