import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { consumePremiumDailyAiUsage } from "@/lib/ai/premiumDailyCap";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_premium").eq("id", user.id).maybeSingle();
  if (!(profile?.is_premium ?? false)) {
    return NextResponse.json({ error: "Premium required" }, { status: 403 });
  }

  const { exam, targetDate, currentLevel, dailyMinutes } = await req.json().catch(() => ({})) as {
    exam?: string;
    targetDate?: string;
    currentLevel?: string;
    dailyMinutes?: number;
  };

  if (!exam || !targetDate) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  if (exam.length > 100 || (currentLevel && currentLevel.length > 100)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const now = new Date();
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const safeDailyMinutes = Math.min(Math.max(Number(dailyMinutes) || 30, 5), 600);
  const daysLeft = Math.max(1, Math.min(3650, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const allowed = await consumePremiumDailyAiUsage(supabase, user.id);
  if (!allowed) {
    return NextResponse.json({ error: "premium_daily_limit_reached" }, { status: 429 });
  }

  const prompt = `あなたは英語学習コーチです。以下の条件で最適な英語学習プランを作成してください。

【条件】
- 目標: ${exam}
- 試験日/目標達成日: ${targetDate}（今日から ${daysLeft} 日後）
- 現在のレベル: ${currentLevel}
- 1日の学習時間: ${safeDailyMinutes} 分

以下のJSON形式で学習プランを出力してください（他の説明は不要）：

{
  "summary": "3行以内の総括（現状→目標へのロードマップ）",
  "totalWords": 目標語彙数(数値),
  "dailyWords": 1日の推奨新規単語数(数値),
  "reviewWords": 1日の復習単語数(数値),
  "phases": [
    {
      "name": "フェーズ名（例：基礎固め期）",
      "weeks": 期間（週数、数値）,
      "focus": "この期間のメインテーマ",
      "wordCount": この期間の目標単語数(数値),
      "tasks": ["毎日のタスク1", "毎日のタスク2", "週1回のタスク"]
    }
  ],
  "tips": ["合格のためのアドバイス1", "アドバイス2", "アドバイス3"],
  "warnings": ["注意点や落とし穴1", "注意点2"]
}`;

  const client = new Anthropic({ apiKey });
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "AI parse error" }, { status: 500 });

    const plan = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ plan, daysLeft });
  } catch {
    return NextResponse.json({ error: "AI error" }, { status: 500 });
  }
}
