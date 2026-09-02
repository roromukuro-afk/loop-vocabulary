/**
 * analytics関連の「このリクエスト/イベントはtestとして扱うべきか(isTestEvent)」を
 * 決定する唯一の場所(オーナー指摘対応)。
 *
 * 以前はheader値・auditCookie値をAPI route側で個別に読み取り、trackServerEvent()や
 * computeIsTestEvent()へ生の値のまま渡していたため、Codexレビューが同じ
 * 「audit Cookie伝播漏れ」を複数のcall siteで別々に指摘する事態が繰り返された
 * (call siteを追加するたびに、その箇所だけ判定漏れが起きうる構造だった)。
 * この関数はRequest(NextRequestを含む)を1つ受け取り、判定に必要な情報
 * (E2Eヘッダー・audit Cookie・実行環境)をここだけで読み取って結論(isTestEvent)を返す。
 * 呼び出し側はheader/cookieの生値を一切扱わず、常にこの関数が返したcontextだけを使う。
 *
 * trackServerEvent() / trackWordCountMilestones() はこのcontextを必須引数として要求する
 * (省略・デフォルト値でのすり抜けを防ぐため、オプショナル引数にはしない=省略すると
 * TypeScriptのコンパイルエラーになる)。
 */
// 明示的な.ts拡張子の理由はtestEventClassification.ts冒頭のコメント参照。
import { isAuditModeRequest } from "./auditModeServer.ts";
import { isProductionEnvironment } from "./testEventClassification.ts";

export interface AnalyticsRequestContext {
  readonly isTestEvent: boolean;
}

export async function resolveAnalyticsRequestContext(request: Request): Promise<AnalyticsRequestContext> {
  // isAuditModeRequest()がCookieの署名検証のためasync化された(オーナー指摘対応、
  // 2026-09-01。src/lib/analytics/auditModeServer.tsのコメント参照)ため、この関数も
  // async化されている。呼び出し側は全箇所でawaitすること。
  const isTestEvent = (await isAuditModeRequest(request)) || !isProductionEnvironment();
  return { isTestEvent };
}
