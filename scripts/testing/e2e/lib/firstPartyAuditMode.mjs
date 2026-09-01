// オーナー指摘対応(Codexレビュー、PR #137、P1、緊急): `page.setExtraHTTPHeaders()` /
// `browserContext.setExtraHTTPHeaders()` はpage/context単位で以後の「全て」の
// リクエストへヘッダーを付与する(Playwrightの仕様どおりの正しい挙動)。そのため
// これまでのgotoReady()実装は、E2Eテストが監査ヘッダー(x-lv-e2e-test:
// LV_AUDIT_TOKEN)を送ったpage上で、アプリ自身がunconditionalに読み込む第三者
// スクリプト(Google Tag Manager gtag/js・Funding Choices同意管理スクリプト等。
// scripts/testing/e2e/lib/adNetworkGuard.mjsのコメント参照: これらはlayout.tsxが
// 監査モードでも無条件に<script src>を出力する)へも同じ秘密ヘッダーを送ってしまう
// 構造的な脆弱性を持っていた。
//
// この関数は代わりに `page.route()` によるper-request interceptionを使い、
// 呼び出し側が明示的に許可したorigin(URL文字列のprefix一致ではなく
// `new URL(url).origin`の完全一致)への「そのoriginへの最初のmain-frame document
// navigationリクエスト」1回だけへヘッダーを付与する。それ以外(第三者origin・
// 同一originへの2回目以降のnavigation・XHR/fetch等)は一切変更せずcontinueする。
// 2回目以降の同一origin遷移がis_test_event=trueのまま維持されるのは、最初の
// リクエストでmiddleware.tsが発行するaudit Cookie(lv_audit)をブラウザが以後
// 自動的に送信するためで、ヘッダーの継続送信には一切依存しない(元々の設計意図
// どおり)。
//
// redirect先が別originの場合にヘッダーが付かないことについて: 実測で確認したところ、
// Playwrightのnavigation request(main-frame document)に対してroute.continue({headers})
// でヘッダーを注入すると、その後サーバーが3xxを返した場合、ブラウザ側がCDPの
// 関与しない内部処理でredirectを自動followし、その際に注入済みのheaderを次のhopへ
// そのまま引き継いでしまうことを実測で確認した(単に「新しいrequestとしてroute()を
// 再評価するから自然に付かない」という想定は誤りだった。route()自体がredirect先の
// hopに対して一切再度呼ばれない。leak防止テスト
// scripts/testing/e2e/audit-header-leak-prevention.mjsのシナリオ2が最初の実装での
// 実際の漏洩を検出した)。
//
// この問題を避けるため、ヘッダーを注入する対象(このoriginへの最初のmain-frame
// document navigationだけ)に限り、route.continue()でブラウザに直接送らせるのではなく、
// Playwright自身が提供するroute.fetch({headers, maxRedirects:0})
// (「実際にリクエストを実行するがfulfillはしない。結果を変更してからfulfillする」
// ための公式API)を使い、「3xxが返ってきてもブラウザに追わせず、3xxのレスポンス
// 自体をそのままroute.fulfill({response})でブラウザへ返す」方式に変える
// (fetchAndFulfillWithHeaderOnce()参照)。ブラウザは3xxを受け取ると(routeで
// 確定応答済みの)全く新しいnavigationとしてredirect先へ遷移するため、route()が
// そのredirect先に対して正しく再度呼ばれる(=redirect先がthird-party originなら、
// そのfresh requestは`isFirstParty`判定がfalseになりheaderが付かない。同一origin
// ならsentOriginsが既にtrueのため再送されずCookieに委ねる)。
//
// route.fetch()を使う理由(Node組み込みのfetch()ではなく): 最初にNode組み込みの
// fetch()でNode process自身から代理リクエストする実装を試したところ、
// route.fulfill()で返したdocumentは、Chromeがそれを「本物のネットワーク応答」として
// 扱わなくなるらしく、その後の同一document内の127.0.0.1系サブリソースrequestが
// Private Network Access関連の仕組みで実際にERR_FAILEDになる(実測で確認)。
// route.fetch()はPlaywrightのAPIRequestContext経由・Chrome自身のnetwork stackを
// 通すため、この問題が起きないことを実測で確認した。
//
// 同じpageに対してallowFirstPartyOrigin()を複数回呼んでも安全(route handlerの登録は
// page単位で1回だけ、WeakMapで管理する)。
import { getAuditToken, getAuditTokenOrNull } from "../../lib/auditToken.mjs";

const HEADER_NAME = "x-lv-e2e-test";
const pageState = new WeakMap();

async function fetchAndFulfillWithHeaderOnce(route, headers) {
  // maxRedirects:0 = route.continue()相当の1hop分だけを実際に実行し、3xxが
  // 返ってきてもブラウザに追わせない(APIResponseとしてこちらへ返る)。
  const apiResponse = await route.fetch({ headers, maxRedirects: 0 });
  // route.fulfill({response})が推奨パターン(Playwright公式ドキュメント: 「実際の
  // リクエストは実行するがfulfillはせず、結果を変更してからfulfillする」)。
  // headersを明示的に上書きしない = APIResponse自身が持つ正しいcontent-encoding
  // 処理・Set-Cookie複数件の扱いをPlaywright側にそのまま委ねる(route.fetch()は
  // Chrome自身のnetwork stackを経由するため、Node組み込みfetch()を使う場合と
  // 異なりcontent-encoding/Set-Cookie複数件を手動で扱う必要が無い)。
  return route.fulfill({ response: apiResponse });
}

function ensureInstalled(page) {
  let state = pageState.get(page);
  if (state) return state;

  state = { allowedOrigins: new Set(), sentOrigins: new Set(), tokenByOrigin: new Map() };
  pageState.set(page, state);

  state.installedPromise = page.route("**/*", async (route) => {
    const request = route.request();
    let origin;
    try {
      origin = new URL(request.url()).origin;
    } catch {
      // URLとして解釈できないrequest(あり得ないはずだが)は安全側でroute.fallback()する
      // (下記と同じ理由: 他のroute handler(adNetworkGuard.mjs等)がこのpage上に
      // 先に登録されている場合、その判断を尊重する)。
      return route.fallback();
    }

    const isFirstParty = state.allowedOrigins.has(origin);
    const isMainFrameDocumentNav = request.isNavigationRequest() && request.frame() === page.mainFrame();
    const token = state.tokenByOrigin.get(origin);

    if (isFirstParty && isMainFrameDocumentNav && !state.sentOrigins.has(origin) && token) {
      state.sentOrigins.add(origin);
      const existingHeaders = await request.allHeaders();
      return fetchAndFulfillWithHeaderOnce(route, { ...existingHeaders, [HEADER_NAME]: token });
    }

    // route.continue()ではなくroute.fallback()を使う: このpage上でguardAdNetworkRequests()
    // (scripts/testing/e2e/lib/adNetworkGuard.mjs)のような他のroute handlerが
    // 先に(このhandlerより前に)登録されていた場合、Playwrightのroute解決順序
    // (最後に登録されたhandlerが最初に評価される)により、route.continue()で
    // 確定させてしまうとその古いhandlerへ制御が一切渡らず、広告ネットワーク遮断が
    // 無効化されてしまう。fallback()は「このhandlerは関与しない」を意味し、
    // より前に登録されたhandlerへ判断を委ねる(それも無ければ実際にnetworkへ送る)。
    return route.fallback();
  });

  return state;
}

/**
 * 指定originを「監査ヘッダーを送ってよい自サイト」として許可し、そのoriginへの
 * 最初のmain-frame document navigationでtokenを送るよう登録する。
 * @param {import("playwright").Page} page
 * @param {string} origin - 完全一致で比較する自サイトのorigin(例: "http://localhost:3799"、"https://loop-vocabulary.app")
 * @param {string | null} token - null/空文字ならこのoriginへは一切ヘッダーを送らない(installはするがtokenByOriginに登録しない)。
 */
export async function allowFirstPartyOrigin(page, origin, token) {
  const state = ensureInstalled(page);
  await state.installedPromise;
  state.allowedOrigins.add(origin);
  if (token) state.tokenByOrigin.set(origin, token);
}

/** テスト側検証用: 実際にヘッダーを送信済みのoriginかどうか。 */
export function hasSentAuditHeaderFor(page, origin) {
  return pageState.get(page)?.sentOrigins.has(origin) === true;
}

/**
 * gotoReady()相当: 監査ヘッダーの安全な付与(allowFirstPartyOrigin、最初の
 * first-party document navigationだけ)+ページ遷移+ハイドレーション待ちをまとめる。
 * LV_AUDIT_TOKEN未設定時はヘッダー自体を一切送らない
 * (getAuditTokenOrNull()がnullを返し、allowFirstPartyOrigin()がtokenByOriginへ
 * 登録しないためヘッダー付与条件が常にfalseになる)。
 *
 * @param {{ strict?: boolean }} [opts] - strict:trueならLV_AUDIT_TOKEN未設定時に
 *   getAuditToken()を使い、開始前(このawait時点)でprocess.exit(1)する
 *   (監査モードの実際の起動そのものを検証するテスト専用)。
 */
export async function gotoReadyFirstPartyOnly(page, url, opts = {}) {
  const token = opts.strict ? getAuditToken() : getAuditTokenOrNull();
  const origin = new URL(url).origin;
  await allowFirstPartyOrigin(page, origin, token);
  const response = await page.goto(url, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  return response;
}
