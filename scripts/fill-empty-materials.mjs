/**
 * 0語・低語数の教材を補完するスクリプト
 * node scripts/fill-empty-materials.mjs
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
    return Object.fromEntries(raw.split("\n").filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i+1).trim()]; }));
  } catch { return {}; }
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ai = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const TARGETS = [
  {
    id: "00000000-0000-0000-0000-000000000049",
    title: "loop受験英単語⑤【難関大】",
    level: "大学受験標準〜難関",
    prompt: `難関大学（早慶・旧帝大・国公立上位）の英語入試で頻出の英単語を300語生成してください。
論説・学術・社会評論分野の高度な語彙を中心に選んでください。
各単語：英単語・日本語の意味（品詞付き）・品詞・英語例文（難関大受験生レベル）・例文日本語訳。
レベルは "大学受験難関" で統一。`,
    count: 300,
  },
  {
    id: "00000000-0000-0000-0000-000000000050",
    title: "loop受験英単語⑥【超難関大】",
    level: "大学受験難関〜最難関",
    prompt: `東大・京大・医学部などの超難関大学の英語入試で頻出の英単語を300語生成してください。
哲学・科学・医療・経済・環境分野の高度な学術語彙を中心に選んでください。
各単語：英単語・日本語の意味（品詞付き）・品詞・英語例文（超難関大受験生レベル）・例文日本語訳。
レベルは "大学受験難関" で統一。`,
    count: 300,
  },
  {
    id: "00000000-0000-0000-0000-000000000054",
    title: "loop学びなおし英単語④【基礎からやり直し】",
    level: "初級",
    prompt: `英語を基礎からやり直したい社会人向けの英単語を300語生成してください。
中学英語レベルの基本語で、日常生活・買い物・仕事・家族・健康などのテーマを中心に選んでください。
各単語：英単語・日本語の意味（品詞付き）・品詞・日常英語例文・例文日本語訳。
レベルは "中学基礎" で統一。`,
    count: 300,
  },
  {
    id: "00000000-0000-0000-0000-000000000022",
    title: "英検2級 重要単語（補完）",
    level: "英検2級",
    currentCount: 349,
    targetCount: 800,
    prompt: `英検2級（CEFR B2）で頻出の英単語を450語追加生成してください。
社会・医療・環境・文化・技術分野の語彙で、英検2級の長文・語句整序・英作文頻出語を選んでください。
各単語：英単語・日本語の意味（品詞付き）・品詞・英語例文（英検2級レベル）・例文日本語訳。
レベルは "英検2級" で統一。`,
    count: 450,
    startOrder: 400,
  },
  {
    id: "00000000-0000-0000-0000-000000000023",
    title: "英検準1級 重要単語（補完）",
    level: "英検準1級",
    currentCount: 97,
    targetCount: 700,
    prompt: `英検準1級（CEFR B2〜C1）で頻出の英単語を600語生成してください。
国際・政治・経済・科学・芸術分野の高度な語彙で、英検準1級の語い問題・長文頻出語を選んでください。
各単語：英単語・日本語の意味（品詞付き）・品詞・英語例文（英検準1級レベル）・例文日本語訳。
レベルは "英検準1級" で統一。`,
    count: 600,
    startOrder: 100,
  },
];

function extractJson(raw) {
  // コードブロックを除去
  const stripped = raw.replace(/```(?:json)?\n?/g, "").trim();
  // 配列を抽出（途中で切れた場合もなるべく救う）
  const start = stripped.indexOf("[");
  if (start === -1) throw new Error("JSON配列が見つかりません");
  let text = stripped.slice(start);
  // 末尾の不完全な要素を削除して閉じる
  const lastComma = text.lastIndexOf("},");
  if (lastComma !== -1 && !text.trimEnd().endsWith("]")) {
    text = text.slice(0, lastComma + 1) + "]";
  }
  return JSON.parse(text);
}

async function generateBatch(prompt, level, count) {
  const msg = await ai.messages.create({
    model: "claude-haiku-4-5-20251001",  // 速くて十分な品質
    max_tokens: 8000,
    messages: [{
      role: "user",
      content: `${prompt}

単語数: ${count}語。
JSON配列のみ出力（コードブロック不要、説明不要）：
[{"word":"...","meaning":"...（品詞）","pos":"...","example":"...","example_ja":"...","level":"${level}","importance":4}]`,
    }],
  });
  const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
  return extractJson(raw);
}

async function generate(target) {
  // 100語ずつバッチ生成
  const batchSize = 100;
  const batches = Math.ceil(target.count / batchSize);
  const all = [];
  for (let b = 0; b < batches; b++) {
    const n = Math.min(batchSize, target.count - all.length);
    console.log(`  バッチ ${b + 1}/${batches}: ${n}語 生成中...`);
    try {
      const words = await generateBatch(target.prompt, target.level, n);
      all.push(...words);
      console.log(`    → ${words.length}語取得 (累計 ${all.length}語)`);
    } catch (e) {
      console.error(`    バッチエラー: ${e.message?.slice(0, 100)}`);
    }
  }
  return all;
}

async function insertWords(materialId, words, startOrder = 1) {
  const rows = words.map((w, i) => ({
    material_id: materialId,
    word: w.word,
    meaning: w.meaning || "",
    pos: w.pos || "",
    example: w.example || null,
    example_ja: w.example_ja || null,
    level: w.level || "",
    importance: Number(w.importance) || 4,
    frequency: Number(w.importance) || 4,
    display_order: startOrder + i,
  }));

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await sb.from("material_words").insert(chunk);
    if (error) throw error;
  }
  console.log(`  ✅ ${rows.length}語 DB投入完了`);
}

async function main() {
  console.log("🚀 空教材補完スクリプト開始\n");

  for (const t of TARGETS) {
    console.log(`\n📚 [${t.title}]`);
    const { count } = await sb.from("material_words").select("*", { count: "exact", head: true }).eq("material_id", t.id);
    const current = count ?? 0;
    console.log(`  現在 ${current}語`);

    if (t.currentCount !== undefined && current >= (t.targetCount ?? t.count)) {
      console.log(`  ⏭️  十分な語数あり → スキップ`);
      continue;
    }

    try {
      const words = await generate(t);
      await insertWords(t.id, words, t.startOrder ?? (current + 1));
    } catch (e) {
      console.error(`  ❌ エラー:`, e.message?.slice(0, 200));
    }
  }

  console.log("\n✅ 補完完了！");
}

main().catch(console.error);
