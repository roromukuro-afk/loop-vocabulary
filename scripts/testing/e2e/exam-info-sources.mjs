/**
 * AdSense事前審査対応: 試験情報アキュラシー監査（フェーズ2） 自律E2E検証
 * （未ログインでも動作する公開ページのみ対象）
 *
 * 背景: 英検・TOEIC・大学受験関連のガイド記事に、
 *  - 「正答率65%で合格」のような断定的な合否ライン表現
 *  - CSEスコア制度（英検）への言及なしの合否claim
 *  - 「【2024年版】」のような古い年号が固定表示されたままのタイトル
 *  - 出題形式・問題数・試験時間が年度で変わりうる旨の注記の欠如
 * が無いか、というフェーズ2監査の是正が今後も維持されているかを検証する。
 * 詳細は EXAM_INFO_SOURCE_POLICY.md, reports/exam-info-audit.md を参照。
 *
 * 確認内容:
 *  1. 試験形式（出題数・試験時間・スコア等）に言及する対象ページに
 *     ExamInfoDisclaimer（data-testid="exam-info-disclaimer"）と
 *     「最終確認日」表示（data-testid="exam-info-last-verified"）がある
 *  2. 英検の合否ラインに言及するページにCSEスコア制度の注記がある
 *  3. 危険な断定表現（「正答率◯%で合格」「必ず合格」等）が本文に残っていない
 *  4. daigaku-juken-tango 関連ページ・ガイド一覧・動的記事(eiken-2kyu-tango-nanko)に
 *     古い年号タイトル（【20XX年版】）が残っていない
 *  5. 動的記事ルート /guide/eiken-2kyu-tango-nanko にもCSE注記・最終確認日がある
 *
 * 使い方: node scripts/testing/e2e/exam-info-sources.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

// ExamInfoDisclaimer（出題形式・問題数・試験時間の変更可能性の注記）が
// 表示されているべき静的ガイドページ。showCse=true は英検CSEスコア注記も必須。
const DISCLAIMER_PAGES = [
  { slug: "eiken-jun1-tango", showCse: true },
  // eiken-2kyu-tango: 2026-08-15の検索意図対応で合否ライン「約65%」の数値カードを
  // 削除し、公式に確認できる出題数(17問/31問/約7分)のみに変更したため、CSE注記は
  // 不要(eiken-1kyu-tangoと同じ「数値カードに合否率の記載がないため注記なし」の扱い)。
  { slug: "eiken-2kyu-tango", showCse: false },
  { slug: "eiken-3kyu-tango", showCse: true },
  { slug: "eiken-jun2-tango", showCse: true },
  { slug: "eiken-1kyu-tango", showCse: false },
  { slug: "toeic-tango", showCse: false },
  { slug: "toeic-900ten", showCse: false },
  { slug: "daigaku-juken-tango", showCse: false },
  { slug: "koukou-eigo-tango", showCse: false },
];

// 本文中に絶対に残っていてはいけない、断定的な合格保証・パーセンテージ表現。
// guides-content.mjs の BAN_PHRASES と重複しないよう試験情報アキュラシー観点のみに絞る。
// 「合格を保証するものではありません」のような否定文脈（免責）は正しい表現なので、
// 各パターンには否定表現が続かないことを確認する negative lookahead を付与している。
const DANGEROUS_ABSOLUTE_PATTERNS = [
  /正答率\s*65\s*%\s*で合格/,
  /正答率\s*60\s*%\s*で合格/,
  /正答率\s*70\s*%\s*で合格/,
  /必ず合格(?!できるとは限りません|するとは限りません)/,
  /合格を保証(?!するものでは|しません|できません|するものではありません)/,
  /100\s*%\s*合格/,
];

function findDangerousPhrases(bodyText) {
  return DANGEROUS_ABSOLUTE_PATTERNS.filter((re) => re.test(bodyText)).map((re) => re.source);
}

const OLD_YEAR_TITLE_PATTERN = /【20\d\d年版】/;

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);

    // ---- 1・2・3. 静的ガイドページの ExamInfoDisclaimer / CSE注記 / 危険表現チェック ----
    for (const { slug, showCse } of DISCLAIMER_PAGES) {
      const res = await page.goto(`${baseUrl}/guide/${slug}`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      if (res && res.status() === 200) ok(`/guide/${slug} が200で表示される`);
      else fail(`/guide/${slug} のステータスが200ではない (${res?.status()})`);

      const bodyText = await page.locator("body").innerText();

      // 注: daigaku-juken-tango / eiken-2kyu-tango / eiken-jun1-tango / toeic-tango は
      // 静的ルート(src/app/guide/<slug>/page.tsx)と、動的ルート([slug]/page.tsxのARTICLES)の
      // 双方に同一slugの記事定義が存在し、ビルド時にどちらが実際に配信されるか保証されない
      // 既知の問題がある（reports/exam-info-audit.md 参照）。どちらが配信されてもフェーズ2の
      // 是正内容（最終確認日・出題形式の注記）が読者に見える必要があるため、実装詳細
      // （Reactコンポーネントか、記事本文中のテキストか）に依存しない本文テキストベースで検証する。
      const disclaimerViaComponent = await page.locator('[data-testid="exam-info-disclaimer"]').count();
      const hasSourceCaveatText = /変更される場合が(あります|あるため)/.test(bodyText);
      if (disclaimerViaComponent > 0 || hasSourceCaveatText) {
        ok(`/guide/${slug}: 試験情報の変更可能性についての注記が表示される`);
      } else {
        fail(`/guide/${slug}: 試験情報の変更可能性についての注記が見つからない`);
      }

      if (/最終確認日[:：]\s*\d{4}-\d{2}-\d{2}/.test(bodyText)) {
        ok(`/guide/${slug}: 最終確認日が表示される`);
      } else {
        fail(`/guide/${slug}: 最終確認日の表示が見つからない、または形式が不正`);
      }

      if (showCse) {
        if (bodyText.includes("CSE")) {
          ok(`/guide/${slug}: 英検CSEスコア制度への言及がある`);
        } else {
          fail(`/guide/${slug}: 英検の合否ラインに言及しているのにCSEスコア制度の注記が見つからない`);
        }
      }

      const bannedFound = findDangerousPhrases(bodyText);
      if (bannedFound.length === 0) {
        ok(`/guide/${slug}: 危険な断定的合否表現が含まれていない`);
      } else {
        fail(`/guide/${slug}: 危険な断定的合否表現が残っている: ${bannedFound.join(", ")}`);
      }

      if (OLD_YEAR_TITLE_PATTERN.test(bodyText)) {
        fail(`/guide/${slug}: 本文中に古い年号タイトル表現【20XX年版】が残っている`);
      } else {
        ok(`/guide/${slug}: 古い年号タイトル表現が残っていない`);
      }
    }

    // ---- 4. 大学受験ガイドの年号タイトルが除去されていることを一覧ページ・関連リンクでも確認 ----
    await gotoReady(page, `${baseUrl}/guide`);
    const guideListBody = await page.locator("body").innerText();
    if (OLD_YEAR_TITLE_PATTERN.test(guideListBody)) {
      fail("/guide: ガイド一覧に古い年号タイトル【20XX年版】が残っている");
    } else {
      ok("/guide: ガイド一覧に古い年号タイトルが残っていない");
    }

    const daigakuLink = page.locator('a[href="/guide/daigaku-juken-tango"]').first();
    const daigakuLinkVisible = await daigakuLink.isVisible().catch(() => false);
    if (daigakuLinkVisible) {
      const linkText = await daigakuLink.innerText();
      if (!OLD_YEAR_TITLE_PATTERN.test(linkText)) {
        ok(`/guide: 大学受験ガイドへのリンク文言に古い年号が含まれていない ("${linkText.trim()}")`);
      } else {
        fail(`/guide: 大学受験ガイドへのリンク文言に古い年号が残っている ("${linkText.trim()}")`);
      }
    } else {
      fail("/guide: 大学受験ガイド (daigaku-juken-tango) への導線が見つからない");
    }

    // ---- 5. 動的記事ルート /guide/eiken-2kyu-tango-nanko の是正確認 ----
    // このスラッグは静的ルート（/guide/eiken-2kyu-tango）に遮蔽されない別記事のため、
    // 実際に配信される。フェーズ2監査で本文に断定表現が見つかり是正済み。
    const nankoSlug = "eiken-2kyu-tango-nanko";
    const nankoRes = await page.goto(`${baseUrl}/guide/${nankoSlug}`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    if (nankoRes && nankoRes.status() === 200) {
      ok(`/guide/${nankoSlug} が200で表示される`);
      const nankoBody = await page.locator("body").innerText();

      if (nankoBody.includes("CSE")) {
        ok(`/guide/${nankoSlug}: 英検CSEスコア制度への言及がある`);
      } else {
        fail(`/guide/${nankoSlug}: CSEスコア制度の注記が見つからない`);
      }

      if (/最終確認日[:：]\s*\d{4}-\d{2}-\d{2}/.test(nankoBody)) {
        ok(`/guide/${nankoSlug}: 最終確認日が本文中に表示される`);
      } else {
        fail(`/guide/${nankoSlug}: 最終確認日の表示が見つからない`);
      }

      const nankoBanned = findDangerousPhrases(nankoBody);
      if (nankoBanned.length === 0) {
        ok(`/guide/${nankoSlug}: 危険な断定的合否表現が含まれていない`);
      } else {
        fail(`/guide/${nankoSlug}: 危険な断定的合否表現が残っている: ${nankoBanned.join(", ")}`);
      }
    } else {
      fail(`/guide/${nankoSlug} のステータスが200ではない (${nankoRes?.status()})`);
    }

    // ---- ポリシー・監査ドキュメントの存在確認（ファイルシステムではなくビルド成果物としてではないため、
    //      ここでは触れず、対象外。ドキュメントの存在はリポジトリレビューで確認する） ----

    if (errors.length === 0) ok("操作中に console error / 5xx なし");
    else fail(`操作中にエラー検出: ${errors.join(" | ")}`);
  } catch (e) {
    fail(`予期しない例外: ${e.message}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  if (process.exitCode) {
    console.log("\n=== test:exam-info-sources RESULT: FAILED ===");
  } else {
    console.log("\n=== test:exam-info-sources RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("exam-info-sources e2e crashed:", e);
  process.exit(1);
});
