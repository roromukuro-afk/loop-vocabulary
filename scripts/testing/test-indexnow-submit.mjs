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

// ── 5. opts.bypassDedupe: 可視性反転・削除通知が10分デデュープで握りつぶされない ──
// (chatgpt-codex-connectorのP2指摘対応: 公開直後の非公開化・削除がdedupeされる問題)
{
  process.env.INDEXNOW_KEY = "test-key-bypass";
  const calls = installFetchStub(async () => new Response(null, { status: 200 }));
  const { submitUrlsToIndexNow } = await import(
    `../../src/lib/indexnow/submit.ts?t=${Date.now()}-5`
  );
  const url = "https://loop-vocabulary.app/materials/test-bypass";

  // 5a. 公開(通常送信) → 直後に非公開化(bypassDedupe:true)。10分以内の同一URLだが
  //     可視性の反転(消えたこと)は必ず届く必要がある。
  const published = await submitUrlsToIndexNow([url]);
  assert(published.ok === true && calls.length === 1, "公開時の通常送信でfetchが呼ばれる", `ok=${published.ok} calls=${calls.length}`);

  const unpublished = await submitUrlsToIndexNow([url], { bypassDedupe: true });
  assert(calls.length === 2 && unpublished.ok === true, "公開後10分以内の非公開化(bypassDedupe:true)は通常デデュープを無視して送信される", `calls=${calls.length} ok=${unpublished.ok}`);

  // 5b. 非公開化(5aで送信済み)の直後に再公開(bypassDedupe:true)。これも反転なので届く必要がある。
  const republished = await submitUrlsToIndexNow([url], { bypassDedupe: true });
  assert(calls.length === 3 && republished.ok === true, "非公開化後10分以内の再公開(bypassDedupe:true)も送信される", `calls=${calls.length} ok=${republished.ok}`);

  // 5c. bypassDedupeで送信した後も、lastSubmittedAtは通常どおり更新される。
  //     そのため直後の"通常"呼び出し(bypassDedupeなし)は改めてデデュープされる
  //     (bypassDedupeは「その1回を強制送信する」フラグであり、以後の通常呼び出しの
  //     デデュープ状態自体をリセットするものではない)。
  const normalAfterBypass = await submitUrlsToIndexNow([url]);
  assert(calls.length === 3 && normalAfterBypass.ok === false, "bypassDedupe送信直後の通常呼び出しは改めてデデュープされる(通常の同一内容更新の連投を抑止する設計は維持)", `calls=${calls.length} ok=${normalAfterBypass.ok}`);

  // 5d. 削除通知も同じ仕組み(bypassDedupe:true)で届く。
  const deleted = await submitUrlsToIndexNow([url], { bypassDedupe: true });
  assert(calls.length === 4 && deleted.ok === true, "削除通知(bypassDedupe:true)も10分以内の同一URLへ送信される", `calls=${calls.length} ok=${deleted.ok}`);
}

// ── 5e. 複数URLのデデュープが互いに干渉しない ──────────────────
{
  process.env.INDEXNOW_KEY = "test-key-bypass-multi";
  const calls = installFetchStub(async () => new Response(null, { status: 200 }));
  const { submitUrlsToIndexNow } = await import(
    `../../src/lib/indexnow/submit.ts?t=${Date.now()}-5e`
  );
  const urlA = "https://loop-vocabulary.app/materials/test-a";
  const urlB = "https://loop-vocabulary.app/materials/test-b";

  await submitUrlsToIndexNow([urlA]);
  await submitUrlsToIndexNow([urlB]);
  assert(calls.length === 2, "URL A・Bをそれぞれ独立に送信できる", `calls=${calls.length}`);

  // Aはbypassで再送信、Bは通常送信(直後のためデデュープされるはず)。互いの状態は干渉しない。
  const aBypassed = await submitUrlsToIndexNow([urlA], { bypassDedupe: true });
  const bNormal = await submitUrlsToIndexNow([urlB]);
  assert(calls.length === 3 && aBypassed.ok === true, "Aのbypass送信はBのデデュープ状態に影響しない", `calls=${calls.length} aOk=${aBypassed.ok}`);
  assert(bNormal.ok === false, "Bは直近送信済みのため通常呼び出しでは引き続きデデュープされる(Aのbypassの影響を受けない)", JSON.stringify(bNormal));
}

// ── 5f. IndexNow送信失敗はsubmitUrlsToIndexNow自体の契約(常にthrowしない)の範囲内であり、
//        呼び出し元(APIルート)のDB更新結果に影響しないことは、after()経由で
//        レスポンス送信後にのみ呼び出す設計(src/lib/indexnow/notifyContentChange.ts)と、
//        上記3.のネットワーク失敗・3b.の非2xx・3c.のタイムアウトいずれもthrowしないことの
//        組み合わせで既に保証されている(改めての専用テストは不要)。

console.log(fail === 0 ? "\n=== test:indexnow-submit: ALL CHECKS PASSED ===" : "\n=== test:indexnow-submit: FAILED ===");
process.exit(fail === 0 ? 0 : 1);
