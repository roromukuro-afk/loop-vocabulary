/**
 * note.com 完全自動投稿スクリプト
 * - Chrome cookie抽出 → Playwrightに注入
 * - 3記事を新規作成・カバー画像付きで公開
 * - アカウントプロフィール設定
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, copyFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import Database from "better-sqlite3";
import { createDecipheriv } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const articlesDir = join(__dirname, "..", "note-articles");
const ssDir = join(__dirname, "..", "note-screenshots-auto");
const imgDir = join(__dirname, "..", "note-images");
mkdirSync(ssDir, { recursive: true });
mkdirSync(imgDir, { recursive: true });

const CHROME_USER_DATA = process.env.LOCALAPPDATA + "\\Google\\Chrome\\User Data";
const COOKIES_PATH = CHROME_USER_DATA + "\\Default\\Network\\Cookies";
const TMP_COOKIES = process.env.TEMP + "\\chrome_cookies_note2.db";

const ARTICLES = [
  {
    file: "01_wasurenai-tango-kioku.md",
    title: "英単語、何度やっても覚えられない人へ。「忘却曲線」を使ったら3ヶ月で1,000語定着した話",
    imgFile: "cover1.png",
    screenshotUrl: "https://loop-vocabulary.vercel.app",
  },
  {
    file: "02_toeic-tango-houhou.md",
    title: "TOEIC 730点 → 900点。スコアが上がらない原因は「単語の覚え方」にありました",
    imgFile: "cover2.png",
    screenshotUrl: "https://loop-vocabulary.vercel.app/vocab-check/toeic",
  },
  {
    file: "03_eitango-app-hikaku.md",
    title: "【2026年版】英単語アプリを本気で使い比べた結果、違いがはっきりわかった",
    imgFile: "cover3.png",
    screenshotUrl: "https://loop-vocabulary.vercel.app",
  },
];

const PROFILE = {
  displayName: "Loop Vocabulary",
  bio: "英語学習アプリ「Loop Vocabulary」の公式note。忘却曲線を活用した英単語学習法・TOEIC/英検対策を発信中。アプリ無料🔗 https://loop-vocabulary.vercel.app",
  websiteUrl: "https://loop-vocabulary.vercel.app",
};

// ─── Cookie復号 ─────────────────────────────────────────────
function getAesKey() {
  const ps1 = join(__dirname, "get-chrome-aeskey.ps1");
  const result = execSync(
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`,
    { encoding: "utf8" }
  ).trim();
  return Buffer.from(result, "base64");
}

function decryptCookieValue(aesKey, encryptedValue) {
  if (encryptedValue.length < 31) return null;
  const prefix = encryptedValue.slice(0, 3).toString();
  if (prefix !== "v10" && prefix !== "v11") return null;
  const iv = encryptedValue.slice(3, 15);
  const tag = encryptedValue.slice(encryptedValue.length - 16);
  const ct = encryptedValue.slice(15, encryptedValue.length - 16);
  try {
    const decipher = createDecipheriv("aes-256-gcm", aesKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function extractNoteCookies() {
  console.log("🍪 Chromeクッキーを抽出中...");
  copyFileSync(COOKIES_PATH, TMP_COOKIES);
  const aesKey = getAesKey();
  const db = new Database(TMP_COOKIES, { readonly: true });
  const rows = db.prepare(
    `SELECT name, encrypted_value, domain, path, expires_utc, is_secure, is_httponly, samesite
     FROM cookies WHERE host_key LIKE '%note.com%' ORDER BY name`
  ).all();
  db.close();
  console.log(`  note.comクッキー: ${rows.length}件`);
  const cookies = rows
    .map((row) => {
      const encBuf = Buffer.from(row.encrypted_value);
      const decrypted = decryptCookieValue(aesKey, encBuf);
      return {
        name: row.name,
        value: decrypted || "",
        domain: row.domain,
        path: row.path,
        expires: row.expires_utc > 0 ? row.expires_utc / 1_000_000 - 11644473600 : -1,
        secure: !!row.is_secure,
        httpOnly: !!row.is_httponly,
        sameSite: row.samesite === 0 ? "Strict" : row.samesite === 1 ? "Lax" : "None",
      };
    })
    .filter((c) => c.value !== "");
  console.log(`  復号成功: ${cookies.length}件`);
  return cookies;
}

// ─── テキスト処理 ────────────────────────────────────────────
function mdToPlainBody(mdPath) {
  let text = readFileSync(mdPath, "utf-8");
  // タイトル行を除去
  text = text.replace(/^#\s.+\n\n?/, "");
  // マークダウン記法を整形
  text = text
    .replace(/^#{1,6}\s+/gm, "")          // 見出し##を削除
    .replace(/\*\*([^*]+)\*\*/g, "$1")     // **bold**→bold
    .replace(/\*([^*]+)\*/g, "$1")          // *italic*→italic
    .replace(/^---+$/gm, "")               // --- 区切りを削除
    .replace(/^\|.+\|$/gm, (m) =>          // テーブル行を整形
      m.replace(/\|/g, " ").replace(/\s{2,}/g, " ").trim()
    )
    .replace(/^[\s-]*\[x?\]\s*/gm, "")     // チェックボックス削除
    .replace(/`([^`]+)`/g, "$1")           // コードスパン
    .replace(/\n{3,}/g, "\n\n")            // 3連続以上の改行を2つに
    .trim();
  return text;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── カバー画像生成（Loop Vocabularyのスクショ）──────────────
async function captureCovers(browser) {
  console.log("\n📸 カバー画像を撮影中...");
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 630 });

  for (const art of ARTICLES) {
    const imgPath = join(imgDir, art.imgFile);
    try {
      await page.goto(art.screenshotUrl, { waitUntil: "networkidle", timeout: 30000 });
      await sleep(2000);
      await page.screenshot({ path: imgPath, clip: { x: 0, y: 0, width: 1200, height: 630 } });
      console.log(`  ✅ ${art.imgFile} 保存`);
    } catch (e) {
      console.log(`  ⚠️ ${art.imgFile} 撮影失敗: ${e.message}`);
    }
  }
  await page.close();
}

// ─── タイトル入力 ────────────────────────────────────────────
async function fillTitle(page, title) {
  const found = await page.evaluate((t) => {
    const all = Array.from(document.querySelectorAll("[contenteditable], [data-placeholder]"));
    const el = all.find((e) => {
      const ph = e.getAttribute("data-placeholder") || "";
      return (ph.includes("タイトル") || ph.includes("title")) && e.offsetHeight > 0;
    });
    if (el) {
      el.focus();
      el.innerText = "";
      return true;
    }
    const nonProse = all.find(
      (e) =>
        e.getAttribute("contenteditable") !== null &&
        !e.classList.contains("ProseMirror") &&
        e.offsetHeight > 0
    );
    if (nonProse) {
      nonProse.focus();
      nonProse.innerText = "";
      return true;
    }
    return false;
  }, title);

  if (!found) await page.mouse.click(640, 200);
  await sleep(200);
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
  await sleep(100);
  await page.keyboard.type(title, { delay: 15 });
  console.log("  ✅ タイトル入力完了");
}

// ─── 本文入力 ────────────────────────────────────────────────
async function fillBody(page, bodyText) {
  const pm = page.locator(".ProseMirror").first();
  if (!(await pm.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log("  ⚠️ ProseMirrorが見当たりません");
    return;
  }
  await pm.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
  await sleep(300);
  await page.evaluate((text) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    document.activeElement.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })
    );
  }, bodyText);
  await sleep(2000);
  console.log("  ✅ 本文入力完了");
}

// ─── カバー画像アップロード ──────────────────────────────────
async function uploadCoverImage(page, imgPath) {
  // note.comのカバー画像ボタンを探す
  const coverSelectors = [
    'input[type="file"]',
    'button[aria-label*="画像"]',
    'button[aria-label*="カバー"]',
    '.cover-upload',
    '[data-testid*="cover"]',
  ];

  // まず「画像を追加」系のボタンを探してクリック
  const addImgBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, label"));
    const found = btns.find(
      (b) =>
        b.textContent.includes("カバー") ||
        b.textContent.includes("画像") ||
        b.getAttribute("aria-label")?.includes("画像")
    );
    if (found) { found.click(); return true; }
    return false;
  });

  await sleep(1000);

  // ファイル入力を探す
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(imgPath);
    await sleep(3000);
    console.log("  ✅ カバー画像アップロード完了");
    return true;
  }

  // エディタ上部の「＋」メニューからも試みる
  const plusBtn = page.locator('button[aria-label*="追加"], button:has-text("＋")').first();
  if (await plusBtn.count() > 0) {
    await plusBtn.click();
    await sleep(800);
    const imgOption = page.locator('button:has-text("画像"), [role="menuitem"]:has-text("画像")').first();
    if (await imgOption.count() > 0) {
      await imgOption.click();
      await sleep(800);
      const fi = page.locator('input[type="file"]').first();
      if (await fi.count() > 0) {
        await fi.setInputFiles(imgPath);
        await sleep(3000);
        console.log("  ✅ カバー画像アップロード完了（＋メニュー経由）");
        return true;
      }
    }
  }

  console.log("  ⚠️ カバー画像アップロードをスキップ（ボタンが見つかりません）");
  return false;
}

// ─── 記事公開 ────────────────────────────────────────────────
async function publishArticle(page, label) {
  // エラーダイアログを閉じる
  try {
    const closeBtn = page.locator('button:has-text("閉じる"), button:has-text("OK")').first();
    if (await closeBtn.isVisible({ timeout: 1000 })) await closeBtn.click();
  } catch {}

  const goBtn = page.locator('button:has-text("公開に進む")').first();
  if (!(await goBtn.isVisible({ timeout: 6000 }).catch(() => false))) {
    await page.screenshot({ path: join(ssDir, `${label}_nopub.png`) });
    console.log("  ❌ 「公開に進む」ボタンが見つかりません");
    return null;
  }

  await goBtn.click();
  console.log("  ✅ 「公開に進む」クリック");
  await sleep(3000);
  await page.screenshot({ path: join(ssDir, `${label}_modal.png`) });

  // タイトルエラーチェック
  if (
    await page
      .locator('text="タイトル、本文を入力してください"')
      .isVisible({ timeout: 1000 })
      .catch(() => false)
  ) {
    console.log("  ⚠️ タイトルエラー検出 → タイトルを再入力します");
    return null;
  }

  const confirmBtn = page
    .locator('button:has-text("公開する"), button:has-text("投稿する")')
    .first();
  if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirmBtn.click();
    console.log("  ✅ 「公開する」クリック");
  }

  try {
    await page.waitForURL(/note\.com\/.+\/n\/n[a-z0-9]+/, { timeout: 25000 });
    const url = page.url();
    console.log(`  🎉 公開完了: ${url}`);
    await page.screenshot({ path: join(ssDir, `${label}_done.png`) });
    return url;
  } catch {
    await page.screenshot({ path: join(ssDir, `${label}_timeout.png`) });
    console.log(`  ⚠️ URL変化なし (現在: ${page.url()})`);
    return null;
  }
}

// ─── プロフィール設定 ─────────────────────────────────────────
async function setupProfile(page) {
  console.log("\n⚙️  プロフィール設定...");
  await page.goto("https://note.com/settings/profile", { waitUntil: "domcontentloaded" });
  await sleep(3000);
  await page.screenshot({ path: join(ssDir, "profile_01.png") });

  // 表示名
  for (const sel of [
    'input[name="nickname"]',
    'input[name="name"]',
    'input[placeholder*="ニックネーム"]',
    'input[placeholder*="表示名"]',
  ]) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click({ clickCount: 3 });
      await el.fill(PROFILE.displayName);
      console.log("  ✅ 表示名:", PROFILE.displayName);
      break;
    }
  }

  // 自己紹介
  for (const sel of [
    'textarea[name="description"]',
    'textarea[name="bio"]',
    'textarea[placeholder*="自己紹介"]',
    'textarea[placeholder*="プロフィール"]',
  ]) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click({ clickCount: 3 });
      await el.fill(PROFILE.bio);
      console.log("  ✅ 自己紹介設定完了");
      break;
    }
  }

  // URLフィールド
  for (const sel of [
    'input[name="website_url"]',
    'input[name="url"]',
    'input[placeholder*="URL"]',
    'input[type="url"]',
  ]) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click({ clickCount: 3 });
      await el.fill(PROFILE.websiteUrl);
      console.log("  ✅ WebサイトURL:", PROFILE.websiteUrl);
      break;
    }
  }

  await sleep(500);
  await page.screenshot({ path: join(ssDir, "profile_02.png") });

  // 保存
  for (const sel of ['button:has-text("保存")', 'button[type="submit"]']) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      console.log("  ✅ プロフィール保存クリック");
      await sleep(3000);
      break;
    }
  }

  await page.screenshot({ path: join(ssDir, "profile_03.png") });
  console.log("  ✅ プロフィール設定完了");
}

// ─── メイン ─────────────────────────────────────────────────
async function main() {
  // 1. Cookie抽出
  const cookies = extractNoteCookies();
  if (cookies.length === 0) {
    console.log("❌ note.comクッキーなし。Chromeでnote.comにログインしてから再実行してください。");
    process.exit(1);
  }

  // 2. Playwright起動
  console.log("\n🚀 Playwright起動...");
  const browser = await chromium.launch({
    headless: false,
    slowMo: 80,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "ja-JP",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });
  await context.addCookies(cookies);
  console.log(`✅ ${cookies.length}件のクッキーを注入`);

  // 3. カバー画像撮影（認証不要ページ）
  const coverBrowser = await chromium.launch({ headless: true });
  const coverPage = await coverBrowser.newPage();
  await coverPage.setViewportSize({ width: 1200, height: 630 });

  for (const art of ARTICLES) {
    const imgPath = join(imgDir, art.imgFile);
    try {
      await coverPage.goto(art.screenshotUrl, { waitUntil: "networkidle", timeout: 30000 });
      await sleep(2000);
      await coverPage.screenshot({ path: imgPath, clip: { x: 0, y: 0, width: 1200, height: 630 } });
      console.log(`📸 ${art.imgFile} 保存`);
    } catch (e) {
      console.log(`⚠️ カバー画像撮影失敗 (${art.imgFile}): ${e.message}`);
    }
  }
  await coverBrowser.close();

  // 4. note.comログイン確認
  const page = await context.newPage();
  await page.goto("https://note.com/", { waitUntil: "domcontentloaded" });
  await sleep(3000);
  await page.screenshot({ path: join(ssDir, "00_top.png") });

  const loggedOut =
    (await page.locator('a:has-text("ログイン"), a:has-text("新規登録")').count()) > 0 &&
    (await page.locator('[data-testid*="user"], .o-login-user, img[alt*="アバター"]').count()) === 0;

  if (loggedOut) {
    console.log("⚠️ note.comにログインできていません。Chromeでnote.comにログインしてから再実行してください。");
    console.log(`📸 現在画面: ${join(ssDir, "00_top.png")}`);
    await browser.close();
    process.exit(1);
  }
  console.log("✅ note.comログイン確認OK");

  // 5. 記事投稿
  const publishedUrls = [];
  for (const [idx, art] of ARTICLES.entries()) {
    const label = `art${idx + 1}`;
    console.log(`\n📝 [${idx + 1}/3] ${art.title.slice(0, 40)}...`);

    const body = mdToPlainBody(join(articlesDir, art.file));
    await page.goto("https://note.com/notes/new", { waitUntil: "domcontentloaded" });
    await sleep(4000);
    await page.screenshot({ path: join(ssDir, `${label}_editor.png`) });

    if (page.url().includes("/login")) {
      console.log("  ❌ ログインページにリダイレクト");
      await page.screenshot({ path: join(ssDir, `${label}_noauth.png`) });
      continue;
    }

    // タイトル
    await fillTitle(page, art.title);
    await sleep(500);

    // 本文
    await fillBody(page, body);
    await sleep(500);
    await page.screenshot({ path: join(ssDir, `${label}_filled.png`) });

    // カバー画像アップロード
    const imgPath = join(imgDir, art.imgFile);
    await uploadCoverImage(page, imgPath);
    await page.screenshot({ path: join(ssDir, `${label}_img.png`) });

    // 公開
    let url = await publishArticle(page, label);

    // 失敗した場合タイトルを再入力して再試行
    if (!url) {
      console.log("  🔄 再試行中...");
      await sleep(1000);
      await fillTitle(page, art.title);
      await sleep(500);
      url = await publishArticle(page, `${label}_retry`);
    }

    if (url) {
      publishedUrls.push({ title: art.title, url });
    }

    if (idx < ARTICLES.length - 1) await sleep(4000);
  }

  // 6. プロフィール設定
  await setupProfile(page);

  // 7. 結果表示
  console.log("\n====== 完了 ======");
  console.log("📰 公開記事:");
  publishedUrls.forEach((p, i) =>
    console.log(`  [${i + 1}] ${p.url}\n      ${p.title.slice(0, 50)}`)
  );
  console.log(`\n📸 スクリーンショット: ${ssDir}`);

  await sleep(5000);
  await browser.close();
}

main().catch((e) => {
  console.error("❌ エラー:", e.message, e.stack);
  process.exit(1);
});
