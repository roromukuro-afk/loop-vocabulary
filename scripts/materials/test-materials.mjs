/**
 * プリセット教材パックのエンドツーエンド検証。
 *
 * 1. 静的検証(validate-materials.mjs)を先に実行（失敗したら即中断）
 * 2. 全プリセットパックを materials/material_words に投入（冪等・対象は固定IDのみ）
 * 3. DB上の語数がパック定義と一致することを確認
 * 4. テストユーザー(test+onboarding)への実際のインポート処理を模擬し、
 *    生成された words 行が SRS(ease_factor/interval_days/next_review_at)・
 *    PDFテスト（word_book_id経由で参照可能）の両方で使える状態になっているか確認
 * 5. テストで作成した単語帳・単語を削除してクリーンな状態に戻す（冪等）
 *
 * 使い方: node scripts/materials/test-materials.mjs
 */
import { execFileSync } from "child_process";
import { getAdminClient } from "../testing/lib/supabaseAdmin.mjs";
import { loadEnv, requireEnv, REPO_ROOT } from "../testing/lib/env.mjs";
import { TEST_ACCOUNTS } from "../testing/lib/testAccounts.mjs";
import { resolveUserId } from "../testing/seed-test-data.mjs";
import { seedPresetMaterials } from "./seed-preset-materials.mjs";
import { auditExistingMaterials, writeAuditReports } from "./audit-existing-materials.mjs";
import { juniorBasic100 } from "../../src/data/presets/junior-basic-100.ts";
import { highschoolBasic100 } from "../../src/data/presets/highschool-basic-100.ts";
import { eikenPre2Basic100 } from "../../src/data/presets/eiken-pre2-basic-100.ts";
import { universityBasicVerbs100 } from "../../src/data/presets/university-basic-verbs-100.ts";
import { eiken3Basic100 } from "../../src/data/presets/eiken3-basic-100.ts";
import { highschoolBasic100Part2 } from "../../src/data/presets/highschool-basic-100-part2.ts";
import { universityBasicNouns100 } from "../../src/data/presets/university-basic-nouns-100.ts";
import { dailyConversationUltraBasic50 } from "../../src/data/presets/daily-conversation-ultra-basic-50.ts";
import { toeicBasic100 } from "../../src/data/presets/toeic-basic-100.ts";
import { toeicFrequentVerbs100 } from "../../src/data/presets/toeic-frequent-verbs-100.ts";
import { businessBasic100 } from "../../src/data/presets/business-basic-100.ts";
import { meetingEmailEnglish100 } from "../../src/data/presets/meeting-email-english-100.ts";
import { toeicFrequentNouns100 } from "../../src/data/presets/toeic-frequent-nouns-100.ts";
import { economicNewsVocabulary100 } from "../../src/data/presets/economic-news-vocabulary-100.ts";
import { corporateNewsVocabulary100 } from "../../src/data/presets/corporate-news-vocabulary-100.ts";

const PRESET_PACKS = [
  juniorBasic100,
  highschoolBasic100,
  eikenPre2Basic100,
  universityBasicVerbs100,
  eiken3Basic100,
  highschoolBasic100Part2,
  universityBasicNouns100,
  dailyConversationUltraBasic50,
  toeicBasic100,
  toeicFrequentVerbs100,
  businessBasic100,
  meetingEmailEnglish100,
  toeicFrequentNouns100,
  economicNewsVocabulary100,
  corporateNewsVocabulary100,
];
const PRESET_PACK_IDS = new Set(PRESET_PACKS.map((p) => p.id));

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  console.log("=== 1. 静的検証 (validate:materials) ===");
  try {
    execFileSync(process.execPath, ["scripts/materials/validate-materials.mjs"], {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });
    ok("静的検証: 全パックOK");
  } catch {
    bad("静的検証でエラーが検出されました（詳細は上記ログ参照）。DB投入を中断します。");
    printSummary();
    process.exit(1);
  }

  const admin = getAdminClient();

  console.log("\n=== 2. materials/material_words へ投入（冪等） ===");
  const seedResults = await seedPresetMaterials(admin);
  for (const r of seedResults) console.log(`  ${r.title}: ${r.wordCount}語`);
  ok(`${seedResults.length}パックを投入`);

  console.log("\n=== 3. DB上の語数がパック定義と一致するか確認 ===");
  for (const pack of PRESET_PACKS) {
    const { count, error } = await admin
      .from("material_words")
      .select("*", { count: "exact", head: true })
      .eq("material_id", pack.id);
    if (error) { bad(`${pack.title}: 語数取得に失敗 (${error.message})`); continue; }
    if (count === pack.words.length) ok(`${pack.title}: DB語数(${count})がパック定義(${pack.words.length})と一致`);
    else bad(`${pack.title}: DB語数(${count})がパック定義(${pack.words.length})と不一致`);

    const { data: matRow, error: matErr } = await admin
      .from("materials")
      .select("is_public, license_status")
      .eq("id", pack.id)
      .maybeSingle();
    if (matErr || !matRow) { bad(`${pack.title}: materials行が取得できません`); continue; }
    if (matRow.is_public && ["approved", "original"].includes(matRow.license_status)) {
      ok(`${pack.title}: is_public=true かつ license_status=${matRow.license_status}（公開・インポート可能な状態）`);
    } else {
      bad(`${pack.title}: 公開設定が想定外 (is_public=${matRow.is_public}, license_status=${matRow.license_status})`);
    }
  }

  console.log("\n=== 4. インポート後にSRS・PDFテストで使える状態か確認（test+onboarding） ===");
  const userId = await resolveUserId(admin, TEST_ACCOUNTS.onboarding.email);
  const testPack = PRESET_PACKS[0]; // 中学英単語 基礎100 で代表確認

  // 既存のテスト用単語帳が残っていれば先に削除（前回実行の後始末・冪等性確保）
  const { data: existingBooks } = await admin
    .from("word_books")
    .select("id")
    .eq("user_id", userId)
    .eq("source_material_id", testPack.id);
  for (const b of existingBooks ?? []) {
    await admin.from("words").delete().eq("word_book_id", b.id);
    await admin.from("word_books").delete().eq("id", b.id);
  }

  // 実際の /api/material/[id]/import と同じロジックでインポートを模擬
  const { data: book, error: bookErr } = await admin
    .from("word_books")
    .insert({
      user_id: userId,
      title: testPack.title,
      level: testPack.level,
      exam_type: testPack.examType,
      source_type: "material",
      source_material_id: testPack.id,
      description: `教材「${testPack.title}」からインポート`,
    })
    .select("id")
    .single();
  if (bookErr || !book) {
    bad(`単語帳の作成に失敗: ${bookErr?.message}`);
  } else {
    ok("単語帳を作成できた（source_type=material, source_material_id設定済み）");

    const { data: mwords } = await admin
      .from("material_words")
      .select("word, meaning, pos, example, example_ja, importance")
      .eq("material_id", testPack.id)
      .order("display_order", { ascending: true });

    const now = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const rows = (mwords ?? []).map((m) => ({
      user_id: userId,
      word_book_id: book.id,
      word: m.word,
      meaning: m.meaning,
      pos: m.pos,
      example: m.example,
      example_ja: m.example_ja,
      importance: m.importance,
      material_id: testPack.id,
      license_status: "approved",
      next_review_at: now,
    }));
    const { error: wErr } = await admin.from("words").insert(rows);
    if (wErr) {
      bad(`単語のインポートに失敗: ${wErr.message}`);
    } else {
      ok(`${rows.length}語をインポートできた`);

      const { data: importedWords } = await admin
        .from("words")
        .select("ease_factor, interval_days, next_review_at, word_book_id, material_id")
        .eq("word_book_id", book.id);

      const allSrsReady = (importedWords ?? []).every(
        (w) => w.ease_factor === 2.5 && w.interval_days === 0 && w.next_review_at !== null,
      );
      if (allSrsReady && (importedWords ?? []).length === rows.length) {
        ok("インポートされた単語はすべてSRS既定値(ease_factor=2.5, interval_days=0)・next_review_at設定済み＝SRS復習で使える状態");
      } else {
        bad("インポートされた単語のSRSフィールドが想定外の値になっています");
      }

      const allHaveBookId = (importedWords ?? []).every((w) => w.word_book_id === book.id);
      if (allHaveBookId) ok("インポートされた単語はword_book_id経由でPDFテスト生成の対象にできる状態");
      else bad("word_book_idが正しく設定されていない単語があります");
    }

    // 後始末（テストデータを削除し、次回実行でも同じ結果になるようにする）
    await admin.from("words").delete().eq("word_book_id", book.id);
    await admin.from("word_books").delete().eq("id", book.id);
    ok("テスト用の単語帳・単語を削除してクリーンな状態に戻した（冪等性確保）");
  }

  console.log("\n=== 5. 既存教材への非破壊確認（監査レポート更新 + 回帰ガード） ===");
  const audit = await auditExistingMaterials(admin);
  writeAuditReports(audit);
  const existingMaterials = audit.materials.filter((m) => !PRESET_PACK_IDS.has(m.id));
  if (existingMaterials.length >= 31) {
    ok(`既存（プリセットパック以外）の教材数: ${existingMaterials.length}件（31件以上を維持）`);
  } else {
    bad(`既存教材数が想定を下回っています: ${existingMaterials.length}件（31件以上を期待）。誤って削除されていないか確認してください。`);
  }
  const emptiedMaterials = existingMaterials.filter((m) => m.total_words === 0);
  if (emptiedMaterials.length === 0) {
    ok("既存教材はすべて1語以上の単語を保持している（総語数0の教材なし）");
  } else {
    bad(`単語数が0件になっている既存教材があります: ${emptiedMaterials.map((m) => m.title).join(", ")}`);
  }
  ok(`MATERIALS_AUDIT.md / reports/materials-audit.json を更新（対象${audit.materialCount}件・総語数${audit.totals.total_words.toLocaleString()}語）`);

  printSummary();
  process.exit(fail > 0 ? 1 : 0);
}

function printSummary() {
  console.log(`\n=== test:materials RESULT: ${pass} passed, ${fail} failed ===`);
}

main().catch((e) => {
  console.error("test-materials crashed:", e);
  process.exit(1);
});
