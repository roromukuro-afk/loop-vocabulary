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
    campaign: "vocab_test_maker",
    content: "quiz_001",
    path: "/tools/vocab-test-maker",
  });
  assert.equal(
    result.fullUrl,
    "https://loop-vocabulary.app/tools/vocab-test-maker?utm_source=x&utm_medium=social&utm_campaign=vocab_test_maker&utm_content=quiz_001",
  );
  assert.equal(result.medium, "social");
});

test("buildSocialLink: mediumは常に社会的流入(social)へ固定され、呼び出し側からの上書きは無視される(Codexレビュー指摘対応、2巡目)", () => {
  // classifySocialBucket()はmedium==="social"の厳密一致でしかsocial流入と判定しない
  // ため、このヘルパーが生成するリンクは常にmedium=socialでなければならない。
  // 呼び出し側が--medium的な値を渡そうとしても(意図しない誤用を防ぐため)無視される。
  const result = buildSocialLink({
    source: "instagram",
    campaign: "vocab_test_maker_launch",
    content: "ig_story_launch",
    path: "/tools/vocab-test-maker",
    medium: "story",
  });
  assert.equal(result.medium, "social");
  assert.match(result.fullUrl, /utm_medium=social/);
  assert.doesNotMatch(result.fullUrl, /utm_medium=story/);
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

test("buildSocialLink: source/campaign/contentの大文字小文字は自動的に統一される(表記ゆれ防止、Codexレビュー指摘対応)", () => {
  const result = buildSocialLink({
    source: "X",
    campaign: "Vocab_Test_Maker",
    content: "Quiz_001",
    path: "/tools/vocab-test-maker",
  });
  assert.equal(result.source, "x");
  assert.equal(result.campaign, "vocab_test_maker");
  assert.equal(result.content, "quiz_001");
  const url = new URL(result.fullUrl);
  assert.equal(url.searchParams.get("utm_source"), "x");
  assert.equal(url.searchParams.get("utm_medium"), "social");
});

test("buildSocialLink: ハイフンとアンダースコアは同一の識別子として正規化される(区切り文字違いによる集計分裂の防止、Codexレビュー指摘対応、2巡目)", () => {
  const withHyphens = buildSocialLink({
    source: "x",
    campaign: "vocab-test-maker",
    content: "quiz-001",
    path: "/tools/vocab-test-maker",
  });
  const withUnderscores = buildSocialLink({
    source: "x",
    campaign: "vocab_test_maker",
    content: "quiz_001",
    path: "/tools/vocab-test-maker",
  });
  assert.equal(withHyphens.campaign, withUnderscores.campaign);
  assert.equal(withHyphens.content, withUnderscores.content);
  assert.equal(withHyphens.fullUrl, withUnderscores.fullUrl);
});

test("buildSocialLink: 正規化後100文字を超える識別子は拒否される(track.tsの記録時切り詰めとの不一致防止、Codexレビュー指摘対応、3巡目)", () => {
  const ok100 = "a".repeat(100);
  const tooLong101 = "a".repeat(101);
  // ちょうど100文字は許可される(track.tsの.slice(0, 100)と一致する境界)。
  const result = buildSocialLink({ source: "x", campaign: ok100, content: "c", path: "/tools/vocab-test-maker" });
  assert.equal(result.campaign, ok100);
  assert.throws(
    () => buildSocialLink({ source: "x", campaign: tooLong101, content: "c", path: "/tools/vocab-test-maker" }),
    /100文字以内/,
  );
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
