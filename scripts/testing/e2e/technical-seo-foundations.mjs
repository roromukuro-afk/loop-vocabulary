/**
 * 技術SEO基礎修正の回帰テスト(2026-07-21のAdSense/SEO/成長ループ総合監査で発見:
 * /termsがトップページのtitle/descriptionを継承しcanonicalが無い、/materials/[id]に
 * canonicalが無い、sitemap.xmlの全URLのlastModifiedが常にリクエスト時刻になっている、
 * viewportのmaximumScale:1がピンチズームを妨げている)。
 *
 * 1. /terms が独自のtitle・canonical(https://loop-vocabulary.app/terms)を持つ
 *    (トップページのtitle/canonicalを継承していない)
 * 2. /materials/[id] のcanonicalが教材本体URL(queryなし)を指す
 *    (?level=等のqueryを付けてアクセスしても同じcanonicalになる)
 * 3. sitemap.xml で、更新日時の信頼できるデータソースを持たない静的ページ
 *    (/about, /privacy, /terms等)は lastmod を省略しており、
 *    公開教材URLは materials.updated_at 由来の実際の値を lastmod に持つ
 *    (すべてのURLが同一の「今」になっていない)
 * 4. viewport meta に maximum-scale が含まれない(ピンチズーム可能)
 * 5. robots.txt・sitemapの既存の除外方針(主要ページのクロール許可)が壊れていない
 *
 * 使い方: node scripts/testing/e2e/technical-seo-foundations.mjs
 */
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { resolve } from "path";
import { loadEnv, requireEnv, REPO_ROOT } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";
import { toSafeLastModified } from "../../../src/lib/seo/sitemapDates.ts";

const PORT = Number(process.env.TEST_PORT || 3799);

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

// ── 1. toSafeLastModified の単体検証(サーバ起動不要、純粋関数) ──
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
  let allOk = true;
  for (const c of cases) {
    const result = toSafeLastModified(c.input);
    const isDefined = result instanceof Date && !Number.isNaN(result.getTime());
    if (isDefined === c.expectDefined) {
      ok(`toSafeLastModified(${c.label}) は期待どおり ${c.expectDefined ? "有効なDateを返す" : "undefinedを返す"}`);
    } else {
      fail(`toSafeLastModified(${c.label}) の結果が想定外 (expectDefined=${c.expectDefined}, actual=${result})`);
      allOk = false;
    }
  }
  return allOk;
}

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  console.log("\n--- 1. toSafeLastModified 単体検証 ---");
  testToSafeLastModified();

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    // ── 2. /terms の独自metadata ──
    console.log("\n--- 2. /terms が独自title・canonicalを持つ(トップページの値を継承していない) ---");
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

    // ── 3. /materials/[id] のcanonical(query有無で不変) ──
    console.log("\n--- 3. /materials/[id] のcanonicalが教材本体URLを指す(?level=を含めない) ---");
    const admin = getAdminClient();
    const { data: material, error: materialErr } = await admin
      .from("materials")
      .select("id, updated_at")
      .eq("is_public", true)
      .limit(1)
      .maybeSingle();
    if (materialErr) {
      fail(`公開教材の取得に失敗: ${materialErr.message}`);
    } else if (!material) {
      console.log("⚠️ 公開教材(is_public=true)が1件も存在しないため、/materials/[id]のcanonical検証をスキップします");
    } else {
      // materials/[id]のcanonicalはNEXT_PUBLIC_SITE_URLが設定されていればそれを使う実装
      // (アプリ側と同じ解決規則。ローカル環境ではhttp://localhost:3000になりうるため、
      // 本番URLを決め打ちしない)
      const siteUrlForTest = process.env.NEXT_PUBLIC_SITE_URL || "https://loop-vocabulary.app";
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

    // ── 4. sitemap.xml の lastmod 方針 ──
    console.log("\n--- 4. sitemap.xmlのlastmod: 静的ページは省略、公開教材は実際のupdated_at ---");
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

    if (material) {
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

    // ── 5. 既存の robots.txt / sitemap 方針が壊れていないこと ──
    console.log("\n--- 5. robots.txt・sitemapの既存方針(主要ページのクロール許可)が壊れていない ---");
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

    // ── 6. viewport: maximum-scale が無い(ピンチズーム可能) ──
    console.log("\n--- 6. viewport metaにmaximum-scaleが含まれない(ピンチズーム可能) ---");
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
    fail(`予期しない例外: ${e.message}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
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
