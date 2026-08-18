/**
 * scripts/reporting/vocab-test-maker-24h-check.mjs の引数解決ロジック
 * (parseArgs/resolvePostConfig、DBアクセスなし)の単体テスト。
 * 使い方: node scripts/testing/test-vocab-test-maker-24h-check-args.mjs
 */
import { parseArgs, resolvePostConfig, buildFilterAttr, sanitizeForFilename } from "../reporting/vocab-test-maker-24h-check.mjs";

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

// ---- buildFilterAttr(Codexレビュー指摘対応、PR #102、5巡目、P2) ----
{
  const attr = buildFilterAttr("x", "vocab_test_maker_launch");
  if (attr.source === "x" && attr.campaign === "vocab_test_maker_launch") {
    ok("buildFilterAttr: sourceが分かっていればsource+campaignの両方で絞り込む");
  } else {
    fail(`buildFilterAttr: source指定時の結果が不正 (${JSON.stringify(attr)})`);
  }
}
{
  // sourceが不明(null/undefined)でも、campaignだけの絞り込みは失わない
  // (以前はfilterAttr全体がnullになり、フィルタ無しへ完全にフォールバックしていた)。
  const attr = buildFilterAttr(null, "vocab_test_maker_launch");
  if (!("source" in attr) && attr.campaign === "vocab_test_maker_launch") {
    ok("buildFilterAttr: sourceが不明でもcampaignだけの絞り込みは維持される(フィルタ無しへ完全フォールバックしない)");
  } else {
    fail(`buildFilterAttr: source不明時の結果が不正 (${JSON.stringify(attr)})`);
  }
}

// ---- sanitizeForFilename(Codexレビュー指摘対応、PR #102、8巡目、P2) ----
{
  const name = sanitizeForFilename("ig feed/launch:1");
  if (/^[A-Za-z0-9_-]+$/.test(name)) {
    ok("sanitizeForFilename: 記号(スペース・スラッシュ・コロン)を含むcontentも安全な文字集合へ丸められる");
  } else {
    fail(`sanitizeForFilename: サニタイズが不十分 (${name})`);
  }
}
{
  // パストラバーサル対策: ".."を含む値がreports/vocab-test-maker-launch/の外を
  // 指す文字列にならないこと(スラッシュ・ドットが安全な文字集合から除外される)。
  const name = sanitizeForFilename("../../etc/passwd");
  if (!name.includes("..") && !name.includes("/")) {
    ok("sanitizeForFilename: パストラバーサル文字列(../..)が安全な文字列へ丸められる");
  } else {
    fail(`sanitizeForFilename: パストラバーサル対策が不十分 (${name})`);
  }
}
{
  // サニタイズ後に衝突する異なるcontentどうしも、hashサフィックスにより
  // 別のファイル名になる(schtasksClient.mjsのcontentHashSuffix()と同じ設計)。
  const a = sanitizeForFilename("ig feed/launch:1");
  const b = sanitizeForFilename("ig_feed_launch_1");
  if (a !== b) ok("sanitizeForFilename: サニタイズ後に衝突する異なるcontentどうしは別のファイル名になる");
  else fail(`sanitizeForFilename: サニタイズ後衝突するcontentが同じファイル名になった (${a})`);
}

console.log(failed ? `\n=== test:vocab-test-maker-24h-check-args: ${failed}件失敗 ===` : "\n=== test:vocab-test-maker-24h-check-args RESULT: all checks passed ===");
process.exit(failed ? 1 : 0);
