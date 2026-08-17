/**
 * signup/login の `?next=` open redirect / javascript: スキーム注入対策の
 * regression test(Codexレビュー指摘P1対応)。
 *
 * 使い方: node scripts/testing/test-safe-next-path.mjs
 */
import { getSafeNextPath } from "../../src/lib/utils/safeNextPath.ts";

let pass = 0, fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function main() {
  const ALLOW = [
    "/tools/vocab-test-maker",
    "/wordbooks?id=123",
    "/dashboard",
    "/",
  ];
  for (const v of ALLOW) {
    const result = getSafeNextPath(v);
    if (result === v) ok(`許可されるべき値が通る: ${JSON.stringify(v)} → ${JSON.stringify(result)}`);
    else bad(`許可されるべき値が拒否された: ${JSON.stringify(v)} → ${JSON.stringify(result)}`);
  }

  const REJECT = [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "//evil.example",
    "//evil.example/path",
    "https://evil.example",
    "http://evil.example",
    "/\\evil.example",
    "/\\/evil.example",
    "\\/evil.example",
    " /dashboard",
    "/dashboard ",
    "/dashboard\n",
    "/foo\x00bar",
    "/foo\tbar",
    "data:text/html,<script>alert(1)</script>",
    "evil.example",
  ];
  for (const v of REJECT) {
    const result = getSafeNextPath(v, "/dashboard");
    if (result === "/dashboard") ok(`拒否されるべき値がfallbackになる: ${JSON.stringify(v)}`);
    else bad(`拒否されるべき値が許可されてしまった(open redirect risk): ${JSON.stringify(v)} → ${JSON.stringify(result)}`);
  }

  // empty/null/undefined
  for (const v of [null, undefined, ""]) {
    const result = getSafeNextPath(v, "/dashboard");
    if (result === "/dashboard") ok(`空値は既定のfallbackになる: ${JSON.stringify(v)}`);
    else bad(`空値の処理が想定外: ${JSON.stringify(v)} → ${JSON.stringify(result)}`);
  }

  // fallback引数のカスタム値も機能する
  {
    const result = getSafeNextPath("javascript:alert(1)", "/tools/vocab-test-maker");
    if (result === "/tools/vocab-test-maker") ok("カスタムfallback値が使われる");
    else bad(`カスタムfallback値が使われていない: ${result}`);
  }

  console.log(`\n=== test:safe-next-path RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
