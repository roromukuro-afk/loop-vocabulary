import assert from "node:assert/strict";
import { buildSocialLink, parseArgs } from "../growth/social-link.mjs";

let failed = false;
function ok(msg) {
  console.log(`✅ ${msg}`);
}
function fail(msg, err) {
  failed = true;
  console.error(`❌ FAIL: ${msg}`);
  if (err) console.error(err);
}

function test(name, fn) {
  try {
    fn();
    ok(name);
  } catch (err) {
    fail(name, err);
  }
}

test("buildSocialLink: 正しいUTMパラメータでURLを組み立てる", () => {
  const result = buildSocialLink({
    source: "x",
    campaign: "vocab-test-maker",
    content: "quiz-001",
    path: "/tools/vocab-test-maker",
  });
  assert.equal(
    result.fullUrl,
    "https://loop-vocabulary.app/tools/vocab-test-maker?utm_source=x&utm_medium=social&utm_campaign=vocab-test-maker&utm_content=quiz-001",
  );
  assert.equal(result.medium, "social");
});

test("buildSocialLink: --medium を明示的に指定すると上書きされる", () => {
  const result = buildSocialLink({
    source: "instagram",
    campaign: "vocab_test_maker_launch",
    content: "ig_feed_launch",
    path: "/tools/vocab-test-maker",
    medium: "story",
  });
  assert.match(result.fullUrl, /utm_medium=story/);
});

test("buildSocialLink: source欠落は分かりやすいエラーを投げる", () => {
  assert.throws(
    () => buildSocialLink({ campaign: "c", content: "x", path: "/p" }),
    /source/,
  );
});

test("buildSocialLink: campaign/content/path が複数欠落していれば全て列挙する", () => {
  assert.throws(() => buildSocialLink({ source: "x" }), /campaign.*content.*path|campaign, content, path/);
});

test("buildSocialLink: 絶対URLをpathに渡すと拒否される(オープンリダイレクト対策)", () => {
  assert.throws(
    () => buildSocialLink({ source: "x", campaign: "c", content: "x", path: "https://evil.example.com" }),
    /相対パス/,
  );
});

test("buildSocialLink: プロトコル相対URL(//host)も拒否される", () => {
  assert.throws(
    () => buildSocialLink({ source: "x", campaign: "c", content: "x", path: "//evil.example.com" }),
    /相対パス/,
  );
});

test("buildSocialLink: バックスラッシュによるorigin書き換え(WHATWG URLパーサのバイパス)も拒否される", () => {
  // "/\evil.example/x" は先頭1文字は"/"だが、new URL()がバックスラッシュを"/"と
  // 同等に扱うため https://evil.example/x に解決されてしまう(Codexレビュー指摘)。
  assert.throws(
    () => buildSocialLink({ source: "x", campaign: "c", content: "x", path: "/\\evil.example/x" }),
    /origin/,
  );
});

test("buildSocialLink: source/campaign/content/mediumの大文字小文字は自動的に統一される(表記ゆれ防止、Codexレビュー指摘対応)", () => {
  const result = buildSocialLink({
    source: "X",
    campaign: "Vocab_Test-Maker",
    content: "Quiz-001",
    path: "/tools/vocab-test-maker",
    medium: "Social",
  });
  assert.equal(result.source, "x");
  assert.equal(result.campaign, "vocab_test-maker");
  assert.equal(result.content, "quiz-001");
  assert.equal(result.medium, "social");
  const url = new URL(result.fullUrl);
  assert.equal(url.searchParams.get("utm_source"), "x");
  assert.equal(url.searchParams.get("utm_medium"), "social");
});

test("buildSocialLink: campaign/contentに空白等の非許容文字が含まれると拒否される(表記ゆれ防止、Codexレビュー指摘対応)", () => {
  assert.throws(
    () => buildSocialLink({ source: "x", campaign: "c a mp", content: "id1", path: "/tools/vocab-test-maker" }),
    /campaign/,
  );
  assert.throws(
    () => buildSocialLink({ source: "x", campaign: "camp", content: "id&1", path: "/tools/vocab-test-maker" }),
    /content/,
  );
});

test("parseArgs: --key=value形式を正しくパースする", () => {
  const args = parseArgs(["--source=x", "--campaign=vocab-test-maker", "--path=/tools/vocab-test-maker"]);
  assert.deepEqual(args, { source: "x", campaign: "vocab-test-maker", path: "/tools/vocab-test-maker" });
});

test("parseArgs: --key=value形式でない引数は無視する", () => {
  const args = parseArgs(["--source=x", "notanoption"]);
  assert.deepEqual(args, { source: "x" });
});

if (failed) {
  console.error("\n=== 失敗したチェックがあります ===");
  process.exitCode = 1;
} else {
  console.log("\n=== test:growth-social-link RESULT: all checks passed ===");
}
