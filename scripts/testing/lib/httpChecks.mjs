// 公開ページ・認証ページ・APIエンドポイントのHTTP健全性チェック（fetchのみ、ブラウザ不要）

export async function checkPublicPages(baseUrl, paths) {
  const results = [];
  for (const p of paths) {
    const res = await fetch(`${baseUrl}${p}`, { redirect: "manual" });
    results.push({ path: p, status: res.status, pass: res.status === 200 });
  }
  return results;
}

export async function checkAuthRedirects(baseUrl, paths) {
  const results = [];
  for (const p of paths) {
    const res = await fetch(`${baseUrl}${p}`, { redirect: "manual" });
    // 未ログインは 307/302 で /login へ、または直接 200 でログインフォーム(SSRガードなしのclientページ)を返すことは無い設計
    const pass = res.status === 307 || res.status === 302;
    results.push({ path: p, status: res.status, pass });
  }
  return results;
}

export async function checkPostOnlyApis(baseUrl, paths) {
  const results = [];
  for (const p of paths) {
    const res = await fetch(`${baseUrl}${p}`, { method: "GET", redirect: "manual" });
    results.push({ path: p, status: res.status, pass: res.status === 405 });
  }
  return results;
}

// 特定のPOSTルートが「存在する」ことを、想定される非404ステータスで確認する
// （例: 認証必須ルートは本文なしPOSTで401、webhookルートは不正signatureで400）。
// ルート自体が存在しない場合は404になるため、それと区別できる。
export async function checkPostRoutesExpectStatus(baseUrl, specs) {
  const results = [];
  for (const { path, expect, headers = {}, body } of specs) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: body ?? "{}",
      redirect: "manual",
    });
    const pass = Array.isArray(expect) ? expect.includes(res.status) : res.status === expect;
    results.push({ path, status: res.status, pass });
  }
  return results;
}

export function printResults(label, results) {
  console.log(`\n${label}:`);
  let allPass = true;
  for (const r of results) {
    const mark = r.pass ? "✅" : "❌";
    if (!r.pass) allPass = false;
    console.log(`  ${mark} ${r.path} -> ${r.status}`);
  }
  return allPass;
}
