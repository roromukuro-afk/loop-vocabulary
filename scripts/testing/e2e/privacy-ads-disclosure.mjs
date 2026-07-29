/**
 * プライバシーポリシーの広告・CMP関連開示監査（AdSense事前審査対応 Phase 5→CMP対応）
 *
 * AdSense審査に進む前に、/privacy が実装（GA4 / Microsoft Clarity / Google AdSense /
 * Cookie利用 / パーソナライズ広告オプトアウト手段）を実際に開示しているかを、
 * 生fetch（JS実行なし、crawler-readable-pages.mjsと同様の手法）で検証する回帰テスト。
 * 文言そのものの妥当性判断はできないため、あくまで「必須トピックへの言及が
 * HTML本文から消えていないか」の機械的なチェックに限定する。
 *
 * 確認項目:
 * 1. /privacy が200で取得できる
 * 2. Google Analytics（または GA4）への言及がある
 * 3. Microsoft Clarity への言及がある
 * 4. Google AdSense（または「広告」という語）への言及がある
 * 5. Cookie 利用についての言及がある
 * 6. パーソナライズ広告のオプトアウト手段（Google広告設定 adssettings.google.com 等）
 *    への言及がある
 * 7. Google Funding Choices（CMP/同意管理メッセージ）についての言及がある
 * 8. 同意選択を後から変更できるUI導線（AdConsentSettingsLink）への言及がある
 *
 * 使い方: node scripts/testing/e2e/privacy-ads-disclosure.mjs
 */
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

function stripToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// トピックごとに複数の許容表記をORで判定する（文言の言い回しが変わっても
// テストが過剰に壊れないようにするため）。
const CHECKS = [
  { label: "Google Analytics (GA4) への言及", patterns: [/Google Analytics/i, /\bGA4\b/i] },
  { label: "Microsoft Clarity への言及", patterns: [/Microsoft Clarity/i, /\bClarity\b/i] },
  { label: "Google AdSense または広告配信全般への言及", patterns: [/AdSense/i, /広告/] },
  { label: "Cookie 利用についての言及", patterns: [/Cookie/i, /クッキー/] },
  {
    label: "パーソナライズ広告のオプトアウト手段への言及",
    patterns: [/adssettings\.google\.com/i, /パーソナライズ広告/, /広告設定/],
  },
  {
    label: "Google Funding Choices（同意管理メッセージ/CMP）についての言及",
    patterns: [/同意管理メッセージ/, /同意選択/],
  },
  {
    label: "同意選択を後から変更できる導線（AdConsentSettingsLink）への言及",
    patterns: [/広告のパーソナライズ設定を変更する/],
  },
];

async function main() {
  const { url: baseUrl, proc } = await ensureDevServer(PORT);
  let failed = 0;

  try {
    const res = await fetch(`${baseUrl}/privacy`);
    if (res.status !== 200) {
      console.log(`❌ /privacy: expected 200, got ${res.status}`);
      failed++;
    } else {
      console.log(`✅ /privacy: 200`);
      const html = await res.text();
      const text = stripToText(html);

      for (const { label, patterns } of CHECKS) {
        const matched = patterns.some((re) => re.test(text));
        if (matched) {
          console.log(`✅ ${label}`);
        } else {
          console.log(`❌ ${label}: 該当する表記が /privacy 本文に見つからない`);
          failed++;
        }
      }
    }

    if (failed > 0) {
      console.log(`\n=== privacy-ads-disclosure: ${failed}件失敗 ===`);
      process.exitCode = 1;
    } else {
      console.log("\n=== privacy-ads-disclosure: ALL CHECKS PASSED ===");
    }
  } finally {
    stopDevServer(proc);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
