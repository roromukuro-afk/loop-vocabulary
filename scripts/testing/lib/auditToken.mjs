// 監査モード(analytics除外・広告抑止)を起動するE2E/監査スクリプト共通のヘッダー値。
//
// 以前は x-lv-e2e-test ヘッダーの値が固定文字列"1"であれば誰でも監査モードを
// 起動できた(オーナー指摘のセキュリティ対応、Issue #136是正の再強化)。
// src/lib/analytics/auditMode.ts が LV_AUDIT_TOKEN 環境変数と照合するよう変更されたため、
// このヘッダーを送る全てのE2E/監査スクリプトは、固定文字列ではなくこの関数が返す値を使う。
//
// LV_AUDIT_TOKEN未設定の場合はrequireEnv()が理由を表示してprocess.exit(1)する
// (トークン不一致のまま実際にHTTPリクエストを送ってしまうと、production DBへ
// is_test_event=falseとして実データが混入する恐れがあるため、送信前に必ず落とす)。
import { loadEnv, requireEnv } from "./env.mjs";

export function getAuditToken() {
  loadEnv();
  requireEnv(["LV_AUDIT_TOKEN"]);
  return process.env.LV_AUDIT_TOKEN;
}
