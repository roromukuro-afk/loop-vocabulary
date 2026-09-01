/**
 * 「analytics(isTestEvent)判定は resolveAnalyticsRequestContext() 1か所だけを通る」ことの
 * ソースコード監査(DBアクセス不要・高速)。
 *
 * 背景: PR #137で、audit Cookie(lv_audit)伝播漏れをCodexレビューが個別のcall siteで
 * 繰り返し指摘した(7箇所への個別追加を要した)。原因は各API routeがリクエストの
 * header/cookieの生値を自分で読み取り、trackServerEvent()/trackWordCountMilestones()へ
 * 個別に渡していたこと(=call siteを追加するたびに、その箇所だけ判定漏れが起こりうる
 * 構造だった)。この監査は、判定ロジックを中央集約した
 * src/lib/analytics/resolveAnalyticsRequestContext.ts が実際に「唯一の経路」であり続けて
 * いることを、以下の2方向から機械的に証明する。
 *
 * 1. 危険な旧APIが実装ごと消えていること: computeIsTestEvent()という関数自体
 *    (単なる「使うな」という運用ルールではなく、呼び出しようがない状態)がsrc/に
 *    存在しない。
 * 2. isTestEvent判定へつながる既知の全route(API route + auth/callback)が、
 *    resolveAnalyticsRequestContext()を実際にimport・呼び出しており、かつ
 *    E2Eヘッダー/audit Cookieの生値を自分で読み取っていない。
 *
 * 新しいanalytics発火route(trackServerEvent/trackWordCountMilestonesを呼ぶroute)を
 * 追加した場合は、下のANALYTICS_EVENT_ROUTESへそのファイルパスを追加すること
 * (追加を忘れると、そのrouteの中央helper経由チェックが素通りしてしまうため、
 * check 3で「trackServerEvent/trackWordCountMilestonesを呼ぶ全routeがリストに
 * 含まれているか」も別途検証する)。
 *
 * 使い方: node scripts/testing/analytics-central-context-usage.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";
import { REPO_ROOT } from "./lib/env.mjs";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function readSrc(relPath) {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8").replace(/\r\n/g, "\n");
}

// trackServerEvent() / trackWordCountMilestones() を実際に呼んでいる、既知のanalytics発火route。
const ANALYTICS_EVENT_ROUTES = [
  "src/app/api/analytics/events/route.ts",
  "src/app/api/wordbook/[id]/ai-suggest/add/route.ts",
  "src/app/api/wordbook/[id]/csv-import/route.ts",
  "src/app/api/wordbook/[id]/bulk-add/route.ts",
  "src/app/api/wordbook/[id]/import-shared/route.ts",
  "src/app/api/material/[id]/import/route.ts",
  "src/app/api/tools/vocab-test-maker/save/route.ts",
  "src/app/auth/callback/route.ts",
];

// 判定の実装そのものを持つ、唯一許可されたファイル群(ここだけがheader/cookieの
// 生値・LV_AUDIT_TOKENを読み取ってよい)。
const CLASSIFICATION_IMPLEMENTATION_FILES = new Set([
  "src/lib/analytics/auditMode.ts",
  "src/lib/analytics/auditModeServer.ts",
  "src/lib/analytics/testEventClassification.ts",
  "src/lib/analytics/resolveAnalyticsRequestContext.ts",
  "src/middleware.ts",
]);

function main() {
  // --- 1. 危険な旧API(computeIsTestEvent)がコードとして一切存在しない ---
  console.log("--- 危険な旧API(computeIsTestEvent)の完全撤去 ---");
  let hits;
  try {
    hits = execSync(`git grep -n "computeIsTestEvent(" -- src`, { cwd: REPO_ROOT, encoding: "utf8" });
  } catch (e) {
    // git grep はマッチ0件だとexit code 1で例外を投げる。これが期待どおりの結果。
    hits = "";
  }
  // コメント内(経緯を説明する散文としての言及。例:
  // resolveAnalyticsRequestContext.tsの設計コメント)は実コードの呼び出しではないため除外する。
  // 行頭(先頭空白除去後)が `//`, `*`, `/**` のいずれかで始まる行をコメント行とみなす。
  const codeHits = hits
    .split("\n")
    .filter((line) => line.trim() !== "")
    .filter((line) => {
      const afterFilename = line.indexOf(":", line.indexOf(":") + 1);
      const content = (afterFilename === -1 ? line : line.slice(afterFilename + 1)).trim();
      return !/^(\/\/|\*|\/\*\*)/.test(content);
    });
  if (codeHits.length === 0) {
    ok("computeIsTestEvent(のコード上の呼び出しがsrc/に1件も存在しない(関数自体が撤去済み。コメント内での経緯言及は除く)");
  } else {
    bad(`computeIsTestEvent(の呼び出しが残っている:\n${codeHits.join("\n")}`);
  }

  // --- 2. 既知の全analytics発火routeがresolveAnalyticsRequestContext()を経由している ---
  console.log("\n--- 各routeが中央helper(resolveAnalyticsRequestContext)を経由している ---");
  for (const relPath of ANALYTICS_EVENT_ROUTES) {
    const src = readSrc(relPath);
    const importsHelper = /from\s+["']@\/lib\/analytics\/resolveAnalyticsRequestContext["']/.test(src)
      && /resolveAnalyticsRequestContext/.test(src);
    const callsHelper = /resolveAnalyticsRequestContext\s*\(/.test(src);
    if (importsHelper && callsHelper) {
      ok(`${relPath}: resolveAnalyticsRequestContext()を import・呼び出している`);
    } else {
      bad(`${relPath}: resolveAnalyticsRequestContext()のimportまたは呼び出しが見つからない`);
    }

    // 生のheader/cookie読み取りによる判定への迂回がないこと(この2定数のimport自体が
    // 無い=そもそも生値へアクセスする手段を持たない、という強い形で確認する)。
    const importsRawHeaderConst = /\bE2E_TEST_HEADER\b/.test(src) || /\bAUDIT_MODE_HEADER\b/.test(src);
    const importsRawCookieConst = /\bAUDIT_MODE_UI_COOKIE\b/.test(src) || /\bAUDIT_PROOF_COOKIE\b/.test(src);
    if (!importsRawHeaderConst && !importsRawCookieConst) {
      ok(`${relPath}: E2Eヘッダー/audit Cookieの生値を直接参照していない`);
    } else {
      bad(`${relPath}: E2Eヘッダー/audit Cookie定数を直接importしている(中央helperを迂回した判定の疑い)`);
    }
  }

  // --- 3. ANALYTICS_EVENT_ROUTESの網羅性: trackServerEvent/trackWordCountMilestonesを
  //        呼んでいる全routeが上のリストに含まれているか(リスト更新忘れの検出) ---
  console.log("\n--- ANALYTICS_EVENT_ROUTESリストの網羅性 ---");
  let callerFiles;
  try {
    callerFiles = execSync(
      `git grep -lE "trackServerEvent\\(|trackWordCountMilestones\\(" -- src/app`,
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
  } catch (e) {
    callerFiles = "";
  }
  const actualCallers = callerFiles
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.endsWith("/route.ts") || l.endsWith("route.ts"))
    .sort();
  // src/app/api/analytics/events/route.ts はresolveAnalyticsRequestContext()の結果
  // (isTestEvent)を自前のinsertへ直接使っており、trackServerEvent/
  // trackWordCountMilestonesは呼ばない(このrouteが「取り込み経路そのもの」であり、
  // 別のhelperを経由する必要がないため)。check 2で中央helper経由は別途確認済みなので、
  // ここでの網羅性チェック対象からは除外する。
  const expected = ANALYTICS_EVENT_ROUTES
    .filter((p) => p.startsWith("src/app/") && p !== "src/app/api/analytics/events/route.ts")
    .sort();
  const missing = actualCallers.filter((f) => !expected.includes(f));
  const stale = expected.filter((f) => !actualCallers.includes(f));
  if (missing.length === 0 && stale.length === 0) {
    ok(`ANALYTICS_EVENT_ROUTES(src/app/api配下 ${expected.length}件)が実際の呼び出しファイルと完全一致している`);
  } else {
    if (missing.length > 0) bad(`ANALYTICS_EVENT_ROUTESに未登録の呼び出しファイルがある(このテスト自体の更新漏れ): ${missing.join(", ")}`);
    if (stale.length > 0) bad(`ANALYTICS_EVENT_ROUTESに登録されているが実際には呼び出していないファイルがある: ${stale.join(", ")}`);
  }

  // --- 4. trackServerEvent/trackWordCountMilestonesのシグネチャがcontext必須になっている ---
  console.log("\n--- trackServerEvent/trackWordCountMilestonesがcontextを必須引数として要求している ---");
  const trackSrc = readSrc("src/lib/analytics/trackServerEvent.ts");
  const trackServerEventRequiresContext =
    /export async function trackServerEvent\(\s*eventName: string,\s*\n\s*(?:\/\*[\s\S]*?\*\/\s*\n\s*)?context: AnalyticsRequestContext,/.test(trackSrc);
  if (trackServerEventRequiresContext) {
    ok("trackServerEvent(): context: AnalyticsRequestContextが省略不可の必須引数になっている");
  } else {
    bad("trackServerEvent(): contextが必須引数の位置で見つからない(シグネチャが変更された可能性)");
  }
  const trackWordCountRequiresContext =
    /export async function trackWordCountMilestones\([\s\S]*?context: AnalyticsRequestContext,\s*\n\s*\): Promise<void>/.test(trackSrc);
  if (trackWordCountRequiresContext) {
    ok("trackWordCountMilestones(): context: AnalyticsRequestContextが省略不可の必須引数になっている(オプショナル・default値なし)");
  } else {
    bad("trackWordCountMilestones(): contextが必須引数の位置で見つからない(シグネチャが変更された可能性)");
  }
  if (/e2eHeaderValue\?|auditCookieValue\?/.test(trackSrc)) {
    bad("trackServerEvent.ts: 旧来のオプショナルe2eHeaderValue/auditCookieValueパラメータが残っている");
  } else {
    ok("trackServerEvent.ts: 旧来のオプショナルe2eHeaderValue/auditCookieValueパラメータが残っていない");
  }

  // --- 5. 判定の実装自体を持ってよいファイルの一覧が想定どおり(ドリフト検出) ---
  console.log("\n--- 判定実装ファイルの範囲確認 ---");
  let allRefs;
  try {
    allRefs = execSync(`git grep -lE "\\bE2E_TEST_HEADER\\b|\\bAUDIT_MODE_HEADER\\b|\\bAUDIT_MODE_UI_COOKIE\\b|\\bAUDIT_PROOF_COOKIE\\b" -- src`, { cwd: REPO_ROOT, encoding: "utf8" });
  } catch (e) {
    allRefs = "";
  }
  const refFiles = allRefs.split("\n").map((l) => l.trim()).filter(Boolean);
  const unexpectedRefs = refFiles.filter((f) => !CLASSIFICATION_IMPLEMENTATION_FILES.has(f));
  if (unexpectedRefs.length === 0) {
    ok(`E2Eヘッダー/audit Cookie定数の直接参照は許可された${CLASSIFICATION_IMPLEMENTATION_FILES.size}ファイルのみ`);
  } else {
    bad(`許可外のファイルがE2Eヘッダー/audit Cookie定数を直接参照している: ${unexpectedRefs.join(", ")}`);
  }

  console.log(fail
    ? `\n=== test:analytics-central-context-usage: ${fail}件失敗 (${pass}件成功) ===`
    : `\n=== test:analytics-central-context-usage RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main();
