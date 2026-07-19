/**
 * Loop Autonomous Improvement System: タスク種別ごとの必要テスト自動選択(Phase 7)。
 * improvement_tasksの各種changeフラグから、実行すべき既存npm testスクリプト名の配列を返す。
 * ここで選ばれたテストが1つでも失敗すればDraft PRをreadyにしない
 * (engineering-agent.mjsのゲート判定で使う)。
 */
export type TaskChangeFlags = {
  dbMigrationRequired: boolean;
  apiChangeRequired: boolean;
  uiChangeRequired: boolean;
  analyticsChangeRequired: boolean;
  seoImpact: boolean;
  billingImpact: boolean; // trueの場合、実装そのものをブロックする(呼び出し側の責務)
};

export const BASE_TESTS = ["typecheck", "build"] as const;

const SEO_TESTS = [
  "test:canonical-integrity",
  "test:indexing-policy",
  "test:all-production-domain-redirects",
  "test:noindex-crawlability",
  "test:crawler-readable-pages",
];

const ANALYTICS_TESTS = [
  "test:analytics-production-ingestion",
  "test:analytics-rejection-reasons",
  "test:test-account-exclusion",
];

const API_TESTS = ["test:premium-gating"]; // 既存の認証/権限ガード回帰を最低限含める

const UI_TESTS = ["test:smoke"];

const BILLING_READONLY_TESTS = ["verify:prod"]; // 課金変更時は実装せず読み取り専用確認のみ許可

export function selectRequiredTests(flags: TaskChangeFlags): string[] {
  const tests = new Set<string>(BASE_TESTS);
  if (flags.seoImpact) SEO_TESTS.forEach((t) => tests.add(t));
  if (flags.analyticsChangeRequired) ANALYTICS_TESTS.forEach((t) => tests.add(t));
  if (flags.apiChangeRequired) API_TESTS.forEach((t) => tests.add(t));
  if (flags.uiChangeRequired) UI_TESTS.forEach((t) => tests.add(t));
  if (flags.billingImpact) BILLING_READONLY_TESTS.forEach((t) => tests.add(t));
  tests.add("test:smoke"); // 最低限のスモークテストは常に含める
  return [...tests];
}
