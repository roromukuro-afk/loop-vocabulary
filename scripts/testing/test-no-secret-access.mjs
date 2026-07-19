/**
 * Loop Autonomous Improvement System: secretへのアクセス・漏洩防止の検証。
 * - scanForSecrets()がAPIキー・秘密鍵らしき文字列を正しく検出する
 * - .env/.env.local/SUPABASE_SERVICE_ROLE_KEY等がforbiddenPathPatternsに含まれる
 * - scripts/improvement配下のconsole.log/console.errorが、SUPABASE_SERVICE_ROLE_KEY等の
 *   secret変数名を含む値をそのまま出力していない(エラーメッセージは常にtruncate・secretは
 *   ログに残さない、という設計がソースコード上でも守られていることの静的監査)
 * - pull_requestトリガーのpr-quality-gate.ymlがsecretsを一切参照しない(test:independent-pr-ciと
 *   重複しない別角度として、run:ステップにecho経由のsecrets漏洩が無いかも確認する)
 *
 * 使い方: node scripts/testing/test-no-secret-access.mjs
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { REPO_ROOT } from "./lib/env.mjs";
import { scanForSecrets, FORBIDDEN } from "../improvement/safety-checks.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function walk(dir, exts, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

function main() {
  const secretSamples = [
    "sk-abcdefghijklmnopqrstuvwx",
    "AKIAABCDEFGHIJKLMNOP",
    '-----BEGIN RSA PRIVATE KEY-----',
    'SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."',
  ];
  if (secretSamples.every((s) => scanForSecrets(s) !== null)) ok("scanForSecrets()はAPIキー/AWSキー/秘密鍵ヘッダ/SUPABASE_SERVICE_ROLE_KEY代入を全て検出する");
  else fail("scanForSecrets()が既知のsecretパターンを検出できていない");

  if (scanForSecrets("this is a normal commit message about fixing a bug") === null) ok("通常のテキストは誤検出しない");
  else fail("通常のテキストをsecretと誤検出してしまった");

  for (const p of [".env", "src/lib/supabase/admin.ts"]) {
    if (FORBIDDEN.forbiddenPathPatterns.includes(p)) ok(`forbiddenPathPatternsに"${p}"が含まれ、自動実装から読み書き対象外になっている`);
    else fail(`forbiddenPathPatternsに"${p}"が含まれていない`);
  }

  // console.log/console.error に secret変数名を直接埋め込んでいないかの静的監査
  const targets = walk(resolve(REPO_ROOT, "scripts/improvement"), [".mjs"]);
  const dangerousLogPattern = /console\.(log|error|warn)\([^)]*SUPABASE_SERVICE_ROLE_KEY[^)]*\)/;
  let anyLeak = false;
  for (const file of targets) {
    const content = readFileSync(file, "utf8");
    if (dangerousLogPattern.test(content)) {
      fail(`${file.replace(REPO_ROOT, "")} がSUPABASE_SERVICE_ROLE_KEYをconsole.log等へ直接出力している`);
      anyLeak = true;
    }
  }
  if (!anyLeak) ok(`scripts/improvement配下(計${targets.length}ファイル)にSUPABASE_SERVICE_ROLE_KEYを直接ログ出力するコードは無い`);

  // pull_requestトリガーのworkflow(pr-quality-gate.yml)がecho経由でもsecretsを漏らしていないか
  const gateYml = readFileSync(resolve(REPO_ROOT, ".github/workflows/pr-quality-gate.yml"), "utf8");
  if (!/secrets\./.test(gateYml)) ok("pull_requestトリガーのpr-quality-gate.ymlはsecretsを一切参照しない(echoによる間接漏洩の経路自体が存在しない)");
  else fail("pr-quality-gate.ymlがsecretsを参照している");

  console.log(failed ? `\n=== test:no-secret-access: ${failed}件失敗 ===` : "\n=== test:no-secret-access RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
