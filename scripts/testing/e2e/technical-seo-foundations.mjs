/**
 * 技術SEO基礎修正の回帰テスト(2026-07-21のAdSense/SEO/成長ループ総合監査で発見:
 * /termsがトップページのtitle/descriptionを継承しcanonicalが無い、/materials/[id]に
 * canonicalが無い、sitemap.xmlの全URLのlastModifiedが常にリクエスト時刻になっている、
 * viewportのmaximumScale:1がピンチズームを妨げている)。
 *
 * 1. toSafeLastModified・normalizeSiteUrl の単体検証(サーバ起動不要、純粋関数)
 * 2. materials/[id]・sitemap.tsが実際にnormalizeSiteUrl()を経由している(静的ソース検証)
 * 3. /terms が独自のtitle・canonical(https://loop-vocabulary.app/terms)を持つ
 *    (トップページのtitle/canonicalを継承していない)
 * 4. /materials/[id] のcanonicalが教材本体URL(queryなし)を指す
 *    (?level=等のqueryを付けてアクセスしても同じcanonicalになる)
 * 5. sitemap.xml で、更新日時の信頼できるデータソースを持たない静的ページ
 *    (/about, /privacy, /terms等)は lastmod を省略しており、
 *    公開教材URLは materials.updated_at 由来の実際の値を lastmod に持つ
 *    (すべてのURLが同一の「今」になっていない)
 * 6. robots.txt・sitemapの既存の除外方針(主要ページのクロール許可)が壊れていない
 * 7. viewport meta に maximum-scale が含まれない(ピンチズーム可能)
 * 8. NEXT_PUBLIC_SITE_URLが末尾スラッシュ付きでも、教材canonical・sitemap URLに
 *    二重スラッシュが発生しない(専用のセカンドサーバで実際にbuildして検証)
 *
 * 使い方: node scripts/testing/e2e/technical-seo-foundations.mjs
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { loadEnv, requireEnv, REPO_ROOT } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";
import { toSafeLastModified } from "../../../src/lib/seo/sitemapDates.ts";
import { normalizeSiteUrl } from "../../../src/lib/seo/siteUrl.ts";

const PORT = Number(process.env.TEST_PORT || 3799);
// 末尾スラッシュ付きNEXT_PUBLIC_SITE_URLでの実機検証専用の別ポート
// (NEXT_PUBLIC_*はNext.jsのbuild時に静的に埋め込まれるため、既存サーバの使い回しでは
// 検証できない。専用portで別途build+startする)
const TRAILING_SLASH_PORT = PORT + 1;

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

// ── 1. toSafeLastModified / normalizeSiteUrl の単体検証(サーバ起動不要、純粋関数) ──
function testToSafeLastModified() {
  const cases = [
    { input: "2026-07-12T00:00:00.000Z", expectDefined: true, label: "有効なISO文字列" },
    { input: new Date("2026-07-12"), expectDefined: true, label: "Dateインスタンス" },
    { input: "not-a-date", expectDefined: false, label: "不正な文字列" },
    { input: null, expectDefined: false, label: "null" },
    { input: undefined, expectDefined: false, label: "undefined" },
    { input: 12345, expectDefined: false, label: "数値(文字列/Dateではない)" },
    { input: "", expectDefined: false, label: "空文字列" },
  ];
  for (const c of cases) {
    const result = toSafeLastModified(c.input);
    const isDefined = result instanceof Date && !Number.isNaN(result.getTime());
    if (isDefined === c.expectDefined) {
      ok(`toSafeLastModified(${c.label}) は期待どおり ${c.expectDefined ? "有効なDateを返す" : "undefinedを返す"}`);
    } else {
      fail(`toSafeLastModified(${c.label}) の結果が想定外 (expectDefined=${c.expectDefined}, actual=${result})`);
    }
  }
}

function testNormalizeSiteUrl() {
  const cases = [
    { input: "https://loop-vocabulary.app", expected: "https://loop-vocabulary.app" },
    { input: "https://loop-vocabulary.app/", expected: "https://loop-vocabulary.app" },
    { input: "https://loop-vocabulary.app///", expected: "https://loop-vocabulary.app" },
    { input: undefined, expected: "https://loop-vocabulary.app" },
    { input: "", expected: "https://loop-vocabulary.app" },
  ];
  for (const c of cases) {
    const result = normalizeSiteUrl(c.input);
    if (result === c.expected) {
      ok(`normalizeSiteUrl(${JSON.stringify(c.input)}) === "${c.expected}"`);
    } else {
      fail(`normalizeSiteUrl(${JSON.stringify(c.input)}) が想定外: "${result}" (期待値: "${c.expected}")`);
    }
  }
  // https:// 自体の // を誤って剥がさないこと(末尾スラッシュのみを対象とする回帰確認)
  const untouched = normalizeSiteUrl("https://loop-vocabulary.app/materials");
  if (untouched === "https://loop-vocabulary.app/materials") {
    ok("normalizeSiteUrl はパス途中のスラッシュやhttps://自体のスラッシュには影響しない");
  } else {
    fail(`normalizeSiteUrl がパスを不正に変更した: "${untouched}"`);
  }
}

// ── 2. materials/[id]・sitemap.tsが実際にnormalizeSiteUrl()を経由している(静的ソース検証) ──
function testSourceUsesNormalizeSiteUrl() {
  const materialsSrc = readFileSync(resolve(REPO_ROOT, "src/app/materials/[id]/page.tsx"), "utf8");
  const sitemapSrc = readFileSync(resolve(REPO_ROOT, "src/app/sitemap.ts"), "utf8");

  // 生の "process.env.NEXT_PUBLIC_SITE_URL ?? ..." / "|| ..." パターンが
  // normalizeSiteUrl()を経由せず残っていないこと(正規化を迂回する経路が復活していないか)
  const rawPatternRe = /process\.env\.NEXT_PUBLIC_SITE_URL\s*(\?\?|\|\|)/;
  if (rawPatternRe.test(materialsSrc)) {
    fail("src/app/materials/[id]/page.tsx に、normalizeSiteUrl()を経由しない生のNEXT_PUBLIC_SITE_URL参照が残っている(二重スラッシュ対策が迂回されている可能性)");
  } else {
    ok("src/app/materials/[id]/page.tsx に、normalizeSiteUrl()を経由しない生のNEXT_PUBLIC_SITE_URL参照は残っていない");
  }
  if (rawPatternRe.test(sitemapSrc)) {
    fail("src/app/sitemap.ts に、normalizeSiteUrl()を経由しない生のNEXT_PUBLIC_SITE_URL参照が残っている(二重スラッシュ対策が迂回されている可能性)");
  } else {
    ok("src/app/sitemap.ts に、normalizeSiteUrl()を経由しない生のNEXT_PUBLIC_SITE_URL参照は残っていない");
  }

  const materialsCallCount = (materialsSrc.match(/normalizeSiteUrl\(/g) ?? []).length;
  if (materialsCallCount >= 2) {
    ok(`src/app/materials/[id]/page.tsx はnormalizeSiteUrl()を${materialsCallCount}箇所(canonical用・BreadcrumbList用)で使っている`);
  } else {
    fail(`src/app/materials/[id]/page.tsx でのnormalizeSiteUrl()呼び出しが想定より少ない(${materialsCallCount}箇所)`);
  }
  if (/const base = normalizeSiteUrl\(process\.env\.NEXT_PUBLIC_SITE_URL\)/.test(sitemapSrc)) {
    ok("src/app/sitemap.ts の base はnormalizeSiteUrl()経由で組み立てられている");
  } else {
    fail("src/app/sitemap.ts の base がnormalizeSiteUrl()経由になっていない");
  }
}

/** URLリストに "https://" 直後を除く二重スラッシュが無いことを確認する */
function assertNoDoubleSlash(urls, label) {
  const bad = urls.filter((u) => u.replace(/^https?:\/\//, "").includes("//"));
  if (bad.length === 0) {
    ok(`${label}: 二重スラッシュを含むURLは無い(${urls.length}件確認)`);
  } else {
    fail(`${label}: 二重スラッシュを含むURLがある: ${bad.join(", ")}`);
  }
}

async function main() {
  loadEnv();
  // NEXT_PUBLIC_*(secretではない)のみを要求する。SUPABASE_SERVICE_ROLE_KEYは
  // pr-quality-gate.yml(独立PR CI、fork PRでも安全なようsecretsを一切渡さない設計)
  // では利用できないため、公開教材の読み取りには anon key + RLS("materials public read":
  // is_public=true かつ license_status in ('approved','original') は誰でもSELECT可能、
  // 本番で実在確認済み)を使う。
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);

  console.log("\n--- 1. toSafeLastModified / normalizeSiteUrl 単体検証 ---");
  testToSafeLastModified();
  testNormalizeSiteUrl();

  console.log("\n--- 2. materials/[id]・sitemap.tsがnormalizeSiteUrl()を経由している(静的ソース検証) ---");
  testSourceUsesNormalizeSiteUrl();

  // /materials/[id]のgenerateMetadata・sitemap.tsの教材取得は、いずれも既存実装として
  // createAdminClient()(SUPABASE_SERVICE_ROLE_KEY、真のsecret)を使っている(このPRでは
  // 教材データ取得の実装方式自体は変更していない)。独立PR Quality Gate(pr-quality-gate.yml)
  // はfork PRでも安全なようsecretsを一切渡さない設計のため、そちらの環境ではこの箇所は
  // 実行時に空メタデータ/空配列にフォールバックする(既存のtry/catch挙動、このPR起因ではない)。
  // そのため、この特定のライブレンダリング検証はSUPABASE_SERVICE_ROLE_KEYが利用可能な
  // 環境(ローカル・信頼コンテキストのCI)でのみ実施し、無い場合は失敗ではなく
  // 「未確認」として明示的にスキップする。
  const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: material, error: materialErr } = await anon
    .from("materials")
    .select("id, updated_at")
    .eq("is_public", true)
    .limit(1)
    .maybeSingle();
  if (materialErr) fail(`公開教材の取得に失敗: ${materialErr.message}`);
  else if (!material) console.log("⚠️ 公開教材(is_public=true)が1件も存在しないため、教材関連の検証をスキップします");

  // ══════════════ サーバ1: 既存の(TEST_PORTの)build+startで検証 ══════════════
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    // ── 3. /terms の独自metadata ──
    console.log("\n--- 3. /terms が独自title・canonicalを持つ(トップページの値を継承していない) ---");
    const page1 = await browser.newPage();
    const errors1 = collectErrors(page1);
    await gotoReady(page1, `${baseUrl}/terms`);
    const termsTitle = await page1.title();
    const termsCanonical = await page1.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
    if (termsTitle.includes("利用規約")) {
      ok(`/termsのtitleに「利用規約」が含まれる: "${termsTitle}"`);
    } else {
      fail(`/termsのtitleが想定外(トップページの値を継承している可能性): "${termsTitle}"`);
    }
    if (termsCanonical === "https://loop-vocabulary.app/terms") {
      ok(`/termsのcanonicalが正しい: ${termsCanonical}`);
    } else {
      fail(`/termsのcanonicalが想定外: ${termsCanonical}`);
    }
    const termsOgUrl = await page1.locator('meta[property="og:url"]').getAttribute("content").catch(() => null);
    if (termsOgUrl === "https://loop-vocabulary.app/terms") {
      ok(`/termsのog:urlが正しい: ${termsOgUrl}`);
    } else {
      fail(`/termsのog:urlが想定外: ${termsOgUrl}`);
    }
    if (errors1.length === 0) ok("/terms表示中にconsole error / 5xxなし");
    else fail(`/terms表示中にエラー検出: ${errors1.join(" | ")}`);
    await page1.close();

    // ── 4. /materials/[id] のcanonical(query有無で不変) ──
    console.log("\n--- 4. /materials/[id] のcanonicalが教材本体URLを指す(?level=を含めない) ---");
    if (material && !hasServiceRoleKey) {
      console.log(
        "⚠️ 未確認: SUPABASE_SERVICE_ROLE_KEYが無い環境のため、/materials/[id]のgenerateMetadataが" +
          "実データを取得できず検証不能(独立PR Quality Gateの意図的なsecretless設計。既存のtry/catch挙動で" +
          "このPR起因ではない)。ローカル(.env.local)またはservice roleが渡される信頼コンテキストで別途確認してください。",
      );
    } else if (material) {
      // materials/[id]のcanonicalはNEXT_PUBLIC_SITE_URLが設定されていればそれを使う実装
      // (アプリ側と同じ解決規則。ローカル環境ではhttp://localhost:3000になりうるため、
      // 本番URLを決め打ちしない)
      const siteUrlForTest = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
      const expectedCanonical = `${siteUrlForTest}/materials/${material.id}`;

      const page2 = await browser.newPage();
      const errors2 = collectErrors(page2);
      await gotoReady(page2, `${baseUrl}/materials/${material.id}`);
      const canonicalNoQuery = await page2.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
      const ogUrlNoQuery = await page2.locator('meta[property="og:url"]').getAttribute("content").catch(() => null);
      if (canonicalNoQuery === expectedCanonical) {
        ok(`/materials/${material.id} のcanonicalが正しい: ${canonicalNoQuery}`);
      } else {
        fail(`/materials/${material.id} のcanonicalが想定外: ${canonicalNoQuery}`);
      }
      if (ogUrlNoQuery === expectedCanonical) {
        ok(`/materials/${material.id} のog:urlが正しい: ${ogUrlNoQuery}`);
      } else {
        fail(`/materials/${material.id} のog:urlが想定外: ${ogUrlNoQuery}`);
      }
      await page2.close();

      const page3 = await browser.newPage();
      await gotoReady(page3, `${baseUrl}/materials/${material.id}?level=中学基礎`);
      const canonicalWithQuery = await page3.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
      if (canonicalWithQuery === expectedCanonical) {
        ok(`?level=付きでアクセスしてもcanonicalはquery無しの教材本体URLのまま: ${canonicalWithQuery}`);
      } else {
        fail(`?level=付きアクセス時のcanonicalが教材本体URLと異なる(重複コンテンツ化リスク): ${canonicalWithQuery}`);
      }
      await page3.close();

      if (errors2.length === 0) ok("/materials/[id]表示中にconsole error / 5xxなし");
      else fail(`/materials/[id]表示中にエラー検出: ${errors2.join(" | ")}`);
    }

    // ── 5. sitemap.xml の lastmod 方針 ──
    console.log("\n--- 5. sitemap.xmlのlastmod: 静的ページは省略、公開教材は実際のupdated_at ---");
    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    if (sitemapXml.startsWith("<?xml")) ok("sitemap.xmlは妥当なXML宣言で始まる");
    else fail("sitemap.xmlがXML宣言で始まっていない");

    // 各<url>ブロックごとに、locとlastmodの有無を抽出する
    const urlBlocks = [...sitemapXml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
    const blockFor = (pathSuffix) =>
      urlBlocks.find((b) => new RegExp(`<loc>[^<]*${pathSuffix.replace(/\//g, "\\/")}<\\/loc>`).test(b));

    for (const staticPath of ["/about", "/privacy", "/terms"]) {
      const block = blockFor(staticPath);
      if (!block) {
        fail(`sitemap.xmlに${staticPath}のエントリが見つからない`);
        continue;
      }
      if (/<lastmod>/.test(block)) {
        fail(`${staticPath}のsitemapエントリにlastmodが設定されている(信頼できる更新日時データソースが無いため省略すべき): ${block.match(/<lastmod>[^<]*<\/lastmod>/)?.[0]}`);
      } else {
        ok(`${staticPath}のsitemapエントリはlastmodを省略している(誤った現在時刻を設定しない)`);
      }
    }

    if (material && !hasServiceRoleKey) {
      console.log(
        "⚠️ 未確認: SUPABASE_SERVICE_ROLE_KEYが無い環境のため、sitemap.ts側の教材取得も" +
          "空配列にフォールバックし、/materials/[id]のsitemapエントリ自体が生成されない" +
          "(独立PR Quality Gateの意図的なsecretless設計、既存のtry/catch挙動でこのPR起因ではない)。" +
          "ローカルまたはservice roleが渡される信頼コンテキストで別途確認してください。",
      );
    } else if (material) {
      const materialBlock = blockFor(`/materials/${material.id}`);
      if (!materialBlock) {
        fail(`sitemap.xmlに/materials/${material.id}のエントリが見つからない`);
      } else {
        const lastmodMatch = materialBlock.match(/<lastmod>([^<]*)<\/lastmod>/);
        if (!lastmodMatch) {
          fail(`/materials/${material.id}のsitemapエントリにlastmodが無い(materials.updated_atが取得できているはず)`);
        } else {
          const sitemapDate = new Date(lastmodMatch[1]);
          const dbDate = toSafeLastModified(material.updated_at);
          if (dbDate && Math.abs(sitemapDate.getTime() - dbDate.getTime()) < 1000) {
            ok(`/materials/${material.id}のlastmodはmaterials.updated_atと一致する(実際の更新時刻を反映): ${lastmodMatch[1]}`);
          } else {
            fail(`/materials/${material.id}のlastmod(${lastmodMatch[1]})がDBのupdated_at(${material.updated_at})と一致しない`);
          }
        }
      }
    }

    // すべてのURLが同一の(≒テスト実行時刻の)lastmodになっていないこと
    // (以前の実装は全エントリがnew Date()で、この検証で必ず失敗していた)
    const allLastmods = [...sitemapXml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
    const totalUrlCount = urlBlocks.length;
    if (allLastmods.length < totalUrlCount) {
      ok(`sitemap.xml内でlastmodを持つURL(${allLastmods.length}件)が全URL(${totalUrlCount}件)より少ない(=一部の静的ページが正しく省略している)`);
    } else {
      fail(`sitemap.xml内の全URL(${totalUrlCount}件)にlastmodが設定されている(以前の"常に現在時刻"の不具合が再発している可能性)`);
    }
    const uniqueLastmods = new Set(allLastmods);
    if (allLastmods.length === 0 || uniqueLastmods.size > 1 || allLastmods.length === 1) {
      ok("lastmodを持つURLの値がすべて同一(=リクエスト時刻の使い回し)にはなっていない");
    } else {
      fail(`lastmodを持つ${allLastmods.length}件のURLがすべて同一の値になっている: ${[...uniqueLastmods][0]}`);
    }

    // ── 6. 既存の robots.txt / sitemap 方針が壊れていないこと ──
    console.log("\n--- 6. robots.txt・sitemapの既存方針(主要ページのクロール許可)が壊れていない ---");
    const robotsTxt = readFileSync(resolve(REPO_ROOT, "public/robots.txt"), "utf8");
    const mustNotBeBlocked = ["/guide", "/dictionary", "/grammar", "/materials", "/vocab-check"];
    const blocked = mustNotBeBlocked.filter((p) => new RegExp(`Disallow:\\s*${p.replace(/\//g, "\\/")}(\\/|$)`).test(robotsTxt));
    if (blocked.length === 0) {
      ok("robots.txtで/guide・/dictionary・/grammar・/materials・/vocab-checkはブロックされていない");
    } else {
      fail(`robots.txtで想定外にブロックされているページがある: ${blocked.join(", ")}`);
    }
    const mustBeInSitemap = ["/guide", "/dictionary", "/grammar", "/materials", "/vocab-check"];
    const missingFromSitemap = mustBeInSitemap.filter((p) => !urlBlocks.some((b) => new RegExp(`<loc>[^<]*${p.replace(/\//g, "\\/")}<`).test(b)));
    if (missingFromSitemap.length === 0) {
      ok("sitemap.xmlに/guide・/dictionary・/grammar・/materials・/vocab-checkが引き続き含まれている");
    } else {
      fail(`sitemap.xmlから消えているページがある: ${missingFromSitemap.join(", ")}`);
    }
    // sitemap内でのURL重複が無いこと(既存方針の維持)
    const allLocs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const dupLocs = allLocs.filter((u, i) => allLocs.indexOf(u) !== i);
    if (dupLocs.length === 0) {
      ok("sitemap.xmlにURLの重複がない");
    } else {
      fail(`sitemap.xmlにURLの重複がある: ${[...new Set(dupLocs)].join(", ")}`);
    }

    // ── 7. viewport: maximum-scale が無い(ピンチズーム可能) ──
    console.log("\n--- 7. viewport metaにmaximum-scaleが含まれない(ピンチズーム可能) ---");
    const page4 = await browser.newPage();
    await gotoReady(page4, `${baseUrl}/`);
    const viewportContent = await page4.locator('meta[name="viewport"]').getAttribute("content").catch(() => null);
    if (viewportContent && !/maximum-scale/i.test(viewportContent)) {
      ok(`viewport metaにmaximum-scaleが含まれない: "${viewportContent}"`);
    } else {
      fail(`viewport metaにmaximum-scaleが含まれている(ピンチズームを妨げる): "${viewportContent}"`);
    }
    if (viewportContent && /width=device-width/.test(viewportContent) && /initial-scale=1/.test(viewportContent)) {
      ok("viewport metaのwidth/initial-scaleは維持されている");
    } else {
      fail(`viewport metaのwidth/initial-scaleが想定外: "${viewportContent}"`);
    }
    await page4.close();
  } catch (e) {
    fail(`予期しない例外(サーバ1): ${e.message}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  // ══════════════ サーバ2: 末尾スラッシュ付きNEXT_PUBLIC_SITE_URLで別途build+start ══════════════
  // NEXT_PUBLIC_*はNext.jsのbuild時に静的に埋め込まれるため、末尾スラッシュの挙動を
  // 実際に確認するには専用のbuild+startが必要。SUPABASE_SERVICE_ROLE_KEYが無い環境
  // (独立PR Quality Gate)では教材データ自体が取得できず検証不能なため、その場合は
  // 専用サーバの起動自体をスキップする(ビルド時間の浪費を避ける)。
  if (!material) {
    console.log("\n--- 8. スキップ: 公開教材が無いため末尾スラッシュ検証は実施しない ---");
  } else if (!hasServiceRoleKey) {
    console.log(
      "\n--- 8. 未確認: SUPABASE_SERVICE_ROLE_KEYが無い環境のため、末尾スラッシュ検証用の" +
        "専用サーバは起動しない(教材データを取得できず検証にならないため)。ローカルまたは" +
        "service roleが渡される信頼コンテキストで別途確認してください。 ---",
    );
  } else {
    console.log("\n--- 8. NEXT_PUBLIC_SITE_URLが末尾スラッシュ付きでも二重スラッシュが発生しない(専用サーバで実機検証) ---");
    const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://loop-vocabulary.app/"; // 末尾スラッシュを意図的に付与
    let dev2;
    const browser2 = await chromium.launch();
    try {
      dev2 = await ensureDevServer(TRAILING_SLASH_PORT);
      const baseUrl2 = dev2.url;
      console.log(`Trailing-slash検証用サーバ: ${baseUrl2} (startedByUs=${dev2.startedByUs})`);

      const page5 = await browser2.newPage();
      await gotoReady(page5, `${baseUrl2}/materials/${material.id}`);
      const canonicalTrailing = await page5.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
      const ogUrlTrailing = await page5.locator('meta[property="og:url"]').getAttribute("content").catch(() => null);
      const expected = `https://loop-vocabulary.app/materials/${material.id}`;
      if (canonicalTrailing === expected) {
        ok(`末尾スラッシュ付きNEXT_PUBLIC_SITE_URLでも/materials/[id]のcanonicalは二重スラッシュにならない: ${canonicalTrailing}`);
      } else {
        fail(`末尾スラッシュ付きNEXT_PUBLIC_SITE_URLで/materials/[id]のcanonicalが想定外(二重スラッシュの疑い): ${canonicalTrailing}`);
      }
      if (ogUrlTrailing === expected) {
        ok(`末尾スラッシュ付きNEXT_PUBLIC_SITE_URLでもog:urlは二重スラッシュにならない: ${ogUrlTrailing}`);
      } else {
        fail(`末尾スラッシュ付きNEXT_PUBLIC_SITE_URLでog:urlが想定外: ${ogUrlTrailing}`);
      }
      await page5.close();

      const page6 = await browser2.newPage();
      await gotoReady(page6, `${baseUrl2}/materials/${material.id}?level=中学基礎`);
      const canonicalTrailingWithQuery = await page6.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
      if (canonicalTrailingWithQuery === expected) {
        ok("末尾スラッシュ付きNEXT_PUBLIC_SITE_URL・?level=付きアクセスでも、query無し・二重スラッシュ無しのcanonicalを維持する");
      } else {
        fail(`末尾スラッシュ付き環境での?level=付きアクセス時のcanonicalが想定外: ${canonicalTrailingWithQuery}`);
      }
      await page6.close();

      const sitemapRes2 = await fetch(`${baseUrl2}/sitemap.xml`);
      const sitemapXml2 = await sitemapRes2.text();
      const locs2 = [...sitemapXml2.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      assertNoDoubleSlash(locs2, "末尾スラッシュ付きNEXT_PUBLIC_SITE_URLでのsitemap.xml");
      const dup2 = locs2.filter((u, i) => locs2.indexOf(u) !== i);
      if (dup2.length === 0) {
        ok("末尾スラッシュ付きNEXT_PUBLIC_SITE_URLでもsitemap.xmlにURL重複が発生しない");
      } else {
        fail(`末尾スラッシュ付きNEXT_PUBLIC_SITE_URLでsitemap.xmlにURL重複が発生した: ${[...new Set(dup2)].join(", ")}`);
      }
      // lastmod方針(静的ページ省略・教材は実データ)がこの環境でも維持されていること
      const urlBlocks2 = [...sitemapXml2.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
      const staticBlock2 = urlBlocks2.find((b) => /<loc>[^<]*\/about<\/loc>/.test(b));
      if (staticBlock2 && !/<lastmod>/.test(staticBlock2)) {
        ok("末尾スラッシュ付き環境でも/aboutはlastmodを省略している(方針維持)");
      } else {
        fail("末尾スラッシュ付き環境で/aboutのlastmod省略方針が崩れている");
      }
    } catch (e) {
      fail(`予期しない例外(サーバ2・末尾スラッシュ検証): ${e.message}`);
    } finally {
      await browser2.close();
      if (dev2) stopDevServer(dev2);
      if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
  }

  if (process.exitCode) {
    console.log("\n=== test:technical-seo-foundations RESULT: FAILED ===");
  } else {
    console.log("\n=== test:technical-seo-foundations RESULT: all checks passed ===");
  }
  process.exit(process.exitCode ? 1 : 0);
}

main().catch((e) => {
  console.error("technical-seo-foundations e2e crashed:", e);
  process.exit(1);
});
