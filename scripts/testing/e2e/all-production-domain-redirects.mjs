/**
 * 全Production Vercelエイリアスからカスタムドメインへの恒久リダイレクト 自律検証。
 *
 * 背景(2026-07-15): Search ConsoleでGoogle-selected canonicalがVercelドメイン
 * (`loop-vocabulary.app.vercel.app`)を指していると報告された。調査の結果、
 * `loop-vocabulary.app.vercel.app` はVercelのエッジIPには到達するがTLS証明書が
 * 存在せずどのプロジェクトにも紐づいていない(アプリ側で対処不能・Search Console側の
 * 古い記録の可能性)一方、実際にVercelプロジェクトのProduction Domainsに紐づく
 * vercel.app系エイリアスは以下の3つと判明した:
 *   - loop-vocabulary.vercel.app (既存のtest:canonical-domain-redirectが検証済み)
 *   - loop-vocabulary-roromukuro-5711s-projects.vercel.app
 *   - loop-vocabulary-git-main-roromukuro-5711s-projects.vercel.app
 * 後者2つは現状Vercel Authenticationで未認証アクセスがブロックされているため
 * 重複コンテンツリスクは無いが、保護設定が外れた場合の多層防御としてnext.config.jsの
 * redirects()に追加した。
 *
 * fetch()はHostヘッダーを設定できない(forbidden header)ため、Node組み込みの
 * httpモジュールでHostヘッダーを偽装してローカルdevServerへリクエストする
 * (test:canonical-domain-redirectと同じ手法)。
 *
 * 検証項目:
 * 1. 3つのProduction vercel.appエイリアスすべてが / で308/301リダイレクトする
 * 2. パス・クエリ文字列が維持される
 * 3. per-deployment(ハッシュ付き)プレビューURL相当のHostは完全一致しないためリダイレクトされない
 * 4. カスタムドメイン・localhostではリダイレクトが発生しない(ループ防止)
 *
 * 使い方: node scripts/testing/e2e/all-production-domain-redirects.mjs
 */
import http from "node:http";
import { loadEnv } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const CUSTOM_DOMAIN = "https://loop-vocabulary.app";
const PRODUCTION_VERCEL_HOSTS = [
  "loop-vocabulary.vercel.app",
  "loop-vocabulary-roromukuro-5711s-projects.vercel.app",
  "loop-vocabulary-git-main-roromukuro-5711s-projects.vercel.app",
];

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function rawRequest(path, hostHeader) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "localhost", port: PORT, path, method: "GET", headers: { Host: hostHeader } },
      (res) => {
        res.resume();
        resolve({ status: res.statusCode, location: res.headers.location ?? null });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  loadEnv();
  const dev = await ensureDevServer(PORT);

  try {
    for (const host of PRODUCTION_VERCEL_HOSTS) {
      const root = await rawRequest("/", host);
      if (root.status === 308 || root.status === 301) ok(`${host} の / が ${root.status} でリダイレクトされる`);
      else bad(`${host} の / が恒久リダイレクトされない: status=${root.status}`);

      if (root.location === CUSTOM_DOMAIN) ok(`${host} のリダイレクト先が正しい (${root.location})`);
      else bad(`${host} のリダイレクト先が不正: ${root.location}`);

      const withPathAndQuery = await rawRequest("/dictionary/analyze?utm_source=test", host);
      if (withPathAndQuery.location === `${CUSTOM_DOMAIN}/dictionary/analyze?utm_source=test`) {
        ok(`${host} はパス・クエリ文字列を維持してリダイレクトする (${withPathAndQuery.location})`);
      } else {
        bad(`${host} でパス・クエリ文字列が維持されない: ${withPathAndQuery.location}`);
      }
    }

    // per-deployment(ハッシュ付き)プレビューURL相当は完全一致しないためリダイレクトされない
    const previewLikeHost = "loop-vocabulary-4w77iz7kh-roromukuro-5711s-projects.vercel.app";
    const preview = await rawRequest("/", previewLikeHost);
    if (preview.status === 308 || preview.status === 301) {
      bad(`per-deployment相当のHost(${previewLikeHost})が誤ってリダイレクトされた(preview/branchデプロイを壊す懸念): status=${preview.status}`);
    } else {
      ok(`per-deployment相当のHost(${previewLikeHost})はリダイレクトされない(preview/branchデプロイ非対象、意図どおり)`);
    }

    // カスタムドメイン・localhostではリダイレクトしない(ループ防止・開発環境への影響なし)
    const customHost = await rawRequest("/", "loop-vocabulary.app");
    if (customHost.status === 308 || customHost.status === 301) bad(`カスタムドメイン宛がリダイレクトされてしまう: status=${customHost.status}`);
    else ok(`カスタムドメイン宛はリダイレクトされない (status=${customHost.status})`);

    const localHost = await rawRequest("/", `localhost:${PORT}`);
    if (localHost.status === 308 || localHost.status === 301) bad(`localhost宛が誤ってリダイレクトされる: status=${localHost.status}`);
    else ok(`localhost宛はリダイレクトされない (status=${localHost.status})`);
  } finally {
    stopDevServer(dev);
  }

  console.log(fail ? `\n=== test:all-production-domain-redirects: ${fail}件失敗 (${pass}件成功) ===` : `\n=== test:all-production-domain-redirects RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
