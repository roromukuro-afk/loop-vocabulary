/**
 * note.com 自動投稿スクリプト v2
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const articlesDir = join(__dirname, "..", "note-articles");
const screenshotsDir = join(__dirname, "..", "note-screenshots");
mkdirSync(screenshotsDir, { recursive: true });

const ARTICLES = [
  {
    file: "01_wasurenai-tango-kioku.md",
    title: "英単語、何度やっても覚えられない人へ。「忘却曲線」を使ったら3ヶ月で1,000語定着した話",
  },
  {
    file: "02_toeic-tango-houhou.md",
    title: "TOEIC 730点 → 900点。スコアが上がらない原因は「単語の覚え方」にありました",
  },
  {
    file: "03_eitango-app-hikaku.md",
    title: "【2026年版】英単語アプリを本気で使い比べた結果、違いがはっきりわかった",
  },
];

function mdToBody(mdPath) {
  const text = readFileSync(mdPath, "utf-8");
  // 先頭のh1タイトル行を除去
  return text.replace(/^#\s.+\n\n?/, "").trim();
}

async function typeIntoContentEditable(page, selector, text) {
  const el = page.locator(selector).first();
  await el.click();
  await el.focus();
  // 既存テキストを全選択して削除
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
  // クリップボード経由で貼り付け（日本語テキストをそのまま入力すると遅い）
  await page.evaluate((t) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", t);
    document.activeElement.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
  }, text);
  await page.waitForTimeout(500);
}

async function main() {
  console.log("🚀 Playwright 起動...");

  const browser = await chromium.launch({
    headless: false,
    slowMo: 200,
    args: ["--window-size=1280,900", "--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "ja-JP",
  });

  const page = await context.newPage();

  // ── ログイン待機 ─────────────────────────────────────────
  console.log("📋 note.com ログインページへ...");
  await page.goto("https://note.com/login", { waitUntil: "domcontentloaded" });

  await page.screenshot({ path: join(screenshotsDir, "01_login.png") });
  console.log("⏳ ログインしてください（最大5分待機）...");

  await page.waitForURL((url) => url.hostname === "note.com" && !url.pathname.startsWith("/login") && !url.pathname.startsWith("/signup"), { timeout: 300_000 });

  console.log("✅ ログイン完了！");
  await page.screenshot({ path: join(screenshotsDir, "02_after_login.png") });
  await page.waitForTimeout(2000);

  // ── 記事投稿ループ ────────────────────────────────────────
  for (const [idx, article] of ARTICLES.entries()) {
    console.log(`\n📝 [${idx + 1}/${ARTICLES.length}] ${article.title.slice(0, 40)}...`);

    const body = mdToBody(join(articlesDir, article.file));

    // 新規作成ページへ
    await page.goto("https://note.com/notes/new", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(screenshotsDir, `0${3 + idx * 3}_editor_open.png`) });

    // ── タイトル入力 ─────────────────────────────────────
    // note.com のタイトルはcontenteditable div
    const titleSelectors = [
      '[data-placeholder*="タイトル"]',
      '.editor-title [contenteditable]',
      'div[contenteditable="true"].title',
      'h1[contenteditable="true"]',
      '[class*="title"][contenteditable="true"]',
    ];

    let titleFilled = false;
    for (const sel of titleSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 3000 })) {
          await el.click();
          await page.keyboard.press("Control+a");
          await page.keyboard.type(article.title, { delay: 20 });
          titleFilled = true;
          console.log(`  ✅ タイトル入力 (${sel})`);
          break;
        }
      } catch { /* 次のセレクタへ */ }
    }

    if (!titleFilled) {
      // フォールバック: 最初のcontenteditable
      const editables = page.locator('[contenteditable="true"]');
      const count = await editables.count();
      console.log(`  ℹ️  contenteditable要素 ${count}個。最初の要素を使用。`);
      if (count > 0) {
        await editables.first().click();
        await page.keyboard.press("Control+a");
        await page.keyboard.type(article.title, { delay: 20 });
      }
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(screenshotsDir, `0${4 + idx * 3}_title_filled.png`) });

    // ── 本文入力 ─────────────────────────────────────────
    // Tabキーで本文エリアに移動するか、ProseMirrorを直接クリック
    const bodySelectors = [
      '.ProseMirror',
      '[data-placeholder*="本文"]',
      '[class*="body"][contenteditable="true"]',
      '.note-body [contenteditable="true"]',
    ];

    let bodyFilled = false;
    for (const sel of bodySelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 3000 })) {
          await el.click();
          // クリップボード経由で貼り付け
          await page.evaluate((text) => {
            const el = document.activeElement;
            const dt = new DataTransfer();
            dt.setData("text/plain", text);
            el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
          }, body);
          await page.waitForTimeout(2000);
          bodyFilled = true;
          console.log(`  ✅ 本文入力 (${sel})`);
          break;
        }
      } catch { /* 次へ */ }
    }

    if (!bodyFilled) {
      // Tabで本文エリアに移動
      await page.keyboard.press("Tab");
      await page.waitForTimeout(500);
      await page.evaluate((text) => {
        const el = document.activeElement;
        const dt = new DataTransfer();
        dt.setData("text/plain", text);
        el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
      }, body);
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: join(screenshotsDir, `0${5 + idx * 3}_body_filled.png`) });

    // ── 公開 ────────────────────────────────────────────
    const publishSelectors = [
      'button:has-text("公開")',
      'button:has-text("投稿")',
      '[data-cy="publish-button"]',
      'button[class*="publish"]',
    ];

    let published = false;
    for (const sel of publishSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 5000 })) {
          await btn.click();
          console.log(`  ✅ 公開ボタンクリック (${sel})`);
          published = true;
          break;
        }
      } catch { /* 次へ */ }
    }

    if (!published) {
      console.log("  ⚠️  公開ボタン未検出。5秒後に手動クリックを待ちます...");
      await page.waitForTimeout(5000);
    }

    await page.waitForTimeout(1500);

    // 確認ダイアログの「公開する」
    try {
      const confirmBtn = page.locator('button:has-text("公開する"), button:has-text("投稿する")').first();
      if (await confirmBtn.isVisible({ timeout: 4000 })) {
        await confirmBtn.click();
        console.log("  ✅ 公開確認ダイアログをクリック");
      }
    } catch { /* ダイアログなし */ }

    // 公開完了URLの確認
    try {
      await page.waitForURL(/note\.com\/.+\/n\/n[a-z0-9]+/, { timeout: 20000 });
      console.log(`  🎉 公開完了: ${page.url()}`);
    } catch {
      console.log(`  ⚠️  URL変化なし。現在のURL: ${page.url()}`);
    }

    await page.screenshot({ path: join(screenshotsDir, `0${6 + idx * 3}_published.png`) });

    if (idx < ARTICLES.length - 1) {
      console.log("  ⏳ 5秒後に次の記事へ...");
      await page.waitForTimeout(5000);
    }
  }

  console.log("\n🎉 全記事の投稿完了！");
  console.log(`📸 スクリーンショット: ${screenshotsDir}`);

  await page.waitForTimeout(5000);
  await browser.close();
}

main().catch((e) => {
  console.error("❌ エラー:", e.message);
  process.exit(1);
});
