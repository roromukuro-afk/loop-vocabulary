/**
 * Issue #98: /tools/vocab-test-maker の生成後value momentに置いた共有CTAのE2E検証。
 *
 * 検証内容:
 *  1. 生成前は共有CTAが表示されない(主目的のテスト作成を邪魔しない)
 *  2. 生成後は共有CTAが表示される
 *  3. navigator.share が使える環境では、共有シートに正規URL(貼り付けた単語や
 *     生成結果を一切含まない固定値)のみが渡される
 *  4. navigator.share が使えない環境では、URLのクリップボードコピーにfallbackする
 *  5. 共有ボタンクリックで送信されるanalyticsイベント(vocab_test_maker_share_invoked)の
 *     propertiesに単語・意味・生成結果が一切含まれない(methodのみ)
 *  6. mobile viewportでも共有CTAが表示・操作できる
 *  7. navigator.share が使えるがユーザーキャンセル(AbortError)で拒否された場合は
 *     何もしない(クリップボードへは自動フォールバックしない。Codexレビュー指摘対応)
 *  8. navigator.share が使えるがそれ以外の理由(非対応payload・権限ポリシー等)で
 *     拒否された場合は、クリップボードコピーへfallbackする(Codexレビュー指摘対応:
 *     修正前はこのケースで何も起きずボタンが反応しないように見えていた)
 *
 * 使い方: node scripts/testing/e2e/vocab-test-maker-share.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const PAGE_PATH = "/tools/vocab-test-maker";
const EXPECTED_SHARE_URL = "https://loop-vocabulary.app/tools/vocab-test-maker";
const FORBIDDEN_SUBSTRINGS = ["apple", "りんご", "beautiful", "美しい", "banana", "バナナ"];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function interceptAnalyticsEvents(page) {
  const captured = [];
  await page.route("**/api/analytics/events", async (route) => {
    try {
      const body = route.request().postDataJSON();
      const events = Array.isArray(body) ? body : [body];
      captured.push(...events);
    } catch {
      /* ignore malformed body */
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, accepted: 1 }) });
  });
  return captured;
}

async function generateTest(page) {
  await page.locator('[data-testid="vocab-test-paste-input"]').fill("apple,りんご\nbeautiful,美しい\nbanana,バナナ");
  const [popup] = await Promise.all([
    page.context().waitForEvent("page", { timeout: 15000 }),
    page.locator('[data-testid="vocab-test-generate-button"]').click(),
  ]);
  await popup.waitForLoadState("domcontentloaded").catch(() => {});
  await popup.close().catch(() => {});
}

function assertNoForbiddenSubstrings(value, label) {
  const str = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const leaked = FORBIDDEN_SUBSTRINGS.filter((s) => str.includes(s));
  if (leaked.length === 0) ok(`${label}: 単語・意味データが含まれない`);
  else fail(`${label}: 単語・意味データの混入を検出: ${JSON.stringify(leaked)} (in: ${str.slice(0, 200)})`);
}

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    // ---------- 1. 生成前は共有CTAが表示されない ----------
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = collectErrors(page);
      await gotoReady(page, `${baseUrl}${PAGE_PATH}`);

      const shareVisibleBefore = await page.locator('[data-testid="share-url-button"]').isVisible().catch(() => false);
      if (!shareVisibleBefore) ok("生成前は共有CTAが表示されない");
      else fail("生成前から共有CTAが表示されている(主目的のテスト作成の邪魔になり得る)");

      if (errors.length === 0) ok("初期表示中にconsole error/5xxなし");
      else fail(`初期表示中にエラー検出: ${errors.join(" | ")}`);
      await context.close();
    }

    // ---------- 2〜3・5. 生成後: 共有CTA表示 + navigator.share利用 + payload/analyticsに単語データが無い ----------
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = collectErrors(page);
      const captured = await interceptAnalyticsEvents(page);

      // navigator.shareをモックし、実際に渡されたペイロードを捕捉する
      // (headless ChromiumはデフォルトでWeb Share APIを持たないため、テスト用に注入する)。
      await page.addInitScript(() => {
        window.__shareCalls = [];
        // @ts-ignore
        navigator.share = (data) => {
          window.__shareCalls.push(data);
          return Promise.resolve();
        };
      });

      await gotoReady(page, `${baseUrl}${PAGE_PATH}`);
      await generateTest(page);

      const shareVisibleAfter = await page.locator('[data-testid="share-url-button"]').isVisible({ timeout: 5000 }).catch(() => false);
      if (shareVisibleAfter) ok("生成後は共有CTAが表示される");
      else fail("生成後に共有CTAが表示されない");

      await page.locator('[data-testid="share-url-button"]').click();
      await page.waitForTimeout(300);

      const shareCalls = await page.evaluate(() => window.__shareCalls);
      if (shareCalls.length === 1) ok("navigator.share がちょうど1回だけ呼ばれる");
      else fail(`navigator.share の呼び出し回数が想定外: ${shareCalls.length}`);

      const payload = shareCalls[0];
      if (payload?.url === EXPECTED_SHARE_URL) ok(`navigator.share に正規URLのみが渡される (${payload?.url})`);
      else fail(`navigator.share のurlが想定外: ${JSON.stringify(payload)}`);
      assertNoForbiddenSubstrings(payload?.title, "navigator.share title");
      assertNoForbiddenSubstrings(payload?.text, "navigator.share text");
      assertNoForbiddenSubstrings(payload?.url, "navigator.share url");

      const shareEvents = captured.filter((e) => e.event_name === "vocab_test_maker_share_invoked");
      if (shareEvents.length === 1) ok("vocab_test_maker_share_invoked がちょうど1回だけ発火する");
      else fail(`vocab_test_maker_share_invoked の発火回数が想定外: ${shareEvents.length}`);
      const shareEvent = shareEvents[0];
      if (shareEvent?.properties?.method === "web_share") {
        ok("vocab_test_maker_share_invoked.properties.method === 'web_share'");
      } else {
        fail(`method が想定外: ${JSON.stringify(shareEvent?.properties)}`);
      }
      // クライアントは全イベントにutm_source/utm_medium/utm_campaign/utm_contentを
      // 無条件でmergeする(track.tsの既存設計。API側sanitizePropertiesがevent別
      // whitelistで許可されたキーだけを実際にDBへ残す)。そのため、ここで検証すべきは
      // 「送信payload(sanitize前)にmethod以外のキーが無いこと」ではなく、
      // 「実際にDBへ保存されるproperties(sanitize後)にmethod以外が残らないこと」
      // であり、それはscripts/testing/test-analytics-event-sanitize.mjs
      // (sanitizeProperties()を直接importする単体テスト)が担当する。
      assertNoForbiddenSubstrings(JSON.stringify(captured), "analyticsに送信された全イベント");

      if (errors.length === 0) ok("共有CTA操作中にconsole error/5xxなし");
      else fail(`共有CTA操作中にエラー検出: ${errors.join(" | ")}`);
      await context.close();
    }

    // ---------- 4. navigator.share が使えない環境ではクリップボードコピーにfallbackする ----------
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = collectErrors(page);

      // navigator.shareを未定義のままにし(既定のheadless Chromiumの状態)、
      // navigator.clipboard.writeTextだけモックして呼び出し内容を捕捉する。
      await page.addInitScript(() => {
        window.__clipboardCalls = [];
        // @ts-ignore
        navigator.share = undefined;
        // @ts-ignore
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: (text) => {
              window.__clipboardCalls.push(text);
              return Promise.resolve();
            },
          },
          configurable: true,
        });
      });

      await gotoReady(page, `${baseUrl}${PAGE_PATH}`);
      await generateTest(page);

      await page.locator('[data-testid="share-url-button"]').click();
      await page.waitForTimeout(300);

      const clipboardCalls = await page.evaluate(() => window.__clipboardCalls);
      if (clipboardCalls.length === 1 && clipboardCalls[0] === EXPECTED_SHARE_URL) {
        ok(`navigator.share 非対応時、クリップボードへ正規URLがコピーされる (${clipboardCalls[0]})`);
      } else {
        fail(`クリップボードコピーの内容が想定外: ${JSON.stringify(clipboardCalls)}`);
      }

      const statusText = await page.locator('[data-testid="share-url-status"]').textContent().catch(() => "");
      if (statusText && statusText.includes("コピー")) ok(`コピー完了のstatusメッセージが表示される ("${statusText.trim()}")`);
      else fail(`コピー完了のstatusメッセージが表示されない: "${statusText}"`);

      if (errors.length === 0) ok("クリップボードfallback操作中にconsole error/5xxなし");
      else fail(`クリップボードfallback操作中にエラー検出: ${errors.join(" | ")}`);
      await context.close();
    }

    // ---------- 7. navigator.share がAbortError(ユーザーキャンセル)で拒否された場合、
    // クリップボードへは自動フォールバックしない。共有シート自体は実際に開いた上での
    // キャンセルのため、vocab_test_maker_share_invoked(method=web_share)はちょうど
    // 1回だけ発火する(Codexレビュー指摘対応: 以前はtry開始前に楽観的にweb_shareを
    // 記録していたため、この経路自体では正しく1回のままだったが、8のフォールバック
    // 経路では2回に水増しされていた。回帰確認として揃えて検証する) ----------
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = collectErrors(page);
      const captured = await interceptAnalyticsEvents(page);

      await page.addInitScript(() => {
        window.__clipboardCalls = [];
        // @ts-ignore
        navigator.share = () => Promise.reject(new DOMException("share canceled", "AbortError"));
        // @ts-ignore
        Object.defineProperty(navigator, "clipboard", {
          value: { writeText: (text) => { window.__clipboardCalls.push(text); return Promise.resolve(); } },
          configurable: true,
        });
      });

      await gotoReady(page, `${baseUrl}${PAGE_PATH}`);
      await generateTest(page);

      await page.locator('[data-testid="share-url-button"]').click();
      await page.waitForTimeout(300);

      const clipboardCallsAfterAbort = await page.evaluate(() => window.__clipboardCalls);
      if (clipboardCallsAfterAbort.length === 0) {
        ok("navigator.share がAbortError(ユーザーキャンセル)で拒否された場合、クリップボードへは自動フォールバックしない");
      } else {
        fail(`AbortError後にクリップボードへフォールバックしてしまっている: ${JSON.stringify(clipboardCallsAfterAbort)}`);
      }

      const abortShareEvents = captured.filter((e) => e.event_name === "vocab_test_maker_share_invoked");
      if (abortShareEvents.length === 1 && abortShareEvents[0]?.properties?.method === "web_share") {
        ok("AbortErrorケースでもvocab_test_maker_share_invoked(method=web_share)がちょうど1回だけ発火する(共有シート自体は開いているため)");
      } else {
        fail(`AbortErrorケースでのイベント発火が想定外: ${JSON.stringify(abortShareEvents)}`);
      }

      if (errors.length === 0) ok("AbortErrorケースの操作中にconsole error/5xxなし");
      else fail(`AbortErrorケースの操作中にエラー検出: ${errors.join(" | ")}`);
      await context.close();
    }

    // ---------- 8. navigator.share がAbortError以外の理由で拒否された場合、
    // クリップボードコピーへfallbackする(Codexレビュー指摘対応)。この経路では
    // 共有シート自体が実際には開いていない可能性が高いため、
    // vocab_test_maker_share_invokedはmethod=copy_linkでちょうど1回だけ発火し、
    // web_shareは一切記録されない(Codexレビュー指摘対応、9巡目: 以前はtry開始前の
    // 楽観的なweb_share記録+copyLink()自身のcopy_link記録で1クリックが2件に
    // 水増しされ、かつ実際には開いていないshare sheetがweb_share起動として
    // 誤って記録されていた) ----------
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = collectErrors(page);
      const captured = await interceptAnalyticsEvents(page);

      await page.addInitScript(() => {
        window.__clipboardCalls = [];
        // @ts-ignore
        navigator.share = () => Promise.reject(new DOMException("not allowed", "NotAllowedError"));
        // @ts-ignore
        Object.defineProperty(navigator, "clipboard", {
          value: { writeText: (text) => { window.__clipboardCalls.push(text); return Promise.resolve(); } },
          configurable: true,
        });
      });

      await gotoReady(page, `${baseUrl}${PAGE_PATH}`);
      await generateTest(page);

      await page.locator('[data-testid="share-url-button"]').click();
      await page.waitForTimeout(300);

      const clipboardCallsAfterOperationalFailure = await page.evaluate(() => window.__clipboardCalls);
      if (clipboardCallsAfterOperationalFailure.length === 1 && clipboardCallsAfterOperationalFailure[0] === EXPECTED_SHARE_URL) {
        ok(`navigator.shareがAbortError以外(NotAllowedError等)で拒否された場合、クリップボードへ正規URLがコピーされる (${clipboardCallsAfterOperationalFailure[0]})`);
      } else {
        fail(`operational failure後のクリップボードフォールバックが想定外: ${JSON.stringify(clipboardCallsAfterOperationalFailure)}`);
      }

      const operationalFailureShareEvents = captured.filter((e) => e.event_name === "vocab_test_maker_share_invoked");
      if (operationalFailureShareEvents.length === 1 && operationalFailureShareEvents[0]?.properties?.method === "copy_link") {
        ok("operational failureケースではvocab_test_maker_share_invoked(method=copy_link)がちょうど1回だけ発火し、web_shareは記録されない(Codexレビュー指摘対応: 1クリックでの2重計上・失敗したshare sheetの誤記録を修正)");
      } else {
        fail(`operational failureケースでのイベント発火が想定外: ${JSON.stringify(operationalFailureShareEvents)}(期待値: method=copy_linkで1件のみ)`);
      }

      if (errors.length === 0) ok("operational failureケースの操作中にconsole error/5xxなし");
      else fail(`operational failureケースの操作中にエラー検出: ${errors.join(" | ")}`);
      await context.close();
    }

    // ---------- 6. mobile viewportでも共有CTAが表示・操作できる ----------
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
      const page = await context.newPage();
      const errors = collectErrors(page);
      await page.addInitScript(() => {
        // @ts-ignore
        navigator.share = (data) => { window.__mobileShareCalls = [data]; return Promise.resolve(); };
      });

      await gotoReady(page, `${baseUrl}${PAGE_PATH}`);
      await generateTest(page);

      const shareVisibleMobile = await page.locator('[data-testid="share-url-button"]').isVisible({ timeout: 5000 }).catch(() => false);
      if (shareVisibleMobile) ok("mobile viewportでも生成後に共有CTAが表示される");
      else fail("mobile viewportで共有CTAが表示されない");

      await page.locator('[data-testid="share-url-button"]').click();
      await page.waitForTimeout(300);
      const mobileShareCalls = await page.evaluate(() => window.__mobileShareCalls ?? []);
      if (mobileShareCalls.length === 1 && mobileShareCalls[0]?.url === EXPECTED_SHARE_URL) {
        ok("mobile viewportでも共有CTAのクリックが正しく動作する");
      } else {
        fail(`mobile viewportでの共有呼び出しが想定外: ${JSON.stringify(mobileShareCalls)}`);
      }

      if (errors.length === 0) ok("mobile viewport操作中にconsole error/5xxなし");
      else fail(`mobile viewport操作中にエラー検出: ${errors.join(" | ")}`);
      await context.close();
    }
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:vocab-test-maker-share: FAILED ===" : "\n=== test:vocab-test-maker-share RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
