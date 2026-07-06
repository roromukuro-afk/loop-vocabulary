import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { consumeAiQuota } from "@/lib/ai/aiQuota";
import { logAiUsageEvent, quotaSourceFromReason } from "@/lib/ai/logAiUsage";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    await logAiUsageEvent({ userId: null, route: "weakness-analysis", isPremium: false, status: "unauthorized" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("is_premium").eq("id", user.id).maybeSingle();
  if (!(profile?.is_premium ?? false)) {
    await logAiUsageEvent({ userId: user.id, route: "weakness-analysis", isPremium: false, status: "premium_required" });
    return NextResponse.json({ error: "Premium required" }, { status: 403 });
  }

  // 苦手単語（間違い回数が多い・is_weak）を取得
  const { data: weakWords } = await supabase
    .from("words")
    .select("word, meaning, wrong_count, correct_count, streak, pos")
    .eq("user_id", user.id)
    .or("is_weak.eq.true,wrong_count.gt.0")
    .order("wrong_count", { ascending: false })
    .limit(50);

  if (!weakWords || weakWords.length === 0) {
    return NextResponse.json({
      analysis: {
        summary: "まだ学習データが不十分です。テストを続けて弱点データを蓄積しましょう。",
        patterns: [],
        recommendations: ["まず20語以上の単語を登録してテストを始めましょう", "4択テストと入力テストを組み合わせると弱点が早く見つかります"],
        nextSteps: []
      }
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const quota = await consumeAiQuota(supabase);
  if (!quota.allowed) {
    await logAiUsageEvent({ userId: user.id, route: "weakness-analysis", isPremium: quota.isPremium, status: "quota_denied", quotaSource: "blocked" });
    return NextResponse.json({ error: quota.reason }, { status: 429 });
  }
  const quotaSource = quotaSourceFromReason(quota.reason, quota.isPremium);
  const startedAt = Date.now();

  const wordList = weakWords.slice(0, 30).map((w) =>
    `${w.word}（${w.meaning}）: 誤${w.wrong_count}回/正${w.correct_count}回 [${w.pos ?? "不明"}]`
  ).join("\n");

  const totalWords = weakWords.length;
  const avgWrong = weakWords.reduce((s, w) => s + (w.wrong_count ?? 0), 0) / totalWords;

  const prompt = `英語学習者の弱点単語データを分析し、パターンと改善策を提案してください。

【間違いの多い単語リスト（上位${Math.min(30, totalWords)}語）】
${wordList}

【統計】
- 苦手語総数: ${totalWords}語
- 平均誤答回数: ${avgWrong.toFixed(1)}回

以下のJSON形式で分析結果を出力してください（他の説明は不要）：

{
  "summary": "2〜3行でこの学習者の弱点の傾向をまとめた文章",
  "patterns": [
    {
      "type": "品詞・語形などのカテゴリ（例：動詞の変化形、抽象名詞）",
      "description": "具体的な弱点の説明",
      "examples": ["弱点を示す単語1", "単語2"]
    }
  ],
  "recommendations": ["具体的な改善策1", "改善策2", "改善策3"],
  "nextSteps": ["今日からできる学習アクション1", "アクション2"]
}`;

  const inputSize = wordList.length;
  const client = new Anthropic({ apiKey });
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      await logAiUsageEvent({
        userId: user.id, route: "weakness-analysis", isPremium: quota.isPremium, status: "ai_error",
        quotaSource, errorType: "parse_error", durationMs: Date.now() - startedAt, inputSize,
      });
      return NextResponse.json({ error: "AI parse error" }, { status: 500 });
    }

    const analysis = JSON.parse(jsonMatch[0]);
    await logAiUsageEvent({
      userId: user.id, route: "weakness-analysis", isPremium: quota.isPremium, status: "success",
      quotaSource, durationMs: Date.now() - startedAt, inputSize, outputSize: raw.length,
    });
    return NextResponse.json({ analysis, weakCount: totalWords });
  } catch {
    await logAiUsageEvent({
      userId: user.id, route: "weakness-analysis", isPremium: quota.isPremium, status: "ai_error",
      quotaSource, errorType: "anthropic_call_failed", durationMs: Date.now() - startedAt, inputSize,
    });
    return NextResponse.json({ error: "AI error" }, { status: 500 });
  }
}
