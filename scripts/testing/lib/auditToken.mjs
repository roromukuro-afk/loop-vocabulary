// 監査モード(analytics除外・広告抑止)を起動するE2E/監査スクリプト共通のヘッダー値。
//
// 以前は x-lv-e2e-test ヘッダーの値が固定文字列"1"であれば誰でも監査モードを
// 起動できた(オーナー指摘のセキュリティ対応、Issue #136是正の再強化)。
// src/lib/analytics/auditMode.ts が LV_AUDIT_TOKEN 環境変数と照合するよう変更されたため、
// このヘッダーを送る全てのE2E/監査スクリプトは、固定文字列ではなくこの関数が返す値を使う。
import { loadEnv, requireEnv } from "./env.mjs";

/**
 * 監査モードの実際の起動(X-Robots-Tag/Cache-Control/Cookie付与・GA4/AdSense抑止)を
 * 検証するテスト専用。LV_AUDIT_TOKEN未設定の場合はrequireEnv()が理由を表示して
 * process.exit(1)する(トークン不一致のまま実際にHTTPリクエストを送ってしまうと、
 * production DBへis_test_event=falseとして実データが混入する恐れがあるため、
 * 送信前に必ず落とす)。
 */
export function getAuditToken() {
  loadEnv();
  requireEnv(["LV_AUDIT_TOKEN"]);
  return process.env.LV_AUDIT_TOKEN;
}

/**
 * scripts/testing/e2e/lib/nav.mjs の gotoReady() など、大多数の一般的なE2Eテストが使う
 * 「保険としてのE2Eマーキング」用。これらのテストは監査モードの実際の起動
 * (ヘッダー値がLV_AUDIT_TOKENと一致すること)には依存していない — production以外の
 * 環境(ローカルdev・CI)ではresolveAnalyticsRequestContext()がVERCEL_ENV未設定を
 * 見て既にisTestEvent=trueへfail-openするため、このヘッダーはあくまで多層防御の保険。
 *
 * LV_AUDIT_TOKEN未設定でも(secretを一切渡さない独立PR CI = pr-quality-gate.ymlは
 * 意図的に一切secretを持たない設計。forbidden-paths.jsonのコメント参照)、
 * このヘッダーを送るだけの大多数のE2Eテストがそこで無条件に失敗しないよう、
 * ここではrequireEnv()で落とさない。ただし(オーナー指摘対応)不一致がほぼ確実な
 * プレースホルダー文字列を代わりに送ることもしない — ヘッダー自体を一切送らない
 * (呼び出し側でヘッダーキーを省略する)のが唯一の安全な選択肢: 万が一将来
 * LV_AUDIT_TOKENの最小長チェック(AUDIT_TOKEN_MIN_LENGTH)が緩められたり、
 * 実際のトークン値が偶然この文字列と一致したりした場合でも、ヘッダーを送らなければ
 * 監査モードが誤って起動する経路そのものが存在しない。未設定時はnullを返し、
 * 呼び出し側は必ず「nullならヘッダーキー自体を組み立てない」こと
 * (`"1"`のような固定値へのフォールバックも同様に禁止)。
 * 監査モードの実際の起動を検証するテストは、代わりに上のgetAuditToken()を使い、
 * 未設定時は明示的にテスト自体を落とすこと。
 */
export function getAuditTokenOrNull() {
  loadEnv();
  return process.env.LV_AUDIT_TOKEN || null;
}
