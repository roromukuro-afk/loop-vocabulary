/**
 * AIクローラー個別robots.txtポリシー + llms.txt の検証（AI_SEARCH_AND_INDEXNOW_POLICY.md
 * 2026-07-28実装分、T-09/A-02クローズ）。
 *
 * 確認項目:
 * 1. `public/robots.txt` の `User-agent: *` ブロックが、既存の必須Disallowパスを
 *    引き続きすべて含んでいる（indexing-policy.mjsのROBOTS_DISALLOW_REQUIREDと
 *    同じリストを使い、AIクローラー用ブロック追加でこのブロックを壊していないか
 *    の退行防止）。
 * 2. OAI-SearchBot / GPTBot / ClaudeBot / Google-Extended / PerplexityBot の
 *    それぞれについて、`User-agent: <bot>` 行と、構文的に妥当な
 *    Allow/Disallowルールが最低1行存在する。
 * 3. `public/llms.txt` が実際にサーブされ、Content-Typeがtext系(HTMLではない)。
 * 4. llms.txt内のMarkdownリンクが指す全パスが、`src/app/` 配下の実在する
 *    Next.jsルート(page.tsx)に静的に対応している(ログイン不要、ファイルシステム
 *    照合のみ)。
 * 5. llms.txt内の全パスを起動中のdevサーバへ実際にfetchし、404が返らないことを
 *    確認する。
 *
 * 使い方: node scripts/testing/e2e/ai-crawler-llms-policy.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../../..");
const ROBOTS_PATH = resolve(REPO_ROOT, "public/robots.txt");
const LLMS_TXT_PATH = resolve(REPO_ROOT, "public/llms.txt");

const PORT = Number(process.env.TEST_PORT || 3798);

// indexing-policy.mjs のROBOTS_DISALLOW_REQUIREDと同一リスト(退行防止のため二重管理)。
const ROBOTS_DISALLOW_REQUIRED = [
  "/dashboard", "/settings", "/account/", "/review", "/pdf", "/wordbooks",
  "/weak", "/stats", "/teach", "/admin", "/share/", "/join/", "/road",
  "/referral/", "/auth/",
];

const REQUIRED_BOT_USER_AGENTS = [
  "OAI-SearchBot",
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "PerplexityBot",
];

let failed = false;
function fail(msg) {
  failed = true;
  console.error(`\n❌ FAIL: ${msg}`);
}
function ok(msg) {
  console.log(`✅ ${msg}`);
}

/**
 * robots.txtを User-agent 行区切りのブロック配列にパースする。
 * 戻り値: [{ agents: ["*"], lines: [{field, value}] }, ...]
 * 同じブロックに複数のUser-agent行が連続することも許容する(通常のrobots.txt仕様)。
 */
function parseBlocks(text) {
  const blocks = [];
  let current = null;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      // 直前のブロックがまだAllow/Disallow行を1つも受け取っていなければ
      // (=連続するUser-agent行)、同じブロックに追記する。
      if (current && current.lines.length === 0) {
        current.agents.push(value);
      } else {
        current = { agents: [value], lines: [] };
        blocks.push(current);
      }
      continue;
    }
    if (field === "sitemap") continue;
    if (!current) continue;
    current.lines.push({ field, value });
  }
  return blocks;
}

function findBlockFor(blocks, agent) {
  return blocks.find((b) => b.agents.includes(agent));
}

/** Allow/Disallowの値が構文的に妥当か("/"始まり、または空値のDisallow)。 */
function isValidRuleValue(field, value) {
  if (field !== "allow" && field !== "disallow") return true; // 対象外フィールドは無視
  if (field === "disallow" && value === "") return true; // 空Disallow="ブロックしない"は合法
  return value.startsWith("/");
}

function main() {
  return runAll();
}

async function runAll() {
  // --- 1 & 2: robots.txt の静的検証 ---
  const robotsTxt = readFileSync(ROBOTS_PATH, "utf-8");
  const blocks = parseBlocks(robotsTxt);

  console.log("=== 1. User-agent: * ブロックの既存Disallowパスが退行していない ===");
  const wildcardBlock = findBlockFor(blocks, "*");
  if (!wildcardBlock) {
    fail("robots.txtに `User-agent: *` ブロックが見つからない");
  } else {
    const disallowValues = wildcardBlock.lines
      .filter((l) => l.field === "disallow")
      .map((l) => l.value);
    for (const p of ROBOTS_DISALLOW_REQUIRED) {
      // indexing-policy.mjs の元チェックは `robotsTxt.includes("Disallow: " + p)` という
      // 素朴な部分文字列一致(例: "/teach" は "/teacher" にも一致する)。同じ緩さで
      // 判定することで、indexing-policy.mjs側と矛盾する誤検知("/teach"を厳密一致で
      // 探して見つからない、等)を避ける。
      if (disallowValues.some((v) => v === p || v.startsWith(p))) {
        ok(`User-agent: * に Disallow: ${p} が存在する`);
      } else {
        fail(`User-agent: * から Disallow: ${p} が失われている(退行の可能性)`);
      }
    }
  }

  console.log("\n=== 2. AIクローラー個別User-agentブロックの存在と構文妥当性 ===");
  for (const agent of REQUIRED_BOT_USER_AGENTS) {
    const block = findBlockFor(blocks, agent);
    if (!block) {
      fail(`robots.txtに \`User-agent: ${agent}\` ブロックが見つからない`);
      continue;
    }
    ok(`User-agent: ${agent} ブロックが存在する`);

    const ruleLines = block.lines.filter((l) => l.field === "allow" || l.field === "disallow");
    if (ruleLines.length === 0) {
      fail(`User-agent: ${agent} にAllow/Disallowルールが1つも無い`);
      continue;
    }
    let allSyntaxValid = true;
    for (const l of ruleLines) {
      if (!isValidRuleValue(l.field, l.value)) {
        allSyntaxValid = false;
        fail(`User-agent: ${agent} の \`${l.field}: ${l.value}\` が構文的に不正("/"始まりでない)`);
      }
    }
    if (allSyntaxValid) {
      ok(`User-agent: ${agent} の全ルール(${ruleLines.length}件)が構文的に妥当`);
    }
  }

  // --- 3 & 4: llms.txt の静的検証 ---
  console.log("\n=== 3. llms.txt がファイルとして存在し、Markdownリンクを含む ===");
  if (!existsSync(LLMS_TXT_PATH)) {
    fail("public/llms.txt が存在しない");
    if (failed) process.exitCode = 1;
    return;
  }
  const llmsTxt = readFileSync(LLMS_TXT_PATH, "utf-8");
  ok("public/llms.txt が存在する");

  // Markdownリンク [text](url) からURLを抽出し、loop-vocabulary.appのpathだけ残す。
  const linkRe = /\]\(([^)]+)\)/g;
  const paths = new Set();
  for (const m of llmsTxt.matchAll(linkRe)) {
    const url = m[1];
    try {
      const u = new URL(url);
      if (u.hostname !== "loop-vocabulary.app") {
        fail(`llms.txt内のリンクがloop-vocabulary.app以外を指している: ${url}`);
        continue;
      }
      paths.add(u.pathname === "" ? "/" : u.pathname);
    } catch {
      fail(`llms.txt内のリンクが絶対URLでない(相対URLは不可): ${url}`);
    }
  }
  if (paths.size === 0) {
    fail("llms.txtからMarkdownリンクを1件も抽出できなかった");
  } else {
    ok(`llms.txtから${paths.size}件のパスを抽出`);
  }

  console.log("\n=== 4. llms.txt内の各パスが src/app/ 配下の実在ルートに対応している(静的照合) ===");
  for (const p of paths) {
    const routeDir = p === "/" ? "src/app" : `src/app${p}`;
    const pageFile = resolve(REPO_ROOT, routeDir, "page.tsx");
    if (existsSync(pageFile)) {
      ok(`${p} → ${routeDir}/page.tsx が存在する`);
    } else {
      fail(`${p} に対応する ${routeDir}/page.tsx が見つからない(存在しないルートを参照している可能性)`);
    }
  }

  // --- 5: dev serverへのlive fetchで404が無いことを確認 ---
  console.log("\n=== 5. 実サーバ経由で llms.txt が配信され、text系Content-Typeであることの確認 ===");
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  try {
    const llmsRes = await fetch(`${baseUrl}/llms.txt`);
    if (llmsRes.status !== 200) {
      fail(`/llms.txt が200で取得できない (status=${llmsRes.status})`);
    } else {
      ok("/llms.txt が200で取得できる");
      const contentType = llmsRes.headers.get("content-type") || "";
      if (contentType.includes("html")) {
        fail(`/llms.txt のContent-TypeがHTML扱いになっている: ${contentType}`);
      } else {
        ok(`/llms.txt のContent-Typeがtext系: ${contentType}`);
      }
      const body = await llmsRes.text();
      if (body.includes("<html") || body.includes("<!DOCTYPE")) {
        fail("/llms.txt の本文にHTMLタグが含まれている(HTMLとして配信されている可能性)");
      } else {
        ok("/llms.txt の本文はプレーンテキスト(HTMLタグを含まない)");
      }
    }

    console.log("\n=== 6. llms.txt内の全パスが実サーバで404を返さない ===");
    for (const p of paths) {
      const res = await fetch(`${baseUrl}${p}`, { redirect: "manual" });
      if (res.status === 404) {
        fail(`${p} が実サーバで404を返した`);
      } else {
        ok(`${p}: status=${res.status} (404ではない)`);
      }
    }
  } finally {
    stopDevServer(dev);
  }

  console.log(
    failed
      ? "\n=== test:ai-crawler-llms-policy: FAILED ==="
      : "\n=== test:ai-crawler-llms-policy RESULT: all checks passed ===",
  );
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
