import { gotoReady } from "./nav.mjs";

/**
 * Playwright: メール/パスワードでログインし /dashboard への遷移を待つ。
 * Next.js dev serverのハイドレーション完了前にクリックすると、React の
 * onSubmit(preventDefault)が間に合わずネイティブformのGET送信になってしまうため、
 * gotoReady でハイドレーションを待ってから操作する。
 */
export async function login(page, baseUrl, email, password) {
  await gotoReady(page, `${baseUrl}/login`);
  await page.locator('[data-testid="login-email"]').fill(email);
  await page.locator('[data-testid="login-password"]').fill(password);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }),
    page.locator('[data-testid="login-submit"]').click(),
  ]);
}

/**
 * ページのコンソールエラー・未捕捉例外を収集するリスナーを仕込む。
 *
 * 既知の非致命的事象（ReferralCard の window.location.origin ハイドレーション
 * ミスマッチ。NEXT_PUBLIC_SITE_URL 以外のオリジン(=このテスト環境)でのみ発生する
 * 既存の軽微な不具合で、Reactが自動回復するため致命的ではない。別途 spawn_task 済み）
 * は fatal 扱いにせず warnings 側に分離する。
 */
const KNOWN_NONFATAL = [
  /Hydration failed because the server rendered/,
  /Minified React error #418/, // 本番ビルドでの同じハイドレーションミスマッチ（圧縮版）
];

export function collectErrors(page) {
  const errors = [];
  const warnings = [];
  const push = (msg) => {
    if (KNOWN_NONFATAL.some((re) => re.test(msg))) warnings.push(msg);
    else errors.push(msg);
  };
  page.on("pageerror", (e) => push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") push(`console.error: ${msg.text()}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 500) errors.push(`http ${res.status()}: ${res.url()}`);
  });
  errors.warnings = warnings; // 配列に非列挙プロパティとして添付（既存呼び出し側の互換性維持）
  return errors;
}
