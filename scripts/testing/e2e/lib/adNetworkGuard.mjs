// E2Eテストが第三者広告ネットワーク(AdSense/忍者AdMax/i-mobile/GA4計測エンドポイント等)へ
// 実際のHTTPリクエストを送らないようにするための共通ガード(Issue #136)。
//
// 背景: 本来は「監査モードやprovider判定ロジックが正しく動作しているか」を検証したいだけ
// なのに、これまでのE2Eは実際にブラウザへ本物のスクリプトを読み込ませていたため、
// テスト実行のたびにGoogle/忍者AdMax/i-mobile側の実インフラへ本物のHTTPリクエストが
// 発生していた(意図しないbotトラフィック)。route interceptionでこれらのドメインへの
// リクエストを検出した時点でabortし、URLと件数だけ記録することで、「コード側が
// リクエストを試みたかどうか」は検証しつつ、外部への実通信は一切発生させない。
//
// 対象ドメインは「広告タグ・計測タグが実際に読み込む本体スクリプト/ビーコン」のみに絞る
// (自サイト自身のページ本体HTML/JS/CSSは対象外)。
const AD_NETWORK_URL_PATTERNS = [
  /pagead2\.googlesyndication\.com/, // AdSense本体スクリプト
  /doubleclick\.net/,
  /googleadservices\.com/,
  /google-analytics\.com\/(g|mp)\/collect/, // GA4計測ビーコン(gtag/js自体は対象外)
  /analytics\.google\.com\/g\/collect/,
  /clarity\.ms/, // Microsoft Clarity
  /adm\.shinobi\.jp/, // 忍者AdMax
  /cnobi\.jp/,
  /im-apps\.net/, // i-mobile系オーディエンスデータ
  /i-mobile\.co\.jp/,
];

/**
 * pageに対してroute interceptionを仕込み、広告/計測ネットワークへのリクエストを
 * 検出した時点でabortする。戻り値のblocked配列に、abortしたURLが追記されていく
 * (テスト側はblocked.length / blocked自体を見て検証する)。
 */
export async function guardAdNetworkRequests(page) {
  const blocked = [];
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (AD_NETWORK_URL_PATTERNS.some((re) => re.test(url))) {
      blocked.push(url);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  return blocked;
}
