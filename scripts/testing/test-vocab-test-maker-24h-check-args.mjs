/**
 * scripts/reporting/vocab-test-maker-24h-check.mjs の引数解決ロジック
 * (parseArgs/resolvePostConfig、DBアクセスなし)の単体テスト。
 * 使い方: node scripts/testing/test-vocab-test-maker-24h-check-args.mjs
 */
import { parseArgs, resolvePostConfig, buildFilterAttr, sanitizeForFilename, buildReportBaseName } from "../reporting/vocab-test-maker-24h-check.mjs";

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
  // 回帰テスト(Codexレビュー指摘対応、PR #102、10巡目、P2): 既知の投稿の
  // 発行時刻だけを--published-atで訂正し、--sourceを省略した場合でも、
  // KNOWN_LAUNCH_SCHEDULEの既知sourceが失われず引き継がれること。以前は
  // --published-atが明示されるとKNOWN_LAUNCH_SCHEDULEの検索自体が丸ごと
  // スキップされ、sourceがnullになっていた。
  const cfg = resolvePostConfig(
    { content: "x_launch_01", "published-at": "2026-08-18T11:00:00.000Z" },
    knownSchedule,
  );
  if (cfg.publishedAtISO === "2026-08-18T11:00:00.000Z" && cfg.source === "x") {
    ok("resolvePostConfig: --published-atだけを訂正しても既知のsourceは引き継がれる(丸ごとフィルタ無しへ劣化しない)");
  } else {
    fail(`resolvePostConfig: --published-at訂正時のsource引き継ぎが不正 (${JSON.stringify(cfg)})`);
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
{
  // 回帰テスト(Codexレビュー指摘対応、PR #102、20巡目、P2): 長い入力(track.ts側の
  // 100文字制限いっぱいのcontent/source/campaignを連結したpostIdentity相当)でも、
  // 「読める部分」が一定長で切り詰められ、結果全体が短く収まること。以前は
  // safeが元の長さを無制限に保持していたため、buildReportBaseName()が生成する
  // 最終的なファイル名がWindowsの単一パス要素の上限(255文字)を超え得た。
  const longValue = "a".repeat(100) + "-" + "b".repeat(100) + "-" + "c".repeat(100) + "-2026-08-19T10:00:00.000Z";
  const name = sanitizeForFilename(longValue);
  if (name.length <= 70) {
    ok(`sanitizeForFilename: 長い入力(${longValue.length}文字)でも結果は短く切り詰められる(${name.length}文字)`);
  } else {
    fail(`sanitizeForFilename: 長い入力が切り詰められず結果が長すぎる (${name.length}文字: ${name})`);
  }
}
{
  // 切り詰め後に読める部分が同じ文字列になる異なる入力どうしも、hashサフィックスが
  // 元の(切り詰め前の)値から計算されるため別のファイル名になり続ける
  // (切り詰めによって衝突回避が壊れていないことの確認)。
  const prefix = "x".repeat(70); // 読める部分の上限(60)を超える共通接頭辞
  const a = sanitizeForFilename(`${prefix}-suffixA`);
  const b = sanitizeForFilename(`${prefix}-suffixB`);
  if (a !== b) {
    ok("sanitizeForFilename: 切り詰め後の読める部分が同じになる異なる入力どうしも、hashサフィックスにより別のファイル名になる");
  } else {
    fail(`sanitizeForFilename: 切り詰め後に衝突する異なる入力が同じファイル名になった (${a})`);
  }
}

// ---- buildReportBaseName(Codexレビュー指摘対応、PR #102、19巡目、P2) ----
{
  // 同じcontentでもsource/campaign/startISOが異なれば別のbaseNameになる
  // (以前はcontentと日付だけだったため、同じcontentを別のsource/campaignや
  // 訂正後のpublished-atで同日に再実行すると、先の結果を静かに上書きしていた)。
  const a = buildReportBaseName("x_launch_01", "x", "vocab_test_maker_launch", "2026-08-19T10:00:00.000Z", "2026-08-19");
  const b = buildReportBaseName("x_launch_01", "twitter", "vocab_test_maker_launch", "2026-08-19T10:00:00.000Z", "2026-08-19");
  const c = buildReportBaseName("x_launch_01", "x", "another_campaign", "2026-08-19T10:00:00.000Z", "2026-08-19");
  const d = buildReportBaseName("x_launch_01", "x", "vocab_test_maker_launch", "2026-08-19T11:00:00.000Z", "2026-08-19");
  if (new Set([a, b, c, d]).size === 4) {
    ok("buildReportBaseName: 同じcontentでもsource/campaign/startISOが異なればbaseNameが衝突しない");
  } else {
    fail(`buildReportBaseName: source/campaign/startISO違いでbaseNameが衝突した (${JSON.stringify([a, b, c, d])})`);
  }
}
{
  // 同一の全パラメータなら常に同じbaseNameになる(決定論的、冪等な再実行で同じ
  // ファイルを上書きできる)。
  const a = buildReportBaseName("x_launch_01", "x", "vocab_test_maker_launch", "2026-08-19T10:00:00.000Z", "2026-08-19");
  const b = buildReportBaseName("x_launch_01", "x", "vocab_test_maker_launch", "2026-08-19T10:00:00.000Z", "2026-08-19");
  if (a === b) ok("buildReportBaseName: 同じ入力なら常に同じbaseNameを返す(決定論的)");
  else fail(`buildReportBaseName: 非決定論的 (${a} !== ${b})`);
}
{
  // sourceが不明(null/undefined)でも例外にならず"unknown"扱いで安定したbaseNameになる。
  const name = buildReportBaseName("custom_post", null, "vocab_test_maker_launch", "2026-08-19T10:00:00.000Z", "2026-08-19");
  if (/^vocab-test-maker-24h-check-[A-Za-z0-9_-]+-2026-08-19$/.test(name)) {
    ok("buildReportBaseName: sourceが不明でも例外にならず安全なbaseNameを返す");
  } else {
    fail(`buildReportBaseName: source不明時の扱いが不正 (${name})`);
  }
}
{
  // 回帰テスト(Codexレビュー指摘対応、PR #102、20巡目、P2): content/source/campaignが
  // それぞれtrack.ts側の100文字制限いっぱいの場合でも、baseName + ".summary.txt"
  // (12文字)がWindowsの単一パス要素の上限(255文字)を大きく下回ること。
  const long100 = (prefix) => (prefix + "x".repeat(100)).slice(0, 100);
  const name = buildReportBaseName(long100("content"), long100("source"), long100("campaign"), "2026-08-19T10:00:00.000Z", "2026-08-19");
  const fullFilename = `${name}.summary.txt`;
  if (fullFilename.length <= 150) {
    ok(`buildReportBaseName: content/source/campaignが100文字いっぱいでもファイル名は十分短い(${fullFilename.length}文字、Windows上限255文字に対し大きな余裕)`);
  } else {
    fail(`buildReportBaseName: 長い入力でファイル名が長くなりすぎる (${fullFilename.length}文字: ${fullFilename})`);
  }
}

console.log(failed ? `\n=== test:vocab-test-maker-24h-check-args: ${failed}件失敗 ===` : "\n=== test:vocab-test-maker-24h-check-args RESULT: all checks passed ===");
process.exit(failed ? 1 : 0);
