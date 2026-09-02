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
//
// オーナー指摘対応(Codexレビュー、805ac98に対する新規指摘、2026-09-01): 以前は
// 「そのoriginへ一度ヘッダーを送ったら二度と送らない」(sentOrigins: Set)実装だった。
// これはmiddleware.tsが発行するlv_audit Cookie(AUDIT_MODE_COOKIE_MAX_AGE_SECONDS=10分の
// sliding window。ページ遷移のたびに延長される)が途切れない前提に依存していたが、
// 本番監査ページ(特にcheck-prod-srs-v2-global.mjsのような人間が操作する長時間セッション)
// がCookieの寿命を超えて完全にidle状態(遷移が一切発生しない)になると、Cookieが実際に
// 期限切れになる。その後の次のnavigationでは、Cookieが無効なうえヘッダーも二度と
// 送られないため、監査モードが静かに無効化され(navigator.webdriverが偽装されている
// 環境ではGA4/広告が有効化されてしまい)、以降のfirst-party analyticsイベントが実本番
// トラフィックとして誤って記録される。
// 対策: 「一度きり」ではなく「Cookieの寿命より十分短い間隔でのみ再送を省略する」方式へ
// 変更する(RESEND_INTERVAL_MSはCookie寿命の半分。ネットワーク遅延・処理時間のマージンを
// 確保しつつ、Cookieが実際に切れる前に確実に再送する)。
import { getAuditToken, getAuditTokenOrNull } from "../../lib/auditToken.mjs";
import { AUDIT_MODE_COOKIE_MAX_AGE_SECONDS } from "../../../../src/lib/analytics/auditMode.ts";

const HEADER_NAME = "x-lv-e2e-test";
const RESEND_INTERVAL_MS = (AUDIT_MODE_COOKIE_MAX_AGE_SECONDS * 1000) / 2;
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
  await route.fulfill({ response: apiResponse });
  // オーナー指摘対応(Codexレビュー、2026-09-01、4回にわたる指摘):
  // 1回目: route.fetch()が例外を投げて失敗した場合でも「送信済み」と記録されて
  //   いた → awaitの後へ移動。
  // 2回目: route.fetch()はネットワークレベルの失敗でしか例外を投げず、5xx応答は
  //   例外にならず正常にresolveする → HTTPステータスも確認するよう変更。
  // 3回目(P1): 「ステータスが2xx/3xxであること」は、実際にLV_AUDIT_TOKENが
  //   正しく認証されたことの証明にはならない。トークンがproductionのLV_AUDIT_TOKENと
  //   一致しない場合(check-prod-srs-v2-global.mjsで人間が誤ったトークンを渡した場合等)
  //   でも、middleware.tsは通常のページを正常に(200で)返す。
  // 4回目(このコミット、オーナー再指摘): X-Robots-Tag: noindexを活性化の証拠として
  //   使うのは不正確だった。このヘッダーは監査モードと無関係な理由(通常のnoindexページ・
  //   auth/search/placeholder系ページ自身のnoindex設定・Vercelや別middleware/
  //   next.config.jsによるnoindex付与)でも同じ値になりうるため、トークン不一致でも
  //   「たまたま」X-Robots-Tag: noindexが付いたページへアクセスした場合に誤って
  //   activated=trueと判定してしまう恐れがあった。middleware.tsは現在、
  //   isAuditModeRequest()がtrueの場合にのみX-LV-Audit-Active: 1という専用headerを
  //   付与する(audit-mode以外の一切の理由では付与されない、正しいtoken検証との
  //   1対1対応)ため、この値の有無だけで実際の認証成否を検証する。
  const status = apiResponse.status();
  const activated = apiResponse.headers()["x-lv-audit-active"] === "1";
  return { status, activated };
}

function ensureInstalled(page, resendIntervalMs) {
  let state = pageState.get(page);
  if (state) return state;

  // resendIntervalMsはテスト専用の上書き(scripts/testing/e2e/audit-header-leak-prevention.mjs
  // が、実際の5分待機なしに再送ロジックを検証するために使う)。通常呼び出しでは常に
  // 省略され、実際のCookie寿命から導出したRESEND_INTERVAL_MSを使う。
  state = {
    allowedOrigins: new Set(),
    sentAt: new Map(),
    tokenByOrigin: new Map(),
    strictByOrigin: new Map(),
    resendIntervalMs: resendIntervalMs ?? RESEND_INTERVAL_MS,
  };
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
    // オーナー指摘対応(Codexレビュー、2026-09-01、4回目の指摘、その後オーナー自身の
    // 再指摘で許可リスト方式へ変更): 監査対象ページがドキュメントnavigationを一切伴わない
    // まま(SPA内操作のみで)Cookie寿命(10分)を超えてidleになった場合、以前はmain-frame
    // document navigationにしかヘッダーを再送しなかったため、その後発火するXHR/fetch
    // (例: /api/analytics/eventsへの回答送信)は失効済みCookieのまま、ヘッダーも付かずに
    // 送られ、実本番トラフィックとして記録されてしまっていた。
    //
    // 当初は「xhr/fetchかつNext.js内部router requestではない」という除外リスト方式
    // だったが、オーナー指摘により「明示的なfirst-party document/API requestへ限定する」
    // 許可リスト方式へ変更した。middleware.ts自身が「/api/*だけを監査ヘッダー・Cookie
    // 発行ロジックの対象外にする」という同じ境界線を使っている(config.matcherコメント
    // 参照)ため、この境界線(pathname.startsWith("/api/"))を再利用するのが最も正確
    // (server側の実際の判定境界と常に一致する)。これにより/_next/*・static asset
    // (image/font/script/stylesheet等、そもそもresourceTypeがxhr/fetchと一致しない)・
    // service worker・RSC prefetch(next-router-prefetch/rscヘッダー、念のため二重に除外)
    // は自動的に対象外になる(third-party origin・redirect先の別originは元々
    // isFirstPartyで絞られている)。
    const requestHeaders = request.headers();
    const isNextInternalRouterRequest = "rsc" in requestHeaders || "next-router-prefetch" in requestHeaders;
    let pathname = "";
    try {
      pathname = new URL(request.url()).pathname;
    } catch {
      pathname = "";
    }
    const isFirstPartyApiRequest = !isNextInternalRouterRequest
      && pathname.startsWith("/api/")
      && (request.resourceType() === "xhr" || request.resourceType() === "fetch");
    const token = state.tokenByOrigin.get(origin);
    const lastSentAt = state.sentAt.get(origin);
    const needsResend = lastSentAt === undefined || Date.now() - lastSentAt >= state.resendIntervalMs;

    if (isFirstParty && (isMainFrameDocumentNav || isFirstPartyApiRequest) && needsResend && token) {
      // オーナー指摘対応(Codexレビュー、2026-09-01、3回にわたる指摘): sentAtの更新は
      // fetchAndFulfillWithHeaderOnce()が実際に「監査モードとして認証された」ことを
      // 確認できた後にだけ行う。
      // 1回目: 以前はawaitより前に更新しており、route.fetch()が例外を投げて失敗した
      //   場合でも「送信済み」と記録されてしまっていた → awaitの後へ移動。
      // 2回目: route.fetch()はネットワークレベルの失敗でしか例外を投げず、5xx応答は
      //   例外にならず正常にresolveする → HTTPステータスも確認するよう変更。
      // 3回目(P1): ステータスが2xx/3xxであることは「ページが正常に返った」ことしか
      //   証明せず、「LV_AUDIT_TOKENが実際に認証された」ことは証明しない(トークン
      //   不一致でもmiddleware.tsは通常ページを200で返す)。fetchAndFulfillWithHeaderOnce()が
      //   返すactivated(X-LV-Audit-Active: 1の有無、middleware.tsのisAuditModeRequest()と
      //   1対1対応する専用の観測可能な証跡)も必須条件に加える。
      //
      // /api/*へのXHR/fetchはactivatedを検証しない: middleware.tsは/api/*を監査ヘッダー・
      // Cookie発行ロジックの対象外にしている(chunked転送のレスポンスへヘッダーを
      // 追記するとハングする既知の問題、middleware.tsのconfig.matcherコメント参照)ため、
      // X-LV-Audit-Active自体がそもそも付与されない(=/api/*経由でCookieが再発行される
      // ことはなく、client側のUI Cookieもこの経路では絶対に更新されない。オーナー指摘
      // 対応で実測確認済み。auditMode.tsのisAuditModeActiveClient()側でsession-state
      // フォールバックを持たせている理由)。/api/*へのXHR/fetchはCookieの発行に依存せず、
      // このrequest自体へ直接ヘッダーを載せてresolveAnalyticsRequestContext()にその場で
      // 正しく判定させることだけが目的であり、「将来のrequestのためにCookieが
      // 有効化されたか」を確認する必要が無い(=activated確認が意味を持つのはnavigation
      // だけ)。そのため/api/* XHR/fetchの成功はstate.sentAtを更新しない(navigation側の
      // 「Cookieがまだ有効なはず」という判定を誤って上書きしないため。/api/* XHR/fetchは
      // needsResendが真である限り、送信のたびに正しくヘッダーを載せ続ける)。
      const existingHeaders = await request.allHeaders();
      // page/contextがこのrequestの処理中に閉じられた場合(テスト終盤の非同期request等。
      // XHR/fetchを対象に含めたことで、テストの明示的なawaitの対象外だった非同期request
      // がcontext.close()と競合する経路が増えた)、Playwrightはroute callback失敗として
      // 例外を投げ、これを捕捉しなければプロセス全体がunhandled rejectionでクラッシュ
      // する(実測で確認)。この場合はこのrequest自体の結果を気にする意味が既に無い
      // (呼び出し元のtestが終了処理に入っている)ため、「未確認」として扱い(status=0,
      // activated=false)、以降の既存ロジック(sentAt不更新・strict時はfail-fast)へ
      // 委ねる。
      let status = 0;
      let activated = false;
      try {
        ({ status, activated } = await fetchAndFulfillWithHeaderOnce(route, { ...existingHeaders, [HEADER_NAME]: token }));
      } catch {
        // 上記コメントのとおり、意図的に握りつぶす(status=0/activated=falseのまま)。
      }
      // オーナー指摘対応(Codexレビュー、2026-09-02、P2 "Settle the route after a failed
      // proxy fetch"): 上のcatchはpage/context closed競合のために置いたものだが、
      // route.fetch()は「pageは開いたままだが一時的なDNS/接続/上流ネットワーク障害で
      // 失敗した」場合にも例外を投げる。その場合にrouteを未確定(fulfillもabortもしない)
      // のまま握りつぶすと、Playwrightはこのnavigation/API requestをpendingのまま放置し、
      // 呼び出し側のpage.goto()等がnavigationタイムアウトまでハングしてしまう(トークン
      // 再送を伴う次のリトライにも到達できない)。status===0(=fulfillまで到達しなかった)
      // の場合はabortで明示的にrouteを確定させ、呼び出し側へ通常のネットワークエラーとして
      // 即座に伝播させる(sentAtは未更新のため、リトライ時はトークンが正しく再送される)。
      // page/contextが既に閉じているケースではabort自体も例外を投げるが、その場合は
      // 確定させる相手のrequestがもう存在しないため握りつぶしてよい。
      // strict時のfail-fast(下のthrow)はabort後も従来どおり発火する。
      if (status === 0) {
        try { await route.abort(); } catch { /* page/context closed: 確定不要 */ }
      }
      if (isMainFrameDocumentNav && status < 400 && activated) {
        state.sentAt.set(origin, Date.now());
      } else if (isMainFrameDocumentNav && state.strictByOrigin.get(origin)) {
        // strict:true(監査モードの実際の起動そのものを検証するテスト専用、
        // gotoReadyFirstPartyOnly()のopts.strict参照)の場合、トークン不一致等で
        // 監査モードが起動しなかったこと自体を検知不能なまま実処理を続行させない
        // (production審査スクリプトが「監査モードのつもり」で実ユーザートラフィックを
        // 生成し続けるのを防ぐfail-fast)。
        throw new Error(
          `監査モードの起動に失敗した(strict): origin=${origin}, status=${status}, activated=${activated}。` +
          `LV_AUDIT_TOKENがproductionの値と一致しているか確認すること(値自体はログに出力しない)。`
        );
      }
      return;
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
 * @param {{ resendIntervalMs?: number, strict?: boolean }} [opts] - resendIntervalMsは
 *   テスト専用(scripts/testing/e2e/audit-header-leak-prevention.mjs参照)。通常呼び出しでは
 *   省略し、実際のCookie寿命から導出したRESEND_INTERVAL_MSを使うこと。strict:trueの場合、
 *   このoriginへのヘッダー送信がステータス2xx/3xxかつX-Robots-Tag: noindexで実際に
 *   認証されたことを確認できなければ例外を投げる(オーナー指摘対応、2026-09-01、P1:
 *   トークン不一致でも通常ページが200で返るため、ステータスだけでは認証成功を
 *   証明できない。check-prod-srs-v2-global.mjsのような、監査モードの実際の起動を
 *   前提にproductionへアクセスするstrictスクリプトが、誤ったトークンのまま気づかず
 *   実ユーザートラフィックを生成し続けるのを防ぐ)。
 */
export async function allowFirstPartyOrigin(page, origin, token, opts = {}) {
  const state = ensureInstalled(page, opts.resendIntervalMs);
  await state.installedPromise;
  state.allowedOrigins.add(origin);
  if (token) state.tokenByOrigin.set(origin, token);
  if (opts.strict) state.strictByOrigin.set(origin, true);
}

/** テスト側検証用: 実際にヘッダーを送信済みのoriginかどうか。 */
export function hasSentAuditHeaderFor(page, origin) {
  return pageState.get(page)?.sentAt.has(origin) === true;
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
  await allowFirstPartyOrigin(page, origin, token, { strict: opts.strict });
  const response = await page.goto(url, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  return response;
}
