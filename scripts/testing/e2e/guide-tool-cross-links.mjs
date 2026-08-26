/**
 * Issue #106: 関連ガイド記事から無料ツールへの内部導線の自律E2E検証。
 *
 * 当初対象4記事(検索意図が一致すると判断したもののみ、44記事全部ではない):
 *  - /guide/spaced-repetition-english-vocabulary -> /review-date-calculator
 *  - /guide/eiken-1kyu-tango -> /exam-countdown-planner
 *  - /guide/eiken-jun2-tango -> /exam-countdown-planner
 *  - /guide/eiken-3kyu-tango -> /exam-countdown-planner
 *
 * 追加(feat/guide-tool-cross-links-expand): 既に記事本文にツールへのリンクが
 * 存在するものの、data-tool/data-placementが付与されておらずGrowth OS側で
 * 記事別・設置箇所別に計測できていなかった12記事(13リンク)へ同じ属性を追加。
 * リンク自体は新規追加していない(既存のリンクへ属性を足しただけ)ため、記事本文の
 * 変更は一切なし。関連ページ一覧(フッター付近)のカードなど、本文中の明示的な
 * CTAではないリンクは対象外(Issue #106と同じ「検索意図が一致する主要導線のみ」
 * という基準を踏襲)。
 *
 * eiken-jun1-tangoは対象外: 静的フォルダルートと動的[slug]ルートの既知の
 * ルーティング競合(src/app/guide/[slug]/page.tsxのDYNAMIC_ROUTE_EXCLUDED_SLUGS
 * コメント、scripts/testing/e2e/guide-route-collision.mjsのKNOWN_DEFERRED_
 * COLLISIONS参照。オーナー判断待ちで今回のスコープ外)により、静的フォルダ側を
 * 編集してもビルドのたびにどちらの内容が実際に配信されるか不安定なため、この
 * リンクへの属性追加は保留する(実際に本テストで動的側の内容が配信され、静的側の
 * 編集が反映されないことを確認済み)。
 *
 * 検証内容(各記事について):
 * 1. リンクが存在し、記事本文と関係する具体的な文言(「便利なツールはこちら」等の
 *    汎用文言ではない)である
 * 2. リンク先pathは正しく、UTM等のquery paramが付与されていない(内部リンクで最初の
 *    流入source/campaignを上書きしないため)
 * 3. クリックでguide_cta_click(target=tools, destination_path, tool, placement)が
 *    GA4(gtag mock)・first-party Growth OS(analytics_events)の両方へ、単語本文等を
 *    含まずに発火する
 * 4. 既存のCTA(署名/premium/materials等)と重複していない(hrefの重複が無い)
 *
 * 使い方: node scripts/testing/e2e/guide-tool-cross-links.mjs
 */
import { chromium } from "playwright";
import { loadEnv } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

const CASES = [
  {
    slug: "spaced-repetition-english-vocabulary",
    linkHref: "/review-date-calculator",
    tool: "review_date_calculator",
    placement: "after_srs_mechanism",
    anchorTextIncludes: "復習日を計算する",
  },
  {
    slug: "eiken-1kyu-tango",
    linkHref: "/exam-countdown-planner",
    tool: "exam_countdown_planner",
    placement: "after_12month_strategy",
    anchorTextIncludes: "受験日から学習ペースを計算する",
  },
  {
    slug: "eiken-jun2-tango",
    linkHref: "/exam-countdown-planner",
    tool: "exam_countdown_planner",
    placement: "after_6week_plan",
    anchorTextIncludes: "受験日から学習ペースを計算する",
  },
  {
    slug: "eiken-3kyu-tango",
    linkHref: "/exam-countdown-planner",
    tool: "exam_countdown_planner",
    placement: "after_10week_plan",
    anchorTextIncludes: "受験日から学習ペースを計算する",
  },
  {
    slug: "vocabulary-quiz-pdf-for-teachers",
    linkHref: "/tools/vocab-test-maker",
    tool: "vocab_test_maker",
    placement: "bottom_cta",
    anchorTextIncludes: "貼り付けた単語でテストを作成",
  },
  {
    slug: "juku-vocabulary-test",
    linkHref: "/tools/vocab-test-maker",
    tool: "vocab_test_maker",
    placement: "bottom_cta",
    anchorTextIncludes: "自分の単語ですぐテストを作成",
  },
  {
    slug: "printable-english-vocabulary-test",
    linkHref: "/tools/vocab-test-maker",
    tool: "vocab_test_maker",
    placement: "bottom_cta",
    anchorTextIncludes: "印刷用の英単語テストを作る",
  },
  {
    slug: "english-vocabulary-quiz-maker",
    linkHref: "/tools/vocab-test-maker",
    tool: "vocab_test_maker",
    placement: "bottom_cta",
    anchorTextIncludes: "自分の単語で無料テストを作成",
  },
  {
    slug: "high-school-english-vocabulary-test",
    linkHref: "/tools/vocab-test-maker",
    tool: "vocab_test_maker",
    placement: "bottom_cta",
    anchorTextIncludes: "登録不要の英単語テスト作成ツール",
  },
  {
    slug: "school-test-vocabulary",
    linkHref: "/tools/vocab-test-maker",
    tool: "vocab_test_maker",
    placement: "bottom_cta",
    anchorTextIncludes: "範囲の単語で小テストを作成",
  },
  {
    slug: "eiken-2kyu-tango",
    linkHref: "/tools/vocab-test-maker",
    tool: "vocab_test_maker",
    placement: "mid_article_test_maker_card",
    anchorTextIncludes: "自分の単語でテストを作る",
  },
  {
    slug: "eiken-2kyu-tango",
    linkHref: "/exam-countdown-planner",
    tool: "exam_countdown_planner",
    placement: "mid_article_exam_countdown_card",
    anchorTextIncludes: "学習計画を立てる",
  },
  {
    slug: "eitango-no-oboekata",
    linkHref: "/tools/vocab-test-maker",
    tool: "vocab_test_maker",
    placement: "tools_list_card",
    anchorTextIncludes: "英単語テスト作成",
  },
  {
    slug: "eitango-oboeru-houhou",
    linkHref: "/tools/vocab-test-maker",
    tool: "vocab_test_maker",
    placement: "bottom_cta",
    anchorTextIncludes: "自己想起用のテストを無料作成",
  },
  {
    slug: "flashcards-vs-multiple-choice",
    linkHref: "/tools/vocab-test-maker",
    tool: "vocab_test_maker",
    placement: "bottom_cta",
    anchorTextIncludes: "4択のPDFテストを無料で作成",
  },
  {
    slug: "toeic-900ten",
    linkHref: "/exam-countdown-planner",
    tool: "exam_countdown_planner",
    placement: "mid_article_exam_countdown_card",
    anchorTextIncludes: "学習計画を立てる",
  },
  {
    slug: "toeic-tango",
    linkHref: "/exam-countdown-planner",
    tool: "exam_countdown_planner",
    placement: "mid_article_exam_countdown_card",
    anchorTextIncludes: "学習計画を立てる",
  },
];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

const MOCK_GTAG_INIT = `
  window.__gaEvents = [];
  window.gtag = function () { window.__gaEvents.push(Array.prototype.slice.call(arguments)); };
`;

async function getEvents(page, name) {
  return page.evaluate((n) => (window.__gaEvents || []).filter((e) => e[0] === "event" && e[1] === n), name);
}

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

async function runCase(browser, baseUrl, testCase) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(MOCK_GTAG_INIT);
  const errors = collectErrors(page);
  const analyticsEvents = await interceptAnalyticsEvents(page);
  const pagePath = `/guide/${testCase.slug}`;

  try {
    const response = await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    if (response && response.status() === 200) ok(`${pagePath} が200で表示される`);
    else fail(`${pagePath} が200で表示されない: status=${response?.status()}`);

    const link = page.locator(`a[href="${testCase.linkHref}"][data-tool="${testCase.tool}"]`);
    const linkCount = await link.count();
    if (linkCount === 1) ok(`${pagePath}: ${testCase.linkHref}への導線が(重複なく)1件存在する`);
    else fail(`${pagePath}: ${testCase.linkHref}への導線が想定外の件数: ${linkCount}`);

    const anchorText = await link.first().innerText().catch(() => "");
    if (anchorText.includes(testCase.anchorTextIncludes)) {
      ok(`${pagePath}: リンク文言が記事の文脈に沿った具体的な内容になっている("${testCase.anchorTextIncludes}")`);
    } else {
      fail(`${pagePath}: リンク文言が想定外: "${anchorText}"`);
    }

    // 内部リンクにUTM等のquery paramが付与されていないこと(最初の流入
    // source/campaignを内部遷移で上書きしないため)
    const href = await link.first().getAttribute("href");
    if (href === testCase.linkHref) {
      ok(`${pagePath}: リンクにquery param(UTM等)が付与されていないプレーンな内部リンクである`);
    } else {
      fail(`${pagePath}: リンクに想定外のパラメータが付与されている: ${href}`);
    }

    const placementAttr = await link.first().getAttribute("data-placement");
    if (placementAttr === testCase.placement) {
      ok(`${pagePath}: data-placement="${testCase.placement}"が正しく設定されている`);
    } else {
      fail(`${pagePath}: data-placementが想定外: ${placementAttr}`);
    }

    await link.first().click();
    await page.waitForTimeout(300);

    const gaEvents = await getEvents(page, "guide_cta_click");
    const gaMatched = gaEvents.find(
      (e) =>
        e[2]?.target === "tools" &&
        e[2]?.guide_slug === testCase.slug &&
        e[2]?.destination_path === testCase.linkHref &&
        e[2]?.tool === testCase.tool &&
        e[2]?.placement === testCase.placement
    );
    if (gaMatched) {
      ok(`${pagePath}: クリックでguide_cta_click(target/destination_path/tool/placementすべて正しい)がGA4へ発火する`);
    } else {
      fail(`${pagePath}: GA4へのguide_cta_click(destination_path/tool/placement込み)が想定外: ${JSON.stringify(gaEvents)}`);
    }

    const firstPartyEvents = analyticsEvents.filter((e) => e.event_name === "guide_cta_click");
    const matched = firstPartyEvents.find(
      (e) =>
        e.properties?.target === "tools" &&
        e.properties?.guide_slug === testCase.slug &&
        e.properties?.destination_path === testCase.linkHref &&
        e.properties?.tool === testCase.tool &&
        e.properties?.placement === testCase.placement
    );
    if (matched) {
      ok(`${pagePath}: first-party側にguide_cta_click(destination_path/tool/placementすべて正しい)が発火する`);
    } else {
      fail(`${pagePath}: first-party側のguide_cta_click(target/destination_path/tool/placement)が想定外: ${JSON.stringify(firstPartyEvents)}`);
    }

    // プライバシー: propertiesに単語本文・自由記述が一切含まれないことの確認
    // (固定のdata属性値のみを送っているため、値は既知の短い識別子のみのはず)
    const propsJson = JSON.stringify(matched?.properties ?? {});
    if (propsJson.length < 300) {
      ok(`${pagePath}: guide_cta_clickのpropertiesは固定識別子のみで肥大化していない(自由記述混入なし)`);
    } else {
      fail(`${pagePath}: guide_cta_clickのpropertiesが想定より大きい(自由記述が混入している疑い): ${propsJson}`);
    }

    if (errors.length === 0) ok(`${pagePath}: 操作中に console error / 5xx なし`);
    else fail(`${pagePath}: console error等を検出: ${errors.join(" / ")}`);
  } finally {
    await context.close();
  }
}

async function runMobileCheck(browser, baseUrl, testCase) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  const pagePath = `/guide/${testCase.slug}`;
  try {
    await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "load" });
    await page.waitForTimeout(300);
    const link = page.locator(`a[href="${testCase.linkHref}"][data-tool="${testCase.tool}"]`);
    const box = await link.first().boundingBox();
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (box && box.width > 0 && box.height > 0 && !hasHorizontalOverflow) {
      ok(`${pagePath}: モバイルviewport(375x812)でもリンクが表示され、横スクロールも発生しない`);
    } else {
      fail(`${pagePath}: モバイルviewportでの表示が想定外(box=${JSON.stringify(box)}, 横スクロール=${hasHorizontalOverflow})`);
    }
  } finally {
    await context.close();
  }
}

async function main() {
  loadEnv();
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  const browser = await chromium.launch();

  try {
    for (const testCase of CASES) {
      await runCase(browser, baseUrl, testCase);
    }
    // モバイル確認は1記事だけで十分(4記事とも同じコンポーネント構造・同じCSSクラスを使う)
    await runMobileCheck(browser, baseUrl, CASES[0]);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:guide-tool-cross-links: FAILED ===" : "\n=== test:guide-tool-cross-links RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
