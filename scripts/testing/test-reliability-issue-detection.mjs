/**
 * Loop Autonomous Improvement System: scanReliability()の検証。
 * 本番の主要エンドポイントは現状すべて正常なため、まず「誤検知しないこと」を確認し、
 * さらにfetchをモックして意図的な500応答を注入し、正しくcritical issueとして
 * 検出されることを確認する。
 *
 * 使い方: node scripts/testing/test-reliability-issue-detection.mjs
 */
import { scanReliability } from "../../src/lib/improvement/analyzers/reliability.ts";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

async function main() {
  const admin = getAdminClient();

  console.log("--- 1. 本番の主要エンドポイントに対する誤検知が無いこと ---");
  const liveCandidates = await scanReliability(admin);
  const falsePositiveEndpointIssues = liveCandidates.filter((c) => c.dedupTarget.startsWith("endpoint_error_"));
  if (falsePositiveEndpointIssues.length === 0) {
    ok("主要エンドポイント(/, /sitemap.xml, /robots.txt, /ads.txt, /dictionary, /vocab-check)はいずれも異常なし");
  } else {
    fail(`本番エンドポイントで異常が検出された(誤検知の可能性、または実際の障害): ${JSON.stringify(falsePositiveEndpointIssues.map((c) => c.evidence))}`);
  }

  console.log("\n--- 2. fetchをモックして意図的な500応答を注入し、critical issueとして検出されることを確認 ---");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.endsWith("/dictionary")) {
      return new Response(null, { status: 500 });
    }
    return originalFetch(url, opts);
  };
  try {
    const mockedCandidates = await scanReliability(admin);
    const injected = mockedCandidates.find((c) => c.dedupTarget === "endpoint_error_/dictionary");
    if (injected && injected.severity === "critical") {
      ok("500応答を注入した/dictionaryがcritical severityのissueとして検出される");
    } else {
      fail(`注入した500応答が検出されなかった: ${JSON.stringify(mockedCandidates.map((c) => c.dedupTarget))}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log(failed ? `\n=== test:reliability-issue-detection: ${failed}件失敗 ===` : "\n=== test:reliability-issue-detection RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test-reliability-issue-detection crashed:", e);
  process.exit(1);
});
