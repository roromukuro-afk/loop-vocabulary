/**
 * src/lib/auth/googleOauthSignup.ts の isNewGoogleOauthSignup() 単体テスト
 * (ブラウザ・サーバー不要)。
 *
 * src/app/auth/callback/route.ts はGoogle OAuth(signInWithOAuth)と
 * マジックリンク(signInWithOtp、src/app/login/page.tsx)の両方の入口を共有しており、
 * どちらの経路でも新規ユーザー作成時はcreated_at/last_sign_in_atがほぼ同時刻になる。
 * provider種別を確認せずタイミングだけで判定すると、マジックリンク経由の新規signup
 * までGoogle OAuth signupとして誤記録してしまう(Codexレビュー指摘対応)。
 *
 * 使い方: node scripts/testing/test-google-oauth-signup-detection.mjs
 */
import { isNewGoogleOauthSignup } from "../../src/lib/auth/googleOauthSignup.ts";

let pass = 0;
let fail = 0;

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    pass++;
    console.log(`✅ ${label}`);
  } else {
    fail++;
    console.error(`❌ FAIL: ${label}\n   got:      ${actual}\n   expected: ${expected}`);
  }
}

const now = new Date().toISOString();
const fiveSecondsLater = new Date(Date.now() + 5000).toISOString();
const oneHourLater = new Date(Date.now() + 60 * 60 * 1000).toISOString();

// ── Google OAuth経由の新規signup: providerがgoogleで作成直後 → true ──
assertEqual(
  isNewGoogleOauthSignup({ created_at: now, last_sign_in_at: fiveSecondsLater, app_metadata: { provider: "google" } }),
  true,
  "provider=googleで作成直後(5秒後)のログイン → 新規Google OAuth signupと判定される"
);

// ── マジックリンク経由の新規signup(Codexレビュー指摘の中心ケース): providerがemailで
//    作成直後 → false(provider不一致のため、タイミングが新規signup相当でも発火しない) ──
assertEqual(
  isNewGoogleOauthSignup({ created_at: now, last_sign_in_at: fiveSecondsLater, app_metadata: { provider: "email" } }),
  false,
  "provider=email(マジックリンク)で作成直後(5秒後)のログイン → Google OAuth signupと誤判定されない"
);

// ── Google OAuth経由の再ログイン(既存ユーザー): providerはgoogleだが間隔が長い → false ──
assertEqual(
  isNewGoogleOauthSignup({ created_at: now, last_sign_in_at: oneHourLater, app_metadata: { provider: "google" } }),
  false,
  "provider=googleでも作成から1時間後のログイン(既存ユーザーの再ログイン) → 新規signupと判定されない"
);

// ── providerが無い(app_metadata自体が無い/undefined) → false ──
assertEqual(
  isNewGoogleOauthSignup({ created_at: now, last_sign_in_at: fiveSecondsLater }),
  false,
  "app_metadataが無い → false(providerを確認できないため発火しない)"
);
assertEqual(
  isNewGoogleOauthSignup({ created_at: now, last_sign_in_at: fiveSecondsLater, app_metadata: {} }),
  false,
  "app_metadata.providerが無い → false"
);

// ── created_at/last_sign_in_atが欠けている → false ──
assertEqual(
  isNewGoogleOauthSignup({ created_at: now, last_sign_in_at: null, app_metadata: { provider: "google" } }),
  false,
  "last_sign_in_atがnull → false"
);
assertEqual(
  isNewGoogleOauthSignup({ created_at: undefined, last_sign_in_at: fiveSecondsLater, app_metadata: { provider: "google" } }),
  false,
  "created_atが無い → false"
);

// ── userそのものがnull/undefined → false ──
assertEqual(isNewGoogleOauthSignup(null), false, "user=null → false");
assertEqual(isNewGoogleOauthSignup(undefined), false, "user=undefined → false");

console.log(fail === 0 ? "\n=== test:google-oauth-signup-detection: ALL CHECKS PASSED ===" : "\n=== test:google-oauth-signup-detection: FAILED ===");
process.exit(fail === 0 ? 0 : 1);
