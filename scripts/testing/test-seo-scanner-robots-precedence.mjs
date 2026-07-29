/**
 * scanSeo()内部のrobots.txt優先順位判定(parseRobotsGroups/resolveRulesForUserAgent/
 * isBlockedByRobots)の単体検証。ネットワークアクセスなしで、Google公式のprecedenceルール
 * (最長一致優先、同長ならAllow優先)に加え、User-agentグループの分離(Googlebot専用グループの
 * みを対象にし、AIクローラー専用グループのAllow/Disallowを混入させない)を直接検証する。
 *
 * 2026-07-29のchatgpt-codex-connector P2レビュー指摘への対応: 修正前の実装は全User-agent
 * グループのルールをフラットに1つに合体させていたため、例えば`User-agent: *`で
 * `Disallow: /setup`、OAI-SearchBot専用グループで`Allow: /setup`という場合に、
 * 同じ長さのAllowが勝ってしまい、Googlebotには依然としてブロックされているにも関わらず
 * 「ブロックされていない」と誤判定していた。
 *
 * 使い方: node scripts/testing/test-seo-scanner-robots-precedence.mjs
 */
import { parseRobotsGroups, resolveRulesForUserAgent, isBlockedByRobots } from "../../src/lib/improvement/analyzers/seo.ts";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }
function assertEqual(actual, expected, msg) {
  if (actual === expected) ok(msg);
  else fail(`${msg} (期待値=${expected}, 実際=${actual})`);
}

function googlebotBlocked(robotsTxt, path) {
  const groups = parseRobotsGroups(robotsTxt);
  const rules = resolveRulesForUserAgent(groups, "Googlebot");
  return isBlockedByRobots(rules, path);
}

function main() {
  // 1. wildcardのDisallowのみ: ブロックされる
  assertEqual(
    googlebotBlocked("User-agent: *\nDisallow: /setup\n", "/setup"),
    true,
    "wildcardのDisallowのみの場合はブロックされる",
  );

  // 2. wildcard内の同長Allow優先(Disallow+Allow併記、/setupの実運用パターン)
  assertEqual(
    googlebotBlocked("User-agent: *\nDisallow: /setup\nAllow: /setup\n", "/setup"),
    false,
    "wildcard内で同じ長さのDisallow+Allow併記ではAllowが優先されブロックされない",
  );

  // 3. wildcardより具体的な(長い)Disallowが優先される
  assertEqual(
    googlebotBlocked("User-agent: *\nAllow: /setup\nDisallow: /setup/internal\n", "/setup/internal"),
    true,
    "より長い一致のDisallowが短いAllowより優先されブロックされる",
  );

  // 4. wildcardより具体的な(長い)Allowが優先される
  assertEqual(
    googlebotBlocked("User-agent: *\nDisallow: /setup\nAllow: /setup/public\n", "/setup/public"),
    false,
    "より長い一致のAllowが短いDisallowより優先されブロックされない",
  );

  // 5. AIクローラー固有AllowがGooglebot判定に影響しない(今回のP2指摘の核心ケース)
  const wildcardDisallowPlusOaiAllow =
    "User-agent: *\nDisallow: /setup\n\nUser-agent: OAI-SearchBot\nAllow: /\nDisallow: /setup\nAllow: /setup\n";
  assertEqual(
    googlebotBlocked(wildcardDisallowPlusOaiAllow, "/setup"),
    true,
    "OAI-SearchBot専用グループのAllowはGooglebot判定に混入せず、wildcardのDisallowにより引き続きブロックされる",
  );

  // 6. AIクローラー固有DisallowがGooglebot判定に影響しない
  const wildcardAllowPlusGptbotDisallow =
    "User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n";
  assertEqual(
    googlebotBlocked(wildcardAllowPlusGptbotDisallow, "/setup"),
    false,
    "GPTBot専用グループの全面DisallowはGooglebot判定に混入せず、wildcardのAllowによりブロックされない",
  );

  // 7. Googlebot専用グループがある場合: そちらが優先され、wildcardは無視される
  const googlebotSpecificGroup =
    "User-agent: *\nDisallow: /setup\n\nUser-agent: Googlebot\nAllow: /setup\n";
  assertEqual(
    googlebotBlocked(googlebotSpecificGroup, "/setup"),
    false,
    "Googlebot専用グループが存在する場合はそちらが使われ、wildcardのDisallowは無視されブロックされない",
  );

  // 8. Googlebot専用グループが無い場合: wildcardへフォールバックする
  const noGooglebotGroup = "User-agent: *\nDisallow: /setup\n\nUser-agent: Bingbot\nAllow: /setup\n";
  assertEqual(
    googlebotBlocked(noGooglebotGroup, "/setup"),
    true,
    "Googlebot専用グループが無い場合はwildcardへフォールバックし、Bingbot専用グループは無関係でブロックされる",
  );

  // 9. 複数User-agentが同一グループに並ぶ場合(共有ルールセット)
  const sharedGroup = "User-agent: Googlebot\nUser-agent: Bingbot\nDisallow: /setup\n";
  assertEqual(
    googlebotBlocked(sharedGroup, "/setup"),
    true,
    "複数User-agentが同一グループに並ぶ場合、Googlebotも同じルールセット(Disallow)を共有しブロックされる",
  );

  // 10. マッチするルールが無い場合はブロックされない
  assertEqual(
    googlebotBlocked("User-agent: *\nDisallow: /admin\n", "/setup"),
    false,
    "マッチするルールが無いパスはブロックされない",
  );

  console.log(failed ? `\n=== test:seo-scanner-robots-precedence: ${failed}件失敗 ===` : "\n=== test:seo-scanner-robots-precedence RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
