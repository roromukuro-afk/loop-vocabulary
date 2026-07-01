/**
 * 単語帳自動生成スクリプト
 * Claude API で単語リストを生成 → Supabase に直接投入
 *
 * 使い方: node scripts/generate-materials.mjs
 */
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dir, "../.env.local"), "utf-8");
    return Object.fromEntries(
      raw.split("\n")
        .filter(l => l.includes("=") && !l.startsWith("#"))
        .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
    );
  } catch { return {}; }
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// ── 追加する教材定義 ───────────────────────────────────────────
const MATERIALS = [
  {
    id: "00000000-0000-0000-0000-000000000030",
    title: "英検3級 重要単語",
    description: "英検3級合格に必要な重要英単語。中学2〜3年レベル（CEFR A2）の語彙を収録。",
    level: "英検3級",
    exam_type: "英検",
    wordCount: 200,
    prompt: `英検3級（中学2〜3年レベル、CEFR A2）の重要英単語を200語生成してください。
日常会話・学校・家族・食事・買い物・趣味・旅行などのテーマで、英検3級の出題傾向に合った単語を選んでください。
各単語に: 英単語・日本語の意味・品詞・英語例文（中学生レベル）・例文の日本語訳 を含めてください。
レベルは全て "英検3級" で統一してください。`,
  },
  {
    id: "00000000-0000-0000-0000-000000000031",
    title: "英検準2級 重要単語",
    description: "英検準2級合格に必要な重要英単語。高校基礎レベル（CEFR B1）の語彙を収録。",
    level: "英検準2級",
    exam_type: "英検",
    wordCount: 200,
    prompt: `英検準2級（高校基礎〜標準レベル、CEFR B1）の重要英単語を200語生成してください。
社会・環境・科学・医療・文化などのテーマで、英検準2級の出題傾向に合った単語を選んでください。
各単語に: 英単語・日本語の意味・品詞・英語例文（高校生レベル）・例文の日本語訳 を含めてください。
レベルは全て "英検準2級" で統一してください。`,
  },
  {
    id: "00000000-0000-0000-0000-000000000032",
    title: "TOEIC 基礎単語 600点目標",
    description: "TOEIC 600点を目指す基礎単語。オフィス・日常ビジネスシーン頻出の語彙。",
    level: "TOEIC基礎",
    exam_type: "TOEIC",
    wordCount: 200,
    prompt: `TOEIC L&R 600点目標の基礎単語を200語生成してください。
オフィスワーク・メール・会議・電話・出張・採用・購買などのビジネスシーンに頻出の単語を選んでください。
各単語に: 英単語・日本語の意味・品詞・ビジネス場面の英語例文・例文の日本語訳 を含めてください。
レベルは全て "TOEIC基礎" で統一してください。`,
  },
  {
    id: "00000000-0000-0000-0000-000000000033",
    title: "TOEIC 標準単語 800点目標",
    description: "TOEIC 800点を目指す標準〜応用単語。ビジネス英語の幅を広げる語彙。",
    level: "TOEIC標準",
    exam_type: "TOEIC",
    wordCount: 200,
    prompt: `TOEIC L&R 800点目標の標準〜応用単語を200語生成してください。
財務・マーケティング・人事・法務・物流・製造などのビジネス専門シーンに頻出の単語を選んでください。
各単語に: 英単語・日本語の意味・品詞・ビジネス英語例文・例文の日本語訳 を含めてください。
レベルは全て "TOEIC標準" で統一してください。`,
  },
  {
    id: "00000000-0000-0000-0000-000000000034",
    title: "高校英語 基礎単語",
    description: "高校1〜2年レベルの基礎英単語。共通テスト・大学受験の土台となる語彙。",
    level: "高校基礎",
    exam_type: "高校",
    wordCount: 200,
    prompt: `高校1〜2年レベルの基礎英単語を200語生成してください。
共通テストや大学入試の土台となる高校英語の重要語彙で、日常・社会・学術的なテーマをバランスよく含めてください。
各単語に: 英単語・日本語の意味・品詞・英語例文（高1〜2レベル）・例文の日本語訳 を含めてください。
レベルは全て "高校基礎" で統一してください。`,
  },
];

// ── Claude で単語生成 ──────────────────────────────────────────
async function generateWords(material) {
  console.log(`  Claude に ${material.wordCount}語 生成を依頼中...`);

  const msg = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 8000,
    messages: [{
      role: "user",
      content: `${material.prompt}

以下のJSON配列形式で出力してください。余計な説明・コードブロック記号は不要です。配列だけ出力してください。

[
  {
    "word": "英単語",
    "meaning": "日本語の意味（品詞付き。例: 動 〜を達成する）",
    "pos": "品詞",
    "example": "英語例文",
    "example_ja": "例文の日本語訳",
    "level": "${material.level}",
    "importance": 4
  }
]`
    }],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text : "";

  // JSON配列を抽出
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("JSON配列が見つかりません:\n" + raw.slice(0, 500));

  const words = JSON.parse(match[0]);
  console.log(`  ✅ ${words.length}語 生成完了`);
  return words;
}

// ── Supabase に投入 ────────────────────────────────────────────
async function upsertMaterial(material) {
  const { error } = await supabase.from("materials").upsert({
    id: material.id,
    title: material.title,
    publisher: "Loop Vocabulary",
    author: "Loop Vocabulary",
    description: material.description,
    level: material.level,
    exam_type: material.exam_type,
    license_id: "00000000-0000-0000-0000-000000000001",
    license_status: "approved",
    is_public: true,
  }, { onConflict: "id" });

  if (error) throw error;
  console.log(`  ✅ 教材レコード upsert 完了`);
}

async function insertWords(materialId, words) {
  const rows = words.map((w, i) => ({
    material_id: materialId,
    word: w.word,
    meaning: w.meaning,
    pos: w.pos || "",
    example: w.example || null,
    example_ja: w.example_ja || null,
    level: w.level,
    importance: w.importance || 4,
    frequency: w.importance || 4,
    display_order: i + 1,
  }));

  // 100件ずつ分割して投入
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabase.from("material_words")
      .upsert(chunk, { onConflict: "material_id,word", ignoreDuplicates: true });
    if (error) throw error;
  }
  console.log(`  ✅ ${rows.length}語 DB投入完了`);
}

// ── ライセンスの確認・作成 ─────────────────────────────────────
async function ensureLicense() {
  await supabase.from("licenses").upsert({
    id: "00000000-0000-0000-0000-000000000001",
    name: "Loop Vocabulary オリジナル",
    status: "approved",
    note: "Loop Vocabulary が独自に作成したオリジナル単語データ",
    approved_at: new Date().toISOString(),
  }, { onConflict: "id" });
}

// ── メイン ────────────────────────────────────────────────────
async function main() {
  console.log("🚀 単語帳自動生成スクリプト開始\n");

  await ensureLicense();

  for (const material of MATERIALS) {
    console.log(`\n📚 [${material.title}]`);
    try {
      // 既に単語が入っているかチェック
      const { count } = await supabase.from("material_words")
        .select("*", { count: "exact", head: true })
        .eq("material_id", material.id);

      if ((count ?? 0) > 50) {
        console.log(`  ⏭️  既に ${count}語 存在 → スキップ`);
        continue;
      }

      await upsertMaterial(material);
      const words = await generateWords(material);
      await insertWords(material.id, words);
    } catch (e) {
      console.error(`  ❌ エラー:`, e.message);
    }
  }

  console.log("\n✅ 全教材の生成完了！");
  console.log("Supabase で確認: SELECT title, exam_type FROM materials ORDER BY exam_type;");
}

main().catch(console.error);
