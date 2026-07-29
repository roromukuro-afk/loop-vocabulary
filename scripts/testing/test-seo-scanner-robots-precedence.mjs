/**
 * scanSeo()内部のrobots.txt優先順位判定(parseRobotsRules/isBlockedByRobots)の単体検証。
 * ネットワークアクセスなしで、Google公式のprecedenceルール(最長一致優先、同長ならAllow優先)を
 * 直接検証する。/setupのように意図的にDisallow+Allowを併記して解除したパスを、
 * 実際にはクロール可能であるにも関わらず「まだブロックされている」と誤検出しないことを保証する。
 *
 * 使い方: node scripts/testing/test-seo-scanner-robots-precedence.mjs
 */
import { parseRobotsRules, isBlockedByRobots } from "../../src/lib/improvement/analyzers/seo.ts";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }
function assertEqual(actual, expected, msg) {
  if (actual === expected) ok(msg);
  else fail(`${msg} (期待値=${expected}, 実際=${actual})`);
}

function main() {
  // 1. 単純なDisallowのみ: ブロックされる
  const simpleDisallow = parseRobotsRules("User-agent: *\nDisallow: /setup\n");
  assertEqual(isBlockedByRobots(simpleDisallow, "/setup"), true, "Disallowのみの場合はブロックされる");

  // 2. Disallow+Allow同時併記(同じ深さ): Allowが勝つ(/setupの実運用パターン)
  const disallowPlusAllow = parseRobotsRules("User-agent: *\nDisallow: /setup\nAllow: /setup\n");
  assertEqual(isBlockedByRobots(disallowPlusAllow, "/setup"), false, "同じ長さのDisallow+Allow併記ではAllowが優先されブロックされない");

  // 3. より具体的な(長い)Disallowが、短いAllowより優先される
  const specificDisallow = parseRobotsRules("User-agent: *\nAllow: /setup\nDisallow: /setup/internal\n");
  assertEqual(isBlockedByRobots(specificDisallow, "/setup/internal"), true, "より長い一致のDisallowが短いAllowより優先されブロックされる");

  // 4. より具体的な(長い)Allowが、短いDisallowより優先される
  const specificAllow = parseRobotsRules("User-agent: *\nDisallow: /setup\nAllow: /setup/public\n");
  assertEqual(isBlockedByRobots(specificAllow, "/setup/public"), false, "より長い一致のAllowが短いDisallowより優先されブロックされない");

  // 5. マッチするルールが無い場合はブロックされない
  const noMatch = parseRobotsRules("User-agent: *\nDisallow: /admin\n");
  assertEqual(isBlockedByRobots(noMatch, "/setup"), false, "マッチするルールが無いパスはブロックされない");

  console.log(failed ? `\n=== test:seo-scanner-robots-precedence: ${failed}件失敗 ===` : "\n=== test:seo-scanner-robots-precedence RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
