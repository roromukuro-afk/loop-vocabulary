/**
 * /tools/word-list-cleaner（英単語リスト整形・CSV変換ツール・ログイン不要）の
 * 自律E2E検証。exam-countdown-planner.mjs をテンプレートにしている。
 *
 * 1. SSR HTML / canonical / noindexなし / BreadcrumbList JSON-LD / sitemap
 * 2. FAQPage JSON-LDが出力され、可視の「よくある質問」セクションと項目数が一致する
 * 3. 区切り文字がバラバラな単語リストを貼り付けて「CSVに整形する」を押すと、
 *    正しいペア数・スキップ行番号が表示される
 * 4. 計測イベント(word_list_cleaner_page_viewed / word_list_cleaner_formatted /
 *    word_list_cleaner_signup_cta_clicked)がfirst-party Growth OS
 *    (/api/analytics/events)へ正しく・重複なく発火する
 * 5. サーバーへの書き込みが一切発生しない(整形処理中に外部APIへのPOSTが無い)
 *
 * 使い方: node scripts/testing/e2e/word-list-cleaner.mjs
 */
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const PAGE_PATH = "/tools/word-list-cleaner";
// 区切り文字がバラバラな入力(タブ・コロン・ハイフン・空行・解析不能行を含む)。
// メインフローとクリップボード失敗フォールバック検証の両方で使う。
const SAMPLE_INPUT = "apple: りんご\nbanana - バナナ\ncherry\tさくらんぼ\n\nこの行は解析できない";

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

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  // ---- 1〜2: SSR HTML / メタデータ / FAQPage JSON-LD / sitemap ----
  try {
    const res = await fetch(`${baseUrl}${PAGE_PATH}`);
    if (res.status === 200) ok(`${PAGE_PATH} が200で表示される`);
    else fail(`${PAGE_PATH} のステータスが200ではない (${res.status})`);

    const html = await res.text();

    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]*)"/);
    if (canonicalMatch?.[1]?.endsWith(PAGE_PATH)) ok("canonicalが自己参照");
    else fail(`canonicalが不正: ${canonicalMatch?.[1]}`);

    if (!/name="robots"[^>]*noindex/i.test(html)) ok("noindexが指定されていない（公開ページとしてインデックス対象）");
    else fail("noindexが指定されている（公開ページのはずが誤ってインデックス対象外になっている）");

    const ldMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    const jsonBlocks = ldMatches.map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });

    const breadcrumb = jsonBlocks.find((j) => j && j["@type"] === "BreadcrumbList");
    if (breadcrumb) {
      const items = breadcrumb.itemListElement ?? [];
      const names = items.map((i) => i.name);
      if (items.length === 3 && names[0] === "ホーム" && names[1] === "ツール一覧" && names[2] === "英単語リスト整形・CSV変換ツール") {
        ok("BreadcrumbListがHome → ツール一覧 → 本ツールの3階層で正しい");
      } else {
        fail(`BreadcrumbListの構成が不正: ${JSON.stringify(names)}`);
      }
    } else {
      fail("BreadcrumbList JSON-LDが見つからない");
    }

    const faqLd = jsonBlocks.find((j) => j && j["@type"] === "FAQPage");
    const visibleFaqCount = (html.match(/>Q\. /g) || []).length;
    if (faqLd && Array.isArray(faqLd.mainEntity) && faqLd.mainEntity.length >= 4) {
      ok(`FAQPage JSON-LDが存在し、${faqLd.mainEntity.length}件のQ&Aを含む`);
    } else {
      fail(`FAQPage JSON-LDが不足している: ${JSON.stringify(faqLd)}`);
    }
    if (faqLd && visibleFaqCount === faqLd.mainEntity.length) {
      ok(`可視の「よくある質問」セクションのQ&A件数(${visibleFaqCount})がFAQPage JSON-LDと一致する`);
    } else {
      fail(`可視FAQの件数がJSON-LDと不一致: visible=${visibleFaqCount}, jsonLd=${faqLd?.mainEntity?.length}`);
    }
    if (html.includes("よくある質問")) ok("「よくある質問」の見出しが本文に表示されている");
    else fail("「よくある質問」の見出しが見つからない");

    if (html.includes("ご自身で作成した単語リストのみをご利用ください")) {
      ok("CONTENT_SOURCE_POLICY.md準拠の注意書きが表示されている");
    } else {
      fail("出典に関する注意書きが見つからない");
    }

    // Codexレビュー指摘対応(PR #105、P2): CSV一括インポートはプレミアム機能であり、
    // 「無料登録すればインポートできる」という誤解を招く表現になっていないことを確認する。
    if (html.includes("プレミアム機能") && !/無料登録後、単語帳の「CSV一括インポート」/.test(html)) {
      ok("CSV一括インポートがプレミアム機能であることが明示され、無料登録だけで使えるという誤解を招く表現がない");
    } else {
      fail("CSV一括インポートのプレミアム要件が正しく開示されていない");
    }

    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    if (new RegExp(`<loc>[^<]*${PAGE_PATH}</loc>`).test(sitemapXml)) ok(`sitemap.xmlに${PAGE_PATH}が含まれる`);
    else fail(`sitemap.xmlに${PAGE_PATH}が含まれていない`);

    if (/<noscript>[\s\S]*JavaScript[\s\S]*<\/noscript>/.test(html)) {
      ok("JavaScript無効環境向けの<noscript>案内がSSR HTMLに含まれる(誤解を招く無反応なボタンにならない)");
    } else {
      fail("<noscript>案内が見つからない");
    }
  } catch (e) {
    fail(`SSR/メタデータ検証中に例外: ${e.message}`);
  }

  // ---- 3〜5: ブラウザでの整形・計測イベント・書き込み無し検証 ----
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const errors = collectErrors(page);
    const analyticsEvents = await interceptAnalyticsEvents(page);

    // このツールはページ内の整形処理で外部APIへ書き込みを一切行わない設計 —
    // /api/analytics/events 以外への POST/PUT/PATCH/DELETE が発生しないことを確認する。
    const unexpectedWriteRequests = [];
    page.on("request", (req) => {
      const method = req.method();
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !req.url().includes("/api/analytics/events")) {
        unexpectedWriteRequests.push(`${method} ${req.url()}`);
      }
    });

    await gotoReady(page, `${baseUrl}${PAGE_PATH}`);

    // ---- word_list_cleaner_page_viewed が1回だけ発火する ----
    await page.waitForTimeout(300);
    const pageViewedEvents = analyticsEvents.filter((e) => e.event_name === "word_list_cleaner_page_viewed");
    if (pageViewedEvents.length === 1) ok("word_list_cleaner_page_viewedが1回だけ発火する");
    else fail(`word_list_cleaner_page_viewedの発火回数が想定外: ${pageViewedEvents.length}`);

    const textarea = page.locator("#word-list-input");
    if (await textarea.count() === 1) ok("単語リスト入力用のtextareaが存在する");
    else fail("単語リスト入力用のtextareaが見つからない");

    const input = SAMPLE_INPUT;
    await textarea.fill(input);
    await page.locator('button:has-text("CSVに整形する")').click();
    await page.waitForTimeout(300);

    const bodyText = await page.locator("body").innerText();
    if (bodyText.includes("整形結果(3件)")) ok("3件のペアが正しく整形される(apple/banana/cherry)");
    else fail(`整形結果の件数表示が想定外。本文: ${bodyText.slice(0, 500)}`);

    if (/5行[\s\S]*スキップ|行番号:\s*5/.test(bodyText)) {
      ok("解析できない行(5行目)がスキップされ、行番号が表示される");
    } else {
      fail(`スキップ行の表示が見つからない。本文: ${bodyText.slice(0, 500)}`);
    }

    // ---- word_list_cleaner_formatted が entry_count=3 で1回だけ発火する ----
    await page.waitForTimeout(300);
    let formattedEvents = analyticsEvents.filter((e) => e.event_name === "word_list_cleaner_formatted");
    if (formattedEvents.length === 1 && formattedEvents[0].properties?.entry_count === 3) {
      ok("word_list_cleaner_formattedがentry_count=3で1回だけ発火する");
    } else {
      fail(`word_list_cleaner_formattedの発火内容が想定外: ${JSON.stringify(formattedEvents)}`);
    }

    // 再度整形しても再発火しない(1セッション1回きり計測の方針、他の無料ツールと同じ)
    await page.locator('button:has-text("CSVに整形する")').click();
    await page.waitForTimeout(300);
    formattedEvents = analyticsEvents.filter((e) => e.event_name === "word_list_cleaner_formatted");
    if (formattedEvents.length === 1) {
      ok("再度整形してもword_list_cleaner_formattedは再発火しない(1セッション1回)");
    } else {
      fail(`word_list_cleaner_formattedが重複発火した: ${formattedEvents.length}件`);
    }

    // ---- Codexレビュー指摘対応(PR #105、P2): 整形後にテキストエリアを編集すると、
    // 再度「CSVに整形する」を押すまで古い結果パネル(コピー/ダウンロードボタン含む)は
    // 表示されない(古いCSVが渡ってしまうことを防ぐ) ----
    await textarea.fill(input + "\nextra: 追加");
    await page.waitForTimeout(200);
    const resultsHiddenAfterEdit = (await page.locator('button:has-text("CSVをコピー")').count()) === 0;
    if (resultsHiddenAfterEdit) {
      ok("整形後に入力を編集すると、再整形するまで古い結果(コピー/ダウンロードボタン)は表示されない");
    } else {
      fail("入力編集後も古い結果パネルが表示されたままになっている(stale CSVが提供される恐れ)");
    }
    await page.locator('button:has-text("CSVに整形する")').click();
    await page.waitForTimeout(300);
    const bodyTextAfterReformat = await page.locator("body").innerText();
    if (bodyTextAfterReformat.includes("整形結果(4件)")) {
      ok("編集後に再整形すると、追加した行を含む最新の結果が表示される");
    } else {
      fail(`再整形後の件数表示が想定外。本文: ${bodyTextAfterReformat.slice(0, 500)}`);
    }
    // 以降のテストのため、元の3件入力へ戻す
    await textarea.fill(input);
    await page.locator('button:has-text("CSVに整形する")').click();
    await page.waitForTimeout(300);

    // ---- コピーボタンでクリップボードへ書き込まれる(整形済みCSVの内容) ----
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.locator('button:has-text("CSVをコピー")').click();
    await page.waitForTimeout(200);
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    if (clipboardText.startsWith("word,meaning") && clipboardText.includes("apple,りんご")) {
      ok("「CSVをコピー」でクリップボードへ正しいCSV(ヘッダ行+データ)がコピーされる");
    } else {
      fail(`クリップボードの内容が想定外: ${JSON.stringify(clipboardText)}`);
    }

    // ---- Codexレビュー指摘対応(PR #105、9巡目、P2): コピー直後(2秒のタイムアウト
    // が消える前)に入力を編集して再整形すると、新しい(まだコピーされていない)結果に
    // 対して古い「コピーしました ✓」表示が残ってはいけない ----
    const copyButton = page.locator('button:has-text("CSVをコピー"), button:has-text("コピーしました")');
    const copyButtonTextRightAfterReformat = await (async () => {
      await textarea.fill(input);
      await page.locator('button:has-text("CSVに整形する")').click();
      await page.waitForTimeout(300);
      await page.locator('button:has-text("CSVをコピー")').click();
      await page.waitForTimeout(100); // コピー直後、2秒のタイムアウトが消える前
      await textarea.fill(input + "\nextra: 追加");
      await page.locator('button:has-text("CSVに整形する")').click();
      await page.waitForTimeout(100);
      return copyButton.innerText();
    })();
    if (copyButtonTextRightAfterReformat === "CSVをコピー") {
      ok("コピー直後に編集→再整形しても、新しい(未コピーの)結果に古い「コピーしました ✓」表示は残らない");
    } else {
      fail(`再整形直後のコピーボタン表示が想定外: ${JSON.stringify(copyButtonTextRightAfterReformat)}(「CSVをコピー」であるべき)`);
    }
    // 次のチェックのため元の3件入力へ戻す
    await textarea.fill(input);
    await page.locator('button:has-text("CSVに整形する")').click();
    await page.waitForTimeout(300);

    // ---- CSV Formula Injection対策: =で始まる単語を含むリストを整形すると、
    // 画面上に無害化件数の案内が表示され、ダウンロードされるCSVの先頭に'が付く ----
    const injectionInput = "=cmd|'/c calc'!A1: 危険な数式\nsafe: 安全な単語";
    await textarea.fill(injectionInput);
    await page.locator('button:has-text("CSVに整形する")').click();
    await page.waitForTimeout(300);
    const injectionBodyText = await page.locator("body").innerText();
    if (/1件[\s\S]*'/.test(injectionBodyText) || /'[\s\S]*1件/.test(injectionBodyText)) {
      ok("formula injection対策: 無害化した件数(1件)が画面に案内表示される");
    } else {
      fail(`formula injection無害化の案内表示が見つからない。本文: ${injectionBodyText.slice(0, 800)}`);
    }

    // ---- ダウンロードされるCSVファイルの先頭にUTF-8 BOM(EF BB BF)が付与され、
    // 無害化されたセルの先頭に'が付いていることを実ファイルのバイト列で確認する ----
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator('button:has-text("CSVをダウンロード")').click(),
    ]);
    const downloadPath = await download.path();
    const fileBuffer = await readFile(downloadPath);
    const hasBom = fileBuffer[0] === 0xef && fileBuffer[1] === 0xbb && fileBuffer[2] === 0xbf;
    const fileText = fileBuffer.toString("utf-8");
    if (hasBom && fileText.includes("'=cmd|'/c calc'!A1,危険な数式")) {
      ok("ダウンロードされたCSVファイルの先頭にUTF-8 BOMが付与され、無害化対象セルの先頭に'が付いている");
    } else {
      fail(`ダウンロードファイルの内容が想定外: hasBom=${hasBom}, 先頭200バイト=${JSON.stringify(fileText.slice(0, 200))}`);
    }

    // 次のチェックのために元の3件入力へ戻す
    await textarea.fill(input);
    await page.locator('button:has-text("CSVに整形する")').click();
    await page.waitForTimeout(300);

    // ---- word_list_cleaner_signup_cta_clicked がCTAクリックで発火する ----
    const ctaLink = page.locator('a[href="/signup"]:has-text("無料で始める")');
    if (await ctaLink.count() === 1) {
      await Promise.all([
        page.waitForURL(/\/signup/, { timeout: 10000 }),
        ctaLink.click(),
      ]);
      await page.waitForTimeout(300);
      const ctaEvents = analyticsEvents.filter((e) => e.event_name === "word_list_cleaner_signup_cta_clicked");
      if (ctaEvents.length >= 1) ok("「無料で始める」CTAクリックでword_list_cleaner_signup_cta_clickedが発火する");
      else fail("word_list_cleaner_signup_cta_clickedが発火しない");
    } else {
      fail("「無料で始める」CTAリンクが見つからない");
    }

    // ---- プライバシー: これまでに送信された全analyticsイベントのペイロードに、
    // 実際に入力した単語・意味の本文が一切含まれないことを確認する(件数等の
    // メタ情報のみ送信可、本文送信は禁止)。イベント名自体にwordが含まれるのは
    // 仕様どおり(event_name: "word_list_cleaner_..."）なので、propertiesの値のみを
    // 対象にする。 ----
    const forbiddenContentStrings = ["apple", "banana", "cherry", "りんご", "バナナ", "さくらんぼ", "safe", "危険な数式", "安全な単語", "cmd", "calc"];
    const leakedContent = [];
    for (const event of analyticsEvents) {
      const propertiesJson = JSON.stringify(event.properties ?? {});
      for (const needle of forbiddenContentStrings) {
        if (propertiesJson.includes(needle)) leakedContent.push(`${event.event_name}.properties contains "${needle}"`);
      }
    }
    if (leakedContent.length === 0) {
      ok("送信された全analyticsイベントのproperties(件数等は含む)に、入力した単語・意味の本文が一切含まれない");
    } else {
      fail(`analyticsイベントに単語・意味の本文が漏洩している: ${leakedContent.join(", ")}`);
    }

    if (unexpectedWriteRequests.length === 0) {
      ok("整形処理・コピー操作を通じて、/api/analytics/events以外への書き込みリクエストが一切発生しない");
    } else {
      fail(`想定外の書き込みリクエストを検出: ${unexpectedWriteRequests.join(", ")}`);
    }

    if (errors.length === 0) ok("コンソールエラー・5xxエラーなし");
    else fail(`コンソールエラー等を検出: ${errors.join(" / ")}`);

    // ---- Codexレビュー指摘対応(PR #105、14巡目、P2): 単語帳への実際のインポート
    // 上限(プレミアムで5,000件)を超える件数を整形すると、インポート時に一部が
    // 失われる旨の警告が表示される。5,000行超の大きな入力はfill()自体に時間が
    // かかりうるため、独立したtry/catchに分離し(失敗してもそれまでの重要な
    // チェック結果を道連れにしない)、タイムアウトも延長する。 ----
    try {
      // 直前のCTAクリックチェックで/signupへ遷移したままなので、まずページへ
      // 戻る(でないと#word-list-inputが存在せずlocatorがtimeoutする)。
      await gotoReady(page, `${baseUrl}${PAGE_PATH}`);
      const overLimitInput = Array.from({ length: 5001 }, (_, i) => `word${i}: 意味${i}`).join("\n");
      // 5,000行超(約10万文字)はlocator.fill()が不安定にtimeoutすることがあるため、
      // React管理下のcontrolled textareaへネイティブのvalueセッター+inputイベントで
      // 直接値を設定する(React 16+の制御コンポーネントがonChangeを正しく検知する
      // 標準的な方法)。
      await page.locator("#word-list-input").evaluate((el, value) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        setter.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }, overLimitInput);
      await page.locator('button:has-text("CSVに整形する")').click();
      await page.waitForTimeout(500);
      const overLimitBodyText = await page.locator("body").innerText();
      if (overLimitBodyText.includes("整形結果(5001件)") && /5000件.*(のみ|上限)|上限.*5000件/.test(overLimitBodyText)) {
        ok("単語帳へのインポート上限(5,000件)を超える整形結果には、超過分が失われる旨の警告が表示される");
      } else {
        fail(`インポート上限超過の警告表示が見つからない。本文抜粋: ${overLimitBodyText.slice(0, 800)}`);
      }
    } catch (e) {
      fail(`5,000件超入力の検証中に例外: ${e.message}`);
    }

    await context.close();
  } catch (e) {
    fail(`ブラウザ検証中に例外: ${e.message}`);
  }

  // ---- クリップボードAPI失敗時のフォールバック: navigator.clipboard.writeTextを
  // 強制的に失敗させ、読み取り専用テキストエリアによる手動コピー案内が表示されることを
  // 確認する(権限拒否・非対応ブラウザでも「何も起きない」ままにしない) ----
  try {
    const clipboardFailContext = await browser.newContext();
    const clipboardFailPage = await clipboardFailContext.newPage();
    await clipboardFailPage.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("denied")) },
        configurable: true,
      });
    });
    await gotoReady(clipboardFailPage, `${baseUrl}${PAGE_PATH}`);
    await clipboardFailPage.locator("#word-list-input").fill(SAMPLE_INPUT);
    await clipboardFailPage.locator('button:has-text("CSVに整形する")').click();
    await clipboardFailPage.waitForTimeout(300);
    await clipboardFailPage.locator('button:has-text("CSVをコピー")').click();
    await clipboardFailPage.waitForTimeout(300);
    const fallbackTextarea = clipboardFailPage.locator('textarea[aria-label="整形されたCSV(手動コピー用)"]');
    const fallbackValue = await fallbackTextarea.inputValue().catch(() => null);
    if (await fallbackTextarea.count() === 1 && fallbackValue?.startsWith("word,meaning")) {
      ok("クリップボードAPI失敗時、読み取り専用テキストエリアによる手動コピーのフォールバックが表示される");
    } else {
      fail(`クリップボード失敗時のフォールバックが見つからない(count=${await fallbackTextarea.count()}, value=${JSON.stringify(fallbackValue)})`);
    }
    await clipboardFailContext.close();
  } catch (e) {
    fail(`クリップボード失敗フォールバック検証中に例外: ${e.message}`);
  }

  // ---- モバイルviewportでもtextarea/ボタンが操作可能であることを確認する ----
  try {
    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mobilePage = await mobileContext.newPage();
    await gotoReady(mobilePage, `${baseUrl}${PAGE_PATH}`);
    const mobileTextarea = mobilePage.locator("#word-list-input");
    await mobileTextarea.fill("apple: りんご");
    const mobileButton = mobilePage.locator('button:has-text("CSVに整形する")');
    await mobileButton.click();
    await mobilePage.waitForTimeout(300);
    const mobileBodyText = await mobilePage.locator("body").innerText();
    const hasHorizontalOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (mobileBodyText.includes("整形結果(1件)") && !hasHorizontalOverflow) {
      ok("モバイルviewport(375x812)でもtextarea入力・整形ボタン操作が機能し、横スクロールも発生しない");
    } else {
      fail(`モバイルviewportでの操作が想定外(整形結果表示=${mobileBodyText.includes("整形結果(1件)")}, 横スクロール=${hasHorizontalOverflow})`);
    }
    await mobileContext.close();
  } catch (e) {
    fail(`モバイルviewport検証中に例外: ${e.message}`);
  }

  if (browser) await browser.close();
  stopDevServer(dev);

  console.log(process.exitCode ? "\n=== test:word-list-cleaner: FAILED ===" : "\n=== test:word-list-cleaner RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
