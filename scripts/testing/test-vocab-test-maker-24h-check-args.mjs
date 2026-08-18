/**
 * scripts/reporting/vocab-test-maker-24h-check.mjs の引数解決ロジック
 * (parseArgs/resolvePostConfig、DBアクセスなし)の単体テスト。
 * 使い方: node scripts/testing/test-vocab-test-maker-24h-check-args.mjs
 */
import { parseArgs, resolvePostConfig } from "../reporting/vocab-test-maker-24h-check.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

// ---- parseArgs ----
{
  const args = parseArgs(["--content=x_launch_01", "--published-at=2026-08-18T10:00:00.000Z", "--source=x"]);
  if (args.content === "x_launch_01" && args["published-at"] === "2026-08-18T10:00:00.000Z" && args.source === "x") {
    ok("parseArgs: --key=value形式を正しくパースする");
  } else {
    fail(`parseArgs: パース結果が不正 (${JSON.stringify(args)})`);
  }
}
{
  const args = parseArgs(["--content=with=equals=sign"]);
  if (args.content === "with=equals=sign") ok("parseArgs: value自体に=が含まれても最初の=だけで区切る");
  else fail(`parseArgs: =を含む値の扱いが不正 (${args.content})`);
}

const knownSchedule = [{ content: "x_launch_01", source: "x", publishedAtISO: "2026-08-18T10:00:00.000Z" }];

// ---- resolvePostConfig ----
{
  const cfg = resolvePostConfig({ content: "x_launch_01" }, knownSchedule);
  if (cfg.publishedAtISO === "2026-08-18T10:00:00.000Z" && cfg.source === "x" && cfg.campaign === "vocab_test_maker_launch") {
    ok("resolvePostConfig: --published-at省略時、既知スケジュールから発行時刻/sourceを解決する");
  } else {
    fail(`resolvePostConfig: 既知スケジュール解決が不正 (${JSON.stringify(cfg)})`);
  }
}
{
  const cfg = resolvePostConfig(
    { content: "ig_feed_launch", "published-at": "2026-08-25T00:00:00.000Z", source: "instagram", campaign: "custom_campaign" },
    knownSchedule,
  );
  if (cfg.publishedAtISO === "2026-08-25T00:00:00.000Z" && cfg.source === "instagram" && cfg.campaign === "custom_campaign") {
    ok("resolvePostConfig: CLI引数が明示されていれば既知スケジュールより優先される");
  } else {
    fail(`resolvePostConfig: CLI引数優先の扱いが不正 (${JSON.stringify(cfg)})`);
  }
}
{
  let threw = false;
  try { resolvePostConfig({}, knownSchedule); } catch { threw = true; }
  if (threw) ok("resolvePostConfig: --contentが無ければ例外を投げる");
  else fail("resolvePostConfig: --content無しでも例外を投げなかった");
}
{
  let threw = false;
  let message = "";
  try { resolvePostConfig({ content: "unknown_post" }, knownSchedule); } catch (e) { threw = true; message = e.message; }
  if (threw && message.includes("unknown_post")) ok("resolvePostConfig: --published-at省略かつ未知のcontentなら分かりやすいエラーを投げる");
  else fail(`resolvePostConfig: 未知content+published-at省略時の扱いが不正 (threw=${threw}, message=${message})`);
}
{
  let threw = false;
  try { resolvePostConfig({ content: "x", "published-at": "not-a-date" }, knownSchedule); } catch { threw = true; }
  if (threw) ok("resolvePostConfig: --published-atが不正な日時なら例外を投げる");
  else fail("resolvePostConfig: 不正なpublished-atでも例外を投げなかった");
}

console.log(failed ? `\n=== test:vocab-test-maker-24h-check-args: ${failed}件失敗 ===` : "\n=== test:vocab-test-maker-24h-check-args RESULT: all checks passed ===");
process.exit(failed ? 1 : 0);
