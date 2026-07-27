// AdSense Auto ads初期化スクリプトの文字列を組み立てる。
// AdSenseLoader.tsx (JSX) とテスト (scripts/testing/test-adsense-auto-ads-guard.mjs) の
// 両方から同じロジックを参照できるよう、生成ロジックだけを独立したモジュールに切り出している。
export function buildAutoAdsInitScript(client: string): string {
  return `(function(){
  // App Routerではクライアント側遷移でAdSenseLoaderが許可ルート↔非許可ルート間で
  // アンマウント/リマウントされ得る（実際のフルページロードは発生しない）。
  // window.adsbygoogleはドキュメントの生存期間を通じて保持されるため、ガード無しだと
  // 同一ドキュメント内で push({enable_page_level_ads:true}) が複数回実行され、
  // "Only one 'enable_page_level_ads' allowed per page" エラーになる。
  if (window.__lvAdsenseAutoAdsInit) return;
  window.__lvAdsenseAutoAdsInit = true;
  (window.adsbygoogle=window.adsbygoogle||[]).push({google_ad_client:"${client}",enable_page_level_ads:true});
})();`;
}
