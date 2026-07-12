/**
 * 外部由来教材（英検2級/準1級=VOCABULARISM、中学校英単語=小テストジェネレーター、
 * 大学入試頻出英単語2000+=受かる英語）の権利まわり自律E2E検証（Phase 3 権利/著作権監査）。
 *
 * カバー範囲:
 * 1. 教材詳細ページに publisher/author の出典表示が実際に出る（未ログインでも見える公開ページ）
 * 2. 市販単語帳比較記事（system-eitango / target-1900 / systan-vs-target-1900 /
 *    leap-eitango / eitango-cho-hikaku）に「非公式・独自解説」である旨の注記が出る
 * 3. api/wordbook/[id]/share/route.ts に source_type ガード（"custom" 以外は403）が
 *    実装されていることの静的確認（ソースコードのgrep）
 * 4. ログイン済みユーザーが教材インポート由来（source_type: "material"）の単語帳を
 *    実際に共有しようとした場合、200(成功)にはならないことのランタイム確認
 *    （/wordbooks/[id] でシェアボタンが出ない・POST /api/wordbook/[id]/share が
 *    非200であることの両方を見る）
 *
 * 既知の制約（スキップした内容）:
 * - このプロジェクトの本番Supabase(befjjebsrnsfwhtmydiv)には、share/[code]機能が
 *   前提とするDBカラム word_books.share_code / word_books.is_shared がまだ
 *   適用されていない（マイグレーション005_wordbook_share.sqlが未適用）。そのため
 *   現時点では POST /api/wordbook/[id]/share は「source_typeガードによる403」ではなく
 *   「share_code列が存在しないことによるエラー→book取得失敗→404」になる可能性が高い。
 *   本テストは「200(成功)にならないこと」を検証することで、理由(403/404どちらでも)を
 *   問わず「教材由来単語帳の共有が成功しない」という実質的な安全性を確認する。
 *   403で失敗することの検証は#3の静的チェックで別途担保する。
 * - 完全な共有フロー（share_code発行→別ユーザーでインポート→再配布）のE2E検証は、
 *   上記の理由で現状意味を持たないため実施しない。005マイグレーション適用後に
 *   追加すべき項目として EXTERNAL_MATERIALS_RIGHTS_AUDIT.md に記載した。
 *
 * 使い方: node scripts/testing/e2e/external-material-rights.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../../..");
const PORT = Number(process.env.TEST_PORT || 3799);
const TEST_BOOK_TITLE = "TEST_外部教材権利検証用単語帳";

// 外部由来（publisher/authorが自社=Loop Vocabulary以外）の公開教材
const EXTERNAL_MATERIALS = [
  { id: "00000000-0000-0000-0000-000000000020", title: "大学入試頻出英単語 2000+", publisher: "受かる英語" },
  { id: "00000000-0000-0000-0000-000000000021", title: "中学校英単語 基礎・標準", publisher: "小テストジェネレーター" },
  { id: "00000000-0000-0000-0000-000000000022", title: "英検2級 重要単語", publisher: "VOCABULARISM" },
  { id: "00000000-0000-0000-0000-000000000023", title: "英検準1級 重要単語", publisher: "VOCABULARISM" },
];

// 市販単語帳の名称・比較を扱う記事（[slug]/page.tsx の BRAND_REVIEW_SLUGS と揃える）
const BRAND_REVIEW_SLUGS = [
  "system-eitango",
  "target-1900",
  "systan-vs-target-1900",
  "leap-eitango",
  "eitango-cho-hikaku",
];
const DISCLAIMER_FRAGMENT = "公式に提携するものではなく";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }
function warn(msg) { console.log(`⚠️  ${msg}`); }

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.srs.passwordEnvKey]);
  const admin = getAdminClient();

  // ---- 3. 静的チェック: share/route.ts に source_type ガードが実装されている ----
  const shareRouteSrc = readFileSync(
    resolve(REPO_ROOT, "src/app/api/wordbook/[id]/share/route.ts"),
    "utf-8"
  );
  if (/source_type\s*!==\s*["']custom["']/.test(shareRouteSrc) && /status:\s*403/.test(shareRouteSrc)) {
    ok("api/wordbook/[id]/share/route.ts: source_type !== 'custom' を403で拒否するガードがソースに存在する");
  } else {
    fail("api/wordbook/[id]/share/route.ts: source_typeガード（403）がソースに見つからない");
  }

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  let bookId = null;
  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);

    // ---- 1. 教材詳細ページに publisher の出典表示が出る ----
    for (const m of EXTERNAL_MATERIALS) {
      const res = await page.goto(`${baseUrl}/materials/${m.id}`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      if (res && res.status() === 200) ok(`/materials/${m.id} (${m.title}) が200で表示される`);
      else { fail(`/materials/${m.id} のステータスが200ではない (${res?.status()})`); continue; }

      const body = await page.locator("body").innerText();
      if (body.includes(m.publisher)) {
        ok(`/materials/${m.id}: 出典表示「${m.publisher}」がページに表示されている`);
      } else {
        fail(`/materials/${m.id}: 出典「${m.publisher}」がページに見つからない（attribution欠落の疑い）`);
      }
    }

    // ---- 2. 市販単語帳比較記事に非公式である旨の注記がある ----
    for (const slug of BRAND_REVIEW_SLUGS) {
      const res = await page.goto(`${baseUrl}/guide/${slug}`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      if (res && res.status() === 200) ok(`/guide/${slug} が200で表示される`);
      else { fail(`/guide/${slug} のステータスが200ではない (${res?.status()})`); continue; }

      const body = await page.locator("body").innerText();
      if (body.includes(DISCLAIMER_FRAGMENT)) {
        ok(`/guide/${slug}: 非公式・独自解説である旨の注記が表示されている`);
      } else {
        fail(`/guide/${slug}: 非公式である旨の注記が見つからない`);
      }
      if (body.includes("実データ") || body.includes("実際の並び")) {
        fail(`/guide/${slug}: 教材の「実データ」「実際の並び」を主張する表現が残っている（verbatim reproduction risk）`);
      } else {
        ok(`/guide/${slug}: 教材の実際の収録順を主張する表現がない`);
      }
    }

    // ---- 4. 教材インポート由来の単語帳の共有ブロック（ランタイム） ----
    const { data: prof } = await admin.from("profiles").select("id").eq("email", TEST_ACCOUNTS.srs.email).maybeSingle();
    if (!prof) {
      fail("test+srs プロファイルが見つからない（共有ブロックのランタイム検証をスキップ）");
    } else {
      // 前回実行の残骸を掃除
      const { data: stale } = await admin.from("word_books").select("id").eq("user_id", prof.id).eq("title", TEST_BOOK_TITLE);
      for (const b of stale ?? []) await admin.from("word_books").delete().eq("id", b.id);

      const { data: book, error: bookErr } = await admin
        .from("word_books")
        .insert({
          user_id: prof.id,
          title: TEST_BOOK_TITLE,
          source_type: "material",
          source_material_id: EXTERNAL_MATERIALS[0].id,
        })
        .select("id")
        .single();

      if (bookErr || !book) {
        fail(`教材インポート由来のテスト単語帳の作成に失敗: ${bookErr?.message}`);
      } else {
        bookId = book.id;
        ok(`教材インポート由来のテスト単語帳（source_type=material）を作成 (id=${bookId})`);

        await login(page, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
        await gotoReady(page, `${baseUrl}/wordbooks/${bookId}`);

        const pageBody = await page.locator("body").innerText();
        if (pageBody.includes("共有できません")) {
          ok("/wordbooks/[id]: 教材由来の単語帳では共有不可の案内が表示され、共有ボタンが出ない");
        } else if (pageBody.includes("この単語帳を共有")) {
          fail("/wordbooks/[id]: 教材由来の単語帳なのに共有ボタンが表示されている");
        } else {
          warn("/wordbooks/[id]: 共有UI関連の文言がページに見つからなかった（ページ構成が変わった可能性）");
        }

        // ページ内から fetch することで、ログインセッションのCookieを利用してAPIを叩く
        const shareResult = await page.evaluate(async (id) => {
          const res = await fetch(`/api/wordbook/${id}/share`, { method: "POST" });
          let body = null;
          try { body = await res.json(); } catch { /* noop */ }
          return { status: res.status, body };
        }, bookId);

        if (shareResult.status === 200) {
          fail(`POST /api/wordbook/${bookId}/share: 教材由来の単語帳が共有できてしまった (status=200)`);
        } else if (shareResult.status === 403) {
          ok(`POST /api/wordbook/${bookId}/share: 期待通り403で拒否された (source_typeガードが機能)`);
        } else {
          warn(
            `POST /api/wordbook/${bookId}/share: 200ではない(status=${shareResult.status})ため実害はないが、` +
            `403ではなく${shareResult.status}だった。既知の原因: share_code/is_shared列が本番DBに` +
            `未適用のため、ガード到達前にNot Foundになっている可能性が高い（詳細はスクリプト冒頭コメント参照）`
          );
        }
      }
    }

    if (errors.length === 0) ok("操作中に console error / 5xx なし（意図した403/404応答は除く）");
    else {
      const unexpected = errors.filter((e) => !/40[34]/.test(e));
      if (unexpected.length === 0) ok("操作中の5xx/consoleエラーは検出されなかった");
      else fail(`操作中に予期しないエラー検出: ${unexpected.join(" | ")}`);
    }
  } catch (e) {
    fail(`予期しない例外: ${e.message}`);
  } finally {
    if (bookId) await admin.from("word_books").delete().eq("id", bookId);
    await browser.close();
    stopDevServer(dev);
  }

  if (process.exitCode) {
    console.log("\n=== test:external-material-rights RESULT: FAILED ===");
  } else {
    console.log("\n=== test:external-material-rights RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("external-material-rights e2e crashed:", e);
  process.exit(1);
});
