/**
 * Vercelデフォルトドメイン(loop-vocabulary.vercel.app)からカスタムドメイン
 * (loop-vocabulary.app)への恒久リダイレクト 自律検証
 *
 * 背景: Search ConsoleでGoogle-selected canonicalがloop-vocabulary.vercel.appを
 * 指しており、重複コンテンツとして扱われていた。next.config.jsのredirects()に
 * Hostヘッダーベースの恒久リダイレクトを追加して解消した。
 *
 * fetch()はWHATWG仕様上 Host ヘッダーを設定できない(forbidden header)ため、
 * このテストはNode組み込みのhttpモジュールで直接Hostヘッダーを偽装してリクエストする
 * （ローカルのdevServerに対して、あたかもvercel.appドメイン経由でアクセスしたかのように
 * 検証する標準的な手法）。
 *
 * 検証項目:
 * 1. Host: loop-vocabulary.vercel.app への / アクセスがloop-vocabulary.app/へ恒久リダイレクト
 * 2. サブパスが維持される (/dictionary/analyze)
 * 3. クエリ文字列が維持される (?utm_source=test)
 * 4. 通常のHost(=カスタムドメイン相当)ではリダイレクトが発生しない(ループ防止)
 * 5. sitemap.xmlにvercel.appドメインが混入していない
 *
 * 使い方: node scripts/testing/e2e/canonical-domain-redirect.mjs
 */
import http from "node:http";
import { loadEnv } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const VERCEL_HOST = "loop-vocabulary.vercel.app";
const CUSTOM_DOMAIN = "https://loop-vocabulary.app";

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

function rawRequest(path, hostHeader) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: PORT,
        path,
        method: "GET",
        headers: { Host: hostHeader },
      },
      (res) => {
        res.resume(); // 本文は不要、破棄してソケットを解放
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
    // 1. ルートパスのリダイレクト
    const root = await rawRequest("/", VERCEL_HOST);
    if (root.status !== 308 && root.status !== 301) {
      fail(`vercel.appドメインの / が恒久リダイレクト(308/301)ではない: status=${root.status}`);
    } else {
      ok(`vercel.appドメインの / が ${root.status} でリダイレクトされる`);
    }
    // トップページの既存canonical(alternates.canonical)がスラッシュ無しの
    // "https://loop-vocabulary.app" のため、リダイレクト先もそれと一致させる
    if (root.location !== CUSTOM_DOMAIN) {
      fail(`/ のリダイレクト先が不正: ${root.location}`);
    } else {
      ok(`/ のリダイレクト先が正しい (${root.location})`);
    }

    // 2. サブパスの維持
    const dict = await rawRequest("/dictionary/analyze", VERCEL_HOST);
    if (dict.location !== `${CUSTOM_DOMAIN}/dictionary/analyze`) {
      fail(`/dictionary/analyze のリダイレクト先でパスが維持されていない: ${dict.location}`);
    } else {
      ok(`/dictionary/analyze のパスが維持されてリダイレクトされる (${dict.location})`);
    }

    const guide = await rawRequest("/guide/toeic-tango", VERCEL_HOST);
    if (guide.location !== `${CUSTOM_DOMAIN}/guide/toeic-tango`) {
      fail(`/guide/toeic-tango のリダイレクト先でパスが維持されていない: ${guide.location}`);
    } else {
      ok(`/guide/toeic-tango のパスが維持されてリダイレクトされる (${guide.location})`);
    }

    // 3. クエリ文字列の維持
    const withQuery = await rawRequest("/guide/toeic-tango?utm_source=test&x=1", VERCEL_HOST);
    if (withQuery.location !== `${CUSTOM_DOMAIN}/guide/toeic-tango?utm_source=test&x=1`) {
      fail(`クエリ文字列が維持されていない: ${withQuery.location}`);
    } else {
      ok(`クエリ文字列が維持されてリダイレクトされる (${withQuery.location})`);
    }

    // 4. カスタムドメイン相当のHostではリダイレクトしない（ループ防止）
    const customHost = await rawRequest("/", "loop-vocabulary.app");
    if (customHost.status === 308 || customHost.status === 301) {
      fail(`loop-vocabulary.app宛のリクエストがリダイレクトされてしまう(ループの懸念): status=${customHost.status} location=${customHost.location}`);
    } else {
      ok(`loop-vocabulary.app宛のリクエストはリダイレクトされない (status=${customHost.status})`);
    }

    // localhost(通常のテスト環境のHost)でもリダイレクトが発生しないこと
    const localHost = await rawRequest("/", `localhost:${PORT}`);
    if (localHost.status === 308 || localHost.status === 301) {
      fail(`localhost宛のリクエストが誤ってリダイレクトされてしまう: status=${localHost.status}`);
    } else {
      ok(`localhost宛のリクエストはリダイレクトされない (status=${localHost.status}, 開発環境に影響なし)`);
    }

    // 5. sitemap.xmlにvercel.appドメインが混入していないこと
    const sitemapRes = await fetch(`${dev.url}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    if (sitemapXml.includes("vercel.app")) {
      fail("sitemap.xmlにvercel.appドメインのURLが混入している");
    } else {
      ok("sitemap.xmlにvercel.appドメインの混入なし（loop-vocabulary.appのみ）");
    }
  } finally {
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:canonical-domain-redirect: FAILED ===" : "\n=== test:canonical-domain-redirect RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
