/**
 * src/lib/indexnow/submit.ts の単体テスト(ブラウザ・サーバー・実ネットワーク不要)。
 *
 * global.fetch をスタブして、以下を検証する:
 *  1. INDEXNOW_KEY 未設定時は fetch を呼ばずno-opで {ok:false, error:"not configured"} を返す
 *  2. 設定済み時、IndexNowのバッチエンドポイントへ正しいペイロード形状({host, key, keyLocation, urlList})でPOSTする
 *  3. fetch が reject (ネットワーク失敗) してもthrowせず {ok:false, error} を返す
 *  4. 同一URLを10分以内に再送信しようとするとfetchを呼ばずスキップする(デデュープ)
 *
 * 使い方: node scripts/testing/test-indexnow-submit.mjs
 */
process.env.NEXT_PUBLIC_SITE_URL = "https://loop-vocabulary.app";

let pass = 0;
let fail = 0;

function assert(cond, label, detail) {
  if (cond) {
    pass++;
    console.log(`✅ ${label}`);
  } else {
    fail++;
    console.error(`❌ FAIL: ${label}${detail ? `\n   ${detail}` : ""}`);
  }
}

function installFetchStub(impl) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return impl(url, init);
  };
  return calls;
}

// ── 1. INDEXNOW_KEY 未設定時はno-op ─────────────────────────
{
  delete process.env.INDEXNOW_KEY;
  const calls = installFetchStub(() => {
    throw new Error("fetch should not have been called when INDEXNOW_KEY is unset");
  });
  const { submitUrlsToIndexNow } = await import(
    `../../src/lib/indexnow/submit.ts?t=${Date.now()}-1`
  );
  const result = await submitUrlsToIndexNow(["https://loop-vocabulary.app/about"]);
  assert(result.ok === false && result.error === "not configured", "INDEXNOW_KEY未設定時はok:false, error:'not configured'を返す", JSON.stringify(result));
  assert(calls.length === 0, "INDEXNOW_KEY未設定時はfetchを一切呼ばない", `calls=${calls.length}`);
}

// ── 2. 正しいペイロード形状でPOSTする ────────────────────────
{
  process.env.INDEXNOW_KEY = "test-key-1234567890";
  const calls = installFetchStub(async () => new Response(null, { status: 200 }));
  const { submitUrlsToIndexNow } = await import(
    `../../src/lib/indexnow/submit.ts?t=${Date.now()}-2`
  );
  const urls = ["https://loop-vocabulary.app/about", "https://loop-vocabulary.app/dictionary"];
  const result = await submitUrlsToIndexNow(urls);

  assert(calls.length === 1, "1回のfetch呼び出しになる", `calls=${calls.length}`);
  const call = calls[0];
  assert(call.url === "https://api.indexnow.org/indexnow", "正しいIndexNowバッチエンドポイントへPOSTする", call.url);
  assert(call.init?.method === "POST", "HTTPメソッドはPOST", call.init?.method);

  const body = JSON.parse(call.init?.body ?? "{}");
  assert(body.host === "loop-vocabulary.app", "bodyのhostはprotocol無しのドメインのみ", body.host);
  assert(body.key === "test-key-1234567890", "bodyのkeyはINDEXNOW_KEYと一致する", body.key);
  assert(
    body.keyLocation === "https://loop-vocabulary.app/test-key-1234567890.txt",
    "bodyのkeyLocationは https://<site>/<key>.txt になる",
    body.keyLocation
  );
  assert(
    JSON.stringify(body.urlList) === JSON.stringify(urls),
    "bodyのurlListは渡したurls配列と一致する",
    JSON.stringify(body.urlList)
  );
  assert(result.ok === true && result.status === 200, "成功時はok:true, status:200を返す", JSON.stringify(result));
}

// ── 3. fetchがrejectしてもthrowしない ────────────────────────
{
  process.env.INDEXNOW_KEY = "test-key-network-fail";
  installFetchStub(async () => {
    throw new Error("simulated network failure");
  });
  const { submitUrlsToIndexNow } = await import(
    `../../src/lib/indexnow/submit.ts?t=${Date.now()}-3`
  );
  let threw = false;
  let result;
  try {
    result = await submitUrlsToIndexNow(["https://loop-vocabulary.app/faq"]);
  } catch {
    threw = true;
  }
  assert(threw === false, "fetchがネットワークエラーでrejectしてもthrowしない");
  assert(result?.ok === false && typeof result?.error === "string", "ネットワーク失敗時はok:falseとerror文字列を返す", JSON.stringify(result));
}

// ── 3b. 非2xxレスポンスでもthrowせずok:falseを返す ─────────────
{
  process.env.INDEXNOW_KEY = "test-key-bad-status";
  installFetchStub(async () => new Response("bad request detail", { status: 400 }));
  const { submitUrlsToIndexNow } = await import(
    `../../src/lib/indexnow/submit.ts?t=${Date.now()}-3b`
  );
  const result = await submitUrlsToIndexNow(["https://loop-vocabulary.app/faq"]);
  assert(result.ok === false && result.status === 400, "非2xxレスポンス時はok:false, statusにそのままのコードを返す", JSON.stringify(result));
}

// ── 3c. リクエストがstall(応答が返らない)した場合、AbortSignalでタイムアウトしthrowしない ──
{
  process.env.INDEXNOW_KEY = "test-key-timeout";
  installFetchStub(async (_url, init) => {
    // 実際の10秒待機はテストを遅くするため、init.signalがAbortSignal.timeout()由来である
    // ことだけ確認し、その場でタイムアウト時と同じ形のDOMException("TimeoutError")を投げて
    // submit.ts側のタイムアウト検知ロジック(err.name === "TimeoutError")を検証する。
    assert(init?.signal instanceof AbortSignal, "fetchにAbortSignalが渡される(タイムアウト用)");
    throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
  });
  const { submitUrlsToIndexNow } = await import(
    `../../src/lib/indexnow/submit.ts?t=${Date.now()}-3c`
  );
  let threw = false;
  let result;
  try {
    result = await submitUrlsToIndexNow(["https://loop-vocabulary.app/about"]);
  } catch {
    threw = true;
  }
  assert(threw === false, "リクエストがタイムアウトしてもthrowしない");
  assert(result?.ok === false && typeof result?.error === "string" && result.error.includes("timed out"), "タイムアウト時はok:falseとタイムアウトを示すerrorを返す", JSON.stringify(result));
}

// ── 4. 同一URLの10分以内の再送信はスキップする(デデュープ) ────
{
  process.env.INDEXNOW_KEY = "test-key-dedupe";
  const calls = installFetchStub(async () => new Response(null, { status: 202 }));
  // このimportで得たモジュールインスタンス内のlastSubmittedAt Mapを2回とも使う
  const { submitUrlsToIndexNow } = await import(
    `../../src/lib/indexnow/submit.ts?t=${Date.now()}-4`
  );
  const url = "https://loop-vocabulary.app/premium";

  const first = await submitUrlsToIndexNow([url]);
  assert(first.ok === true && calls.length === 1, "1回目の送信は実際にfetchを呼ぶ", `ok=${first.ok} calls=${calls.length}`);

  const second = await submitUrlsToIndexNow([url]);
  assert(calls.length === 1, "直後の同一URL再送信はfetchを追加で呼ばない(デデュープ)", `calls=${calls.length}`);
  assert(second.ok === false && second.error === "all urls recently submitted", "デデュープでスキップされた場合はok:falseで理由を返す", JSON.stringify(second));

  const mixed = await submitUrlsToIndexNow([url, "https://loop-vocabulary.app/terms"]);
  assert(calls.length === 2, "デデュープ対象外の新規URLが混ざっていればfetchは呼ばれる", `calls=${calls.length}`);
  const mixedBody = JSON.parse(calls[1].init.body);
  assert(
    JSON.stringify(mixedBody.urlList) === JSON.stringify(["https://loop-vocabulary.app/terms"]),
    "混在送信時、直近送信済みのURLはurlListから除外される",
    JSON.stringify(mixedBody.urlList)
  );
  assert(mixed.skippedCount === 1, "スキップ件数が結果に反映される", JSON.stringify(mixed));
}

console.log(fail === 0 ? "\n=== test:indexnow-submit: ALL CHECKS PASSED ===" : "\n=== test:indexnow-submit: FAILED ===");
process.exit(fail === 0 ? 0 : 1);
