// 監査モード(analytics除外・広告抑止)を起動するE2E/監査スクリプト共通のヘッダー値。
//
// 以前は x-lv-e2e-test ヘッダーの値が固定文字列"1"であれば誰でも監査モードを
// 起動できた(オーナー指摘のセキュリティ対応、Issue #136是正の再強化)。
// src/lib/analytics/auditMode.ts が LV_AUDIT_TOKEN 環境変数と照合するよう変更されたため、
// このヘッダーを送る全てのE2E/監査スクリプトは、固定文字列ではなくこの関数が返す値を使う。
import { loadEnv, requireEnv } from "./env.mjs";

// src/lib/analytics/auditModeServer.tsのAUDIT_TOKEN_MIN_LENGTHと必ず同じ値を保つこと。
// サーバー側はこの長さ未満のLV_AUDIT_TOKENを常に「不一致」= 監査モード起動せず、
// fail-closedで扱う。ここで同じ下限を検証しないと、短い(が空ではない)値が
// 誤設定された場合にrequireEnv()は通過してしまい、strictスクリプトが
// 「トークンを確定した」と思い込んだままdevサーバー起動やproduction閲覧まで
// 進行してしまう(Codexレビュー指摘、805ac98で発見)。実際にはヘッダーがサーバー側で
// 黙って拒否され、監査モードが起動しないまま実リクエストが送られてしまうため、
// 「外部通信の前に必ず落ちる」というfail-fast契約が壊れる。
const AUDIT_TOKEN_MIN_LENGTH = 32;

/**
 * 監査モードの実際の起動(X-Robots-Tag/Cache-Control/Cookie付与・GA4/AdSense抑止)を
 * 検証するテスト専用。LV_AUDIT_TOKEN未設定、または設定されていてもサーバー側の
 * 最小長未満の場合は、理由を表示してprocess.exit(1)する(トークン不一致のまま実際に
 * HTTPリクエストを送ってしまうと、production DBへis_test_event=falseとして実データが
 * 混入する恐れがあるため、送信前に必ず落とす)。
 */
export function getAuditToken() {
  loadEnv();
  requireEnv(["LV_AUDIT_TOKEN"]);
  const token = process.env.LV_AUDIT_TOKEN;
  if (token.length < AUDIT_TOKEN_MIN_LENGTH) {
    console.error(
      `\n❌ LV_AUDIT_TOKENが短すぎる(${token.length}文字、最小${AUDIT_TOKEN_MIN_LENGTH}文字必要)。` +
        "サーバー側(auditModeServer.ts)はこの長さ未満のトークンを常に不一致として扱い、監査モードを起動しない。" +
        "値そのものは表示しない。正しい長さの値を再設定してから再実行すること。"
    );
    process.exit(1);
  }
  return token;
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
