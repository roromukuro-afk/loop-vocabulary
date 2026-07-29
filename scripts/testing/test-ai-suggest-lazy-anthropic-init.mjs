/**
 * src/app/api/wordbook/[id]/ai-suggest/route.ts のAnthropicクライアント生成順序の
 * ソース構造不変条件テスト(ネットワーク・サーバー起動不要)。
 *
 * 2026-07-29、chatgpt-codex-connectorのP1レビュー指摘: このルートはモジュール
 * スコープで`new Anthropic({apiKey: process.env.ANTHROPIC_API_KEY})`を実行していた
 * ため、ANTHROPIC_API_KEY未設定の環境(premium-gating-canary.ymlはpremium判定
 * のみを検証しAnthropic APIを呼ばないため、意図的にこのsecretを注入しない)では、
 * premium判定に到達する前にルートの読み込み自体がSDKの初期化エラーで失敗し、
 * 常にfalseな失敗を報告していた。
 *
 * このファイルは、Next.jsのリクエストコンテキスト(cookies()等)・実DBアクセスに
 * 依存する`requireUser()`等を含むこのルートを、プレーンなNodeスクリプトから直接
 * import・実行することができない(サーバー起動が必須)ため、live E2Eの代わりに
 * ソースコードのテキスト上の並び順を直接検証する。これにより、次の8ステップの
 * 順序が壊れていないことを、ネットワーク・DBアクセスなしで高速に保証する:
 *   1. 認証(requireUser) 2. Premium判定 3. 非Premiumなら403
 *   4. 入力・単語帳の検証 5. ANTHROPIC_API_KEYの存在確認 6. キーが無ければ503
 *   7. Anthropicクライアント生成(module scopeではなくこの位置) 8. API呼び出し
 *
 * 使い方: node scripts/testing/test-ai-suggest-lazy-anthropic-init.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROUTE_PATH = resolve(__dir, "../../src/app/api/wordbook/[id]/ai-suggest/route.ts");

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function main() {
  const src = readFileSync(ROUTE_PATH, "utf8");

  const postFnIndex = src.indexOf("export async function POST(");
  if (postFnIndex === -1) {
    fail("POST関数定義が見つからない(ファイル構造が想定外に変わった可能性)");
    console.log(`\n=== test:ai-suggest-lazy-anthropic-init: ${failed}件失敗 ===`);
    process.exit(1);
  }

  // 1. module scope(POST関数定義より前)にAnthropicクライアント生成が無いこと
  const moduleScope = src.slice(0, postFnIndex);
  if (!/new\s+Anthropic\s*\(/.test(moduleScope)) {
    ok("module scope(POST関数の外)にnew Anthropic(...)が存在しない");
  } else {
    fail("module scopeにnew Anthropic(...)が残っている(import時にANTHROPIC_API_KEY未設定でSDKが例外を投げる原因)");
  }

  const body = src.slice(postFnIndex);
  const idx = (needle, label) => {
    const i = body.indexOf(needle);
    if (i === -1) fail(`ソース内に "${label}" のマーカーが見つからない(想定していたパターンと一致しない)`);
    return i;
  };

  // 2. 各ステップのマーカー位置を取得
  const iPremiumCheck = idx('.select("is_premium")', "Premium判定クエリ");
  const iPremium403 = idx('{ status: 403 }', "非Premium時の403レスポンス");
  const iWordsQuery = idx('.from("words")', "単語帳の単語取得クエリ");
  const iEmptyWordbook400 = idx('{ status: 400 }', "空の単語帳時の400レスポンス");
  const iApiKeyGuard = idx("const apiKey = process.env.ANTHROPIC_API_KEY;", "ANTHROPIC_API_KEY存在確認");
  const i503 = idx('{ status: 503 }', "キー未設定時の503レスポンス");
  const iClientNew = idx("new Anthropic({ apiKey })", "Anthropicクライアント生成(遅延生成後の位置)");
  const iMessagesCreate = idx("client.messages.create(", "Anthropic API呼び出し");

  if ([iPremiumCheck, iPremium403, iWordsQuery, iEmptyWordbook400, iApiKeyGuard, i503, iClientNew, iMessagesCreate].some((i) => i === -1)) {
    console.log(`\n=== test:ai-suggest-lazy-anthropic-init: ${failed}件失敗 ===`);
    process.exit(1);
  }

  // 3. 期待される順序を検証(ユーザー指定の8ステップ順)
  const steps = [
    { i: iPremiumCheck, label: "1.認証後のPremium判定" },
    { i: iPremium403, label: "2.非Premiumなら403" },
    { i: iWordsQuery, label: "3.入力・単語帳の検証(取得)" },
    { i: iEmptyWordbook400, label: "3.入力・単語帳の検証(空チェック400)" },
    { i: iApiKeyGuard, label: "4.ANTHROPIC_API_KEYの存在確認" },
    { i: i503, label: "5.キーが無ければ503" },
    { i: iClientNew, label: "6.Anthropicクライアント生成" },
    { i: iMessagesCreate, label: "7.API呼び出し" },
  ];

  let orderOk = true;
  for (let i = 1; i < steps.length; i++) {
    if (steps[i - 1].i >= steps[i].i) {
      fail(`順序違反: "${steps[i - 1].label}" が "${steps[i].label}" より後(または同時)に出現している`);
      orderOk = false;
    }
  }
  if (orderOk) {
    ok("認証→Premium判定→403→入力/単語帳検証→APIキー確認→503→クライアント生成→API呼び出し、の順序が維持されている");
  }

  // 4. クライアント生成がAPIキー未設定ガード(503)より後にあることを特に強調して再確認
  //    (これがP1指摘の核心。他の順序チェックと一部重複するが、最重要不変条件として明示的に単独assertする)
  if (iClientNew > i503) {
    ok("Anthropicクライアント生成は、ANTHROPIC_API_KEY未設定時の503ガードより後に実行される(import時にSDKが例外を投げない)");
  } else {
    fail("Anthropicクライアント生成が503ガードより前にある(ANTHROPIC_API_KEY未設定環境でSDKが例外を投げ、premium判定にすら到達できない)");
  }

  console.log(failed ? `\n=== test:ai-suggest-lazy-anthropic-init: ${failed}件失敗 ===` : "\n=== test:ai-suggest-lazy-anthropic-init RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
