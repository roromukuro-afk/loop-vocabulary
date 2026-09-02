// オーナー指摘対応(2026-09-01): 監査モードの実際の起動そのものを検証するstrictな
// E2Eテストのうち、自分自身でローカルdevサーバーを起動して閉じたループの中だけで
// 検証を完結させるもの(ga4-webdriver-exclusion.mjs等)は、production用の
// LV_AUDIT_TOKEN(GitHub Environment secret / Vercel Production)を一切必要としない
// ように再設計した。
//
// 理由: これらのテストが検証しているのは「ヘッダー値がLV_AUDIT_TOKENと一致した
// リクエストだけ監査モードが起動すること」という仕組みそのものであって、
// 「production用の"本物の"値と一致すること」ではない。テストが自分で起動する
// ローカルdevサーバー(ensureDevServer/ensureServer)へ、テストプロセス自身が
// このプロセスの生存期間だけ有効な使い捨てのランダム値を環境変数として直接渡し、
// 同じ値をブラウザ側のヘッダー注入(allowFirstPartyOrigin等)にも使う。
//
// これにより、production secretは「実際にproduction環境(https://loop-vocabulary.app)
// を検証するテスト」(scripts/testing/check-prod-srs-v2-global.mjs)だけが必要とする
// ものへ絞り込まれ、ローカル/CI上の大半のE2Eテストはproduction secretの存在に
// 一切依存しない・触れない(ファイルにもログにも残らない・GitHub/Vercelの実際の値を
// 一度も読み取らない)。
//
// 各テストプロセスの起動ごとに1回だけ生成し(モジュールレベルのlazy singleton、
// 同一プロセス内で複数回呼んでも同じ値を返す)、プロセス終了とともに(どこにも
// 永続化されないため)自動的に破棄される。
import { randomBytes } from "node:crypto";

let cached = null;

/** このテストプロセスの生存期間だけ有効な使い捨てトークンを返す(プロセスメモリのみ)。 */
export function getEphemeralAuditToken() {
  if (!cached) cached = randomBytes(32).toString("hex");
  return cached;
}
