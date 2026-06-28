/**
 * note.com 完全自動投稿スクリプト (保存済みセッション使用)
 * 事前に note-login-once.mjs でログインしておく必要があります。
 *
 * 実行: node scripts/note-post-auto.mjs
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = join(__dirname, "..", "note-session");
const ARTICLES_DIR = join(__dirname, "..", "note-articles");
const SS_DIR = join(__dirname, "..", "note-screenshots-post");
const IMG_DIR = join(__dirname, "..", "note-images");
mkdirSync(SS_DIR, { recursive: true });

if (!existsSync(SESSION_DIR)) {
  console.error("❌ セッションが見つかりません。先に note-login-once.mjs を実行してください。");
  process.exit(1);
}

const ARTICLES = [
  {
    file: "01_wasurenai-tango-kioku.md",
    title: "英単語、何度やっても覚えられない人へ。「忘却曲線」を使ったら3ヶ月で1,000語定着した話",
    imgFile: "cover1.png",
  },
  {
    file: "02_toeic-tango-houhou.md",
    title: "TOEIC 730点 → 900点。スコアが上がらない原因は「単語の覚え方」にありました",
    imgFile: "cover2.png",
  },
  {
    file: "03_eitango-app-hikaku.md",
    title: "【2026年版】英単語アプリを本気で使い比べた結果、違いがはっきりわかった",
    imgFile: "cover3.png",
  },
];

const PROFILE = {
  displayName: "Loop Vocabulary",
  bio: "英語学習アプリ「Loop Vocabulary」の公式note。忘却曲線を活用した英単語学習法・TOEIC/英検対策を発信中。アプリ無料🔗 https://loop-vocabulary.vercel.app",
  websiteUrl: "https://loop-vocabulary.vercel.app",
};

function mdToPlain(mdPath) {
  return readFileSync(mdPath, "utf-8")
    .replace(/^#\s.+\n\n?/, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^-{3,}$/gm, "")
    .replace(/^\|.+\|$/gm, m => m.replace(/\|/g, " ").replace(/\s{2,}/g, " ").trim())
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fillTitle(page, title) {
  const found = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("[contenteditable], [data-placeholder]"));
    const el = all.find(e => {
      const ph = e.getAttribute("data-placeholder") || "";
      return (ph.includes("タイトル") || ph.includes("title")) && e.offsetHeight > 0;
    });
    if (el) { el.focus(); el.innerText = ""; return "byPlaceholder"; }
    const nonProse = all.find(e =>
      e.getAttribute("contenteditable") !== null &&
      !e.classList.contains("ProseMirror") && e.offsetHeight > 0
    );
    if (nonProse) { nonProse.focus(); nonProse.innerText = ""; return "byNonProse"; }
    return null;
  });
  if (!found) await page.mouse.click(640, 180);
  await sleep(200);
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
  await sleep(100);
  await page.keyboard.type(title, { delay: 15 });
  console.log(`  ✅ タイトル入力 [${found || "coord"}]`);
}

async function fillBody(page, bodyText) {
  const pm = page.locator(".ProseMirror").first();
  if (!(await pm.isVisible({ timeout: 6000 }).catch(() => false))) { return; }
  await pm.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
  await sleep(300);
  await page.evaluate(text => {
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    document.activeElement.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })
    );
  }, bodyText);
  await sleep(2000);
  console.log("  ✅ 本文入力完了");
}

async function uploadCoverImage(page, imgPath) {
  if (!existsSync(imgPath)) { console.log("  ⚠️ 画像ファイルなし → スキップ"); return false; }
  // カバー画像ボタンを探す
  const selectors = [
    'button[aria-label*="カバー"]', 'button:has-text("カバー画像")',
    '[data-testid*="cover"]', '.p-noteEditor__addCover',
  ];
  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    if (await btn.count() > 0 && await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click(); await sleep(800);
      const fi = page.locator('input[type="file"]').first();
      if (await fi.count() > 0) {
        await fi.setInputFiles(imgPath); await sleep(3000);
        console.log("  ✅ カバー画像アップロード完了"); return true;
      }
    }
  }
  // エディタ先頭に画像を挿入 (本文内)
  try {
    const pm = page.locator(".ProseMirror").first();
    await pm.click();
    await page.keyboard.press("Control+Home"); // 先頭へ
    await sleep(200);
    // スラッシュコマンド /image
    await page.keyboard.type("/");
    await sleep(500);
    const imgMenu = page.locator('[data-testid*="image"], li:has-text("画像")').first();
    if (await imgMenu.count() > 0 && await imgMenu.isVisible({ timeout: 1000 }).catch(() => false)) {
      await imgMenu.click(); await sleep(800);
      const fi = page.locator('input[type="file"]').first();
      if (await fi.count() > 0) {
        await fi.setInputFiles(imgPath); await sleep(3000);
        console.log("  ✅ 画像挿入 (スラッシュコマンド)"); return true;
      }
    }
    await page.keyboard.press("Escape");
  } catch {}
  console.log("  ⚠️ 画像アップロードスキップ");
  return false;
}

async function publishArticle(page, label) {
  try {
    const c = page.locator('button:has-text("閉じる")').first();
    if (await c.isVisible({ timeout: 500 })) await c.click();
  } catch {}
  const goBtn = page.locator('button:has-text("公開に進む")').first();
  if (!(await goBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
    await page.screenshot({ path: join(SS_DIR, `${label}_nopub.png`) }); return null;
  }
  await goBtn.click();
  console.log("  ✅ 「公開に進む」クリック");
  await sleep(3000);
  await page.screenshot({ path: join(SS_DIR, `${label}_modal.png`) });
  if (await page.locator(':text("タイトル、本文を入力してください")').isVisible({ timeout: 500 }).catch(() => false)) {
    console.log("  ⚠️ タイトルエラー → リトライ"); return null;
  }
  const confirmBtn = page.locator('button:has-text("公開する"), button:has-text("投稿する")').first();
  if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirmBtn.click(); console.log("  ✅ 「公開する」クリック");
  }
  try {
    await page.waitForURL(/note\.com\/.+\/n\/n[a-z0-9]+/, { timeout: 30000 });
    const url = page.url();
    console.log(`  🎉 公開完了: ${url}`);
    await page.screenshot({ path: join(SS_DIR, `${label}_done.png`) });
    return url;
  } catch {
    await page.screenshot({ path: join(SS_DIR, `${label}_timeout.png`) });
    return null;
  }
}

async function setupProfile(page) {
  console.log("\n⚙️  プロフィール設定...");
  await page.goto("https://note.com/settings/profile", { waitUntil: "domcontentloaded" });
  await sleep(3000);
  await page.screenshot({ path: join(SS_DIR, "profile_01.png") });
  for (const sel of ['input[name="nickname"]','input[name="name"]','input[placeholder*="ニックネーム"]','input[placeholder*="表示名"]','input[placeholder*="アカウント名"]']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
      await el.click({ clickCount: 3 }); await el.fill(PROFILE.displayName);
      console.log("  ✅ 表示名:", PROFILE.displayName); break;
    }
  }
  for (const sel of ['textarea[name="description"]','textarea[name="bio"]','textarea[placeholder*="自己紹介"]','textarea[placeholder*="プロフィール"]']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
      await el.click({ clickCount: 3 }); await el.fill(PROFILE.bio);
      console.log("  ✅ 自己紹介設定完了"); break;
    }
  }
  for (const sel of ['input[name="website_url"]','input[name="url"]','input[placeholder*="URL"]','input[type="url"]']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
      await el.click({ clickCount: 3 }); await el.fill(PROFILE.websiteUrl);
      console.log("  ✅ WebサイトURL:", PROFILE.websiteUrl); break;
    }
  }
  await sleep(300);
  for (const sel of ['button:has-text("保存")','button[type="submit"]']) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click(); console.log("  ✅ 保存完了"); await sleep(3000); break;
    }
  }
  await page.screenshot({ path: join(SS_DIR, "profile_03.png") });
}

// ─── メイン ──────────────────────────────────────────────────
async function main() {
  console.log("====================================");
  console.log("  note.com 完全自動投稿");
  console.log("====================================\n");

  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    slowMo: 60,
    viewport: { width: 1280, height: 900 },
    locale: "ja-JP",
  });

  const page = context.pages()[0] || await context.newPage();

  // ログイン確認
  await page.goto("https://note.com/", { waitUntil: "domcontentloaded" });
  await sleep(3000);
  if (page.url().includes("/login")) {
    console.log("❌ セッション期限切れ。再度 note-login-once.mjs を実行してください。");
    await context.close(); process.exit(1);
  }
  console.log("✅ note.comログイン確認OK\n");

  // カバー画像がなければ撮影
  const needsCapture = ARTICLES.some(a => !existsSync(join(IMG_DIR, a.imgFile)));
  if (needsCapture) {
    console.log("📸 カバー画像撮影中...");
    const screenshotUrls = [
      "https://loop-vocabulary.vercel.app",
      "https://loop-vocabulary.vercel.app/vocab-check/toeic",
      "https://loop-vocabulary.vercel.app",
    ];
    const coverPage = await context.newPage();
    await coverPage.setViewportSize({ width: 1200, height: 630 });
    for (const [i, art] of ARTICLES.entries()) {
      const imgPath = join(IMG_DIR, art.imgFile);
      if (!existsSync(imgPath)) {
        try {
          await coverPage.goto(screenshotUrls[i], { waitUntil: "networkidle", timeout: 30000 });
          await sleep(2000);
          await coverPage.screenshot({ path: imgPath, clip: { x: 0, y: 0, width: 1200, height: 630 } });
          console.log(`  ✅ ${art.imgFile}`);
        } catch (e) { console.log(`  ⚠️ ${art.imgFile} 失敗`); }
      }
    }
    await coverPage.close();
    mkdirSync(IMG_DIR, { recursive: true });
  }

  // 記事投稿
  const results = [];
  for (const [idx, art] of ARTICLES.entries()) {
    const label = `art${idx + 1}`;
    console.log(`📝 [${idx + 1}/3] ${art.title.slice(0, 42)}...`);
    const body = mdToPlain(join(ARTICLES_DIR, art.file));
    const imgPath = join(IMG_DIR, art.imgFile);

    await page.goto("https://note.com/notes/new", { waitUntil: "domcontentloaded" });
    await sleep(5000);
    await page.screenshot({ path: join(SS_DIR, `${label}_01.png`) });

    if (page.url().includes("/login")) { console.log("  ❌ ログイン切れ"); continue; }

    await fillTitle(page, art.title);
    await sleep(400);
    await fillBody(page, body);
    await sleep(400);
    await page.screenshot({ path: join(SS_DIR, `${label}_02_filled.png`) });

    await uploadCoverImage(page, imgPath);
    await page.screenshot({ path: join(SS_DIR, `${label}_03_img.png`) });

    let url = await publishArticle(page, label);
    if (!url) {
      console.log("  🔄 再試行...");
      await fillTitle(page, art.title);
      await sleep(400);
      url = await publishArticle(page, `${label}_r`);
    }
    if (url) results.push({ n: idx + 1, title: art.title, url });
    if (idx < ARTICLES.length - 1) await sleep(3000);
  }

  // プロフィール設定
  await setupProfile(page);

  console.log("\n====== 完了 ======");
  console.log(`📰 公開記事 (${results.length}/3):`);
  results.forEach(r => console.log(`  [${r.n}] ${r.url}`));
  console.log(`📸 SS: ${SS_DIR}`);

  await sleep(5000);
  await context.close();
}

main().catch(e => {
  console.error("❌ エラー:", e.message);
  process.exit(1);
});
