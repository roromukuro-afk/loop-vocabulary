/**
 * 単語シードスクリプト
 * 使い方:
 *   1. .env.local に SUPABASE_SERVICE_ROLE_KEY=eyJ... を追加
 *   2. node scripts/seed-words.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

// .env.local を手動パース
function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dir, "../.env.local"), "utf-8");
    return Object.fromEntries(
      raw.split("\n")
        .filter(l => l.includes("=") && !l.startsWith("#"))
        .map(l => {
          const idx = l.indexOf("=");
          return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
        })
    );
  } catch {
    return {};
  }
}

const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error("❌ .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です");
  console.error("   Supabase Dashboard → Settings → API → service_role key をコピーして追加してください");
  process.exit(1);
}

const supabase = createClient(URL, KEY, {
  auth: { persistSession: false },
});

// 実行するSQLファイル一覧（まだ未実行のもの）
const SQL_FILES = [
  "seed_extra_vol2_final_all.sql",
];

async function parseSqlRows(filePath) {
  const content = readFileSync(filePath, "utf-8");
  // VALUES の各行を抽出
  const rows = [];
  const re = /\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']*)',\s*'([^']+)',\s*(\d+),\s*(\d+)\)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    rows.push({
      material_id: m[1],
      word: m[2],
      meaning: m[3],
      pos: m[4],
      level: m[5],
      importance: parseInt(m[6]),
      display_order: parseInt(m[7]),
    });
  }
  return rows;
}

async function insertChunk(rows) {
  const { error, count } = await supabase
    .from("material_words")
    .upsert(rows, { onConflict: "material_id,word", ignoreDuplicates: true })
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return rows.length;
}

async function main() {
  console.log("🚀 単語シード開始");
  let grandTotal = 0;

  for (const fileName of SQL_FILES) {
    const filePath = resolve(__dir, "../supabase", fileName);
    console.log(`\n📄 ${fileName} を処理中...`);

    let rows;
    try {
      rows = await parseSqlRows(filePath);
    } catch (e) {
      console.error(`  ❌ ファイル読み込み失敗: ${e.message}`);
      continue;
    }

    console.log(`  📝 ${rows.length} 行を解析しました`);

    // 100行ずつチャンク処理
    const CHUNK = 100;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      try {
        await insertChunk(chunk);
        inserted += chunk.length;
        process.stdout.write(`\r  ✅ ${inserted}/${rows.length} 処理済み`);
      } catch (e) {
        console.error(`\n  ❌ チャンク ${i}-${i + CHUNK} でエラー: ${e.message}`);
      }
    }
    console.log(`\n  ✅ ${fileName} 完了: ${inserted} 行処理`);
    grandTotal += inserted;
  }

  // 最終カウント確認
  const { count } = await supabase
    .from("material_words")
    .select("id", { count: "exact", head: true });

  console.log(`\n🎉 完了！ 合計 ${count} 語が DB に登録されています`);
}

main().catch(e => {
  console.error("❌ エラー:", e.message);
  process.exit(1);
});
