/**
 * note.com 下書き修正・公開＋アカウント設定 v7
 * - ChromeクッキーをDPAPI + AES-GCMで復号
 * - Playwrightにクッキーを注入（ログイン不要）
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, copyFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import Database from "better-sqlite3";
import { createDecipheriv } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const articlesDir = join(__dirname, "..", "note-articles");
const ssDir = join(__dirname, "..", "note-screenshots-v7");
mkdirSync(ssDir, { recursive: true });

const CHROME_USER_DATA = process.env.LOCALAPPDATA + "\\Google\\Chrome\\User Data";
const COOKIES_PATH    = CHROME_USER_DATA + "\\Default\\Network\\Cookies";
const LOCAL_STATE     = CHROME_USER_DATA + "\\Local State";
const TMP_COOKIES     = process.env.TEMP + "\\chrome_cookies_note.db";

const DRAFTS = [
  {
    noteId: "nc79c657b7934",
    file: "01_wasurenai-tango-kioku.md",
    title: "英単語、何度やっても覚えられない人へ。「忘却曲線」を使ったら3ヶ月で1,000語定着した話",
  },
  {
    noteId: "nc4eb765b00f2",
    file: "02_toeic-tango-houhou.md",
    title: "TOEIC 730点 → 900点。スコアが上がらない原因は「単語の覚え方」にありました",
  },
  {
    noteId: "n94653af2252d",
    file: "03_eitango-app-hikaku.md",
    title: "【2026年版】英単語アプリを本気で使い比べた結果、違いがはっきりわかった",
  },
];

const PROFILE = {
  displayName: "Loop Vocabulary",
  bio: "英語学習アプリ「Loop Vocabulary」の公式note。忘却曲線を活用した英単語学習法・TOEIC/英検対策を発信中。アプリ無料🔗 https://loop-vocabulary.vercel.app",
  websiteUrl: "https://loop-vocabulary.vercel.app",
};

// ─── Chrome クッキー復号 ─────────────────────────────────────
function getAesKey() {
  const ps1 = join(__dirname, "get-chrome-aeskey.ps1");
  const result = execSync(
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`,
    { encoding: "utf8" }
  ).trim();
  return Buffer.from(result, "base64");
}

function decryptCookieValue(aesKey, encryptedValue) {
  // Chrome v80+: v10 + 12バイトIV + 暗号文 + 16バイトタグ
  if (encryptedValue.length < 31) return null;
  const prefix = encryptedValue.slice(0, 3).toString();
  if (prefix !== "v10" && prefix !== "v11") return null;
  const iv  = encryptedValue.slice(3, 15);
  const tag = encryptedValue.slice(encryptedValue.length - 16);
  const ct  = encryptedValue.slice(15, encryptedValue.length - 16);
  try {
    const decipher = createDecipheriv("aes-256-gcm", aesKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function extractNoteCookies() {
  console.log("🍪 Chromeクッキーを抽出・復号中...");
  // Cookiesファイルをコピー（ロック回避）
  copyFileSync(COOKIES_PATH, TMP_COOKIES);
  const aesKey = getAesKey();
  const db = new Database(TMP_COOKIES, { readonly: true });

  const rows = db.prepare(
    `SELECT name, encrypted_value, domain, path, expires_utc, is_secure, is_httponly, samesite
     FROM cookies WHERE host_key LIKE '%note.com%' ORDER BY name`
  ).all();

  db.close();
  console.log(`  note.comクッキー: ${rows.length}件`);

  const cookies = rows.map(row => {
    const encBuf = Buffer.from(row.encrypted_value);
    const decrypted = decryptCookieValue(aesKey, encBuf);
    return {
      name:     row.name,
      value:    decrypted || "",
      domain:   row.domain,
      path:     row.path,
      expires:  row.expires_utc > 0 ? (row.expires_utc / 1_000_000 - 11644473600) : -1,
      secure:   !!row.is_secure,
      httpOnly: !!row.is_httponly,
      sameSite: row.samesite === 0 ? "Strict" : row.samesite === 1 ? "Lax" : "None",
    };
  }).filter(c => c.value !== "");

  console.log(`  復号成功: ${cookies.length}件`);
  return cookies;
}

// ─── ユーティリティ ─────────────────────────────────────────
function mdToBody(mdPath) {
  const text = readFileSync(mdPath, "utf-8");
  return text.replace(/^#\s.+\n\n?/, "").trim();
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pasteText(page, text) {
  await page.evaluate(t => {
    const dt = new DataTransfer();
    dt.setData("text/plain", t);
    document.activeElement.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })
    );
  }, text);
  await sleep(1500);
}

async function fillTitle(page, title) {
  const found = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("[contenteditable], [data-placeholder]"));
    const el = all.find(e => {
      const ph = e.getAttribute("data-placeholder") || "";
      return (ph.includes("タイトル") || ph.includes("title")) && e.offsetHeight > 0;
    });
    if (el) { el.focus(); el.innerText = ""; return true; }
    const nonProse = all.find(e =>
      e.getAttribute("contenteditable") !== null && !e.classList.contains("ProseMirror") && e.offsetHeight > 0
    );
    if (nonProse) { nonProse.focus(); nonProse.innerText = ""; return true; }
    return false;
  });
  if (!found) await page.mouse.click(640, 200);
  await sleep(200);
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
  await sleep(100);
  await page.keyboard.type(title, { delay: 20 });
  console.log("  ✅ タイトル入力");
}

async function fillBody(page, bodyText) {
  const pm = page.locator(".ProseMirror").first();
  if (await pm.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pm.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Delete");
    await sleep(300);
    await pasteText(page, bodyText);
    console.log("  ✅ 本文入力");
  }
}

async function dismissDialog(page) {
  try {
    const btn = page.locator('button:has-text("閉じる")').first();
    if (await btn.isVisible({ timeout: 1000 })) { await btn.click(); await sleep(400); }
  } catch { /* なし */ }
}

async function publishArticle(page, label) {
  await dismissDialog(page);
  const goBtn = page.locator('button:has-text("公開に進む")').first();
  if (!await goBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await page.screenshot({ path: join(ssDir, `${label}_nopub.png`) });
    return null;
  }
  await goBtn.click();
  console.log("  ✅ 「公開に進む」クリック");
  await sleep(2500);
  await page.screenshot({ path: join(ssDir, `${label}_modal.png`) });

  if (await page.locator('text="タイトル、本文を入力してください"').isVisible({ timeout: 1000 }).catch(() => false)) {
    console.log("  ⚠️  タイトルエラー → 再試行");
    await dismissDialog(page);
    return null;
  }

  const confirmBtn = page.locator('button:has-text("公開する"), button:has-text("投稿する")').first();
  if (await confirmBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await confirmBtn.click();
    console.log("  ✅ 「公開する」確認");
  }

  try {
    await page.waitForURL(/note\.com\/.+\/n\/n[a-z0-9]+/, { timeout: 20000 });
    console.log(`  🎉 公開完了: ${page.url()}`);
    return page.url();
  } catch {
    console.log(`  ⚠️  URL変化なし: ${page.url()}`);
    return null;
  }
}

async function setupProfile(page) {
  console.log("\n⚙️  アカウント設定...");
  await page.goto("https://note.com/settings/profile", { waitUntil: "domcontentloaded" });
  await sleep(3000);
  await page.screenshot({ path: join(ssDir, "acct_01.png") });

  for (const sel of ['input[name="nickname"]', 'input[name="name"]', 'input[placeholder*="ニックネーム"]']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click({ clickCount: 3 }); await el.fill(PROFILE.displayName);
      console.log("  ✅ 表示名:", PROFILE.displayName); break;
    }
  }
  for (const sel of ['textarea[name="description"]', 'textarea[name="bio"]', 'textarea[placeholder*="自己紹介"]', 'textarea[placeholder*="プロフィール"]']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click({ clickCount: 3 }); await el.fill(PROFILE.bio);
      console.log("  ✅ プロフィール文設定"); break;
    }
  }
  for (const sel of ['input[name="website_url"]', 'input[name="url"]', 'input[placeholder*="URL"]', 'input[type="url"]']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click({ clickCount: 3 }); await el.fill(PROFILE.websiteUrl);
      console.log("  ✅ ウェブサイト:", PROFILE.websiteUrl); break;
    }
  }

  await page.screenshot({ path: join(ssDir, "acct_02.png") });
  for (const sel of ['button:has-text("保存")', 'button[type="submit"]']) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click(); console.log("  ✅ プロフィール保存"); await sleep(2000); break;
    }
  }
  await page.screenshot({ path: join(ssDir, "acct_03.png") });
}

// ─── メイン ─────────────────────────────────────────────────
async function main() {
  // 1. クッキー抽出
  const cookies = extractNoteCookies();
  if (cookies.length === 0) {
    console.log("❌ note.comクッキーが見つかりませんでした。Chromeでnote.comにログインしてから再実行してください。");
    process.exit(1);
  }

  // 2. Playwright 起動
  console.log("🚀 Playwright (Chromium) 起動...");
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "ja-JP",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });

  // 3. クッキー注入
  await context.addCookies(cookies);
  console.log(`✅ ${cookies.length}件のクッキーを注入`);

  const page = await context.newPage();

  // 4. note.com ログイン確認
  await page.goto("https://note.com/", { waitUntil: "domcontentloaded" });
  await sleep(3000);
  await page.screenshot({ path: join(ssDir, "00_notecom.png") });

  const isLogin = page.url().includes("/login");
  if (isLogin) {
    console.log("⚠️  クッキーが無効 — note.comのセッションが期限切れです");
    console.log("   Chromeでnote.comにログインしてから再実行してください");
    await browser.close();
    process.exit(1);
  }
  console.log("✅ note.comログイン確認");

  // 5. 下書き修正・公開
  const publishedUrls = [];
  for (const [idx, draft] of DRAFTS.entries()) {
    console.log(`\n📝 [${idx + 1}/3] ${draft.title.slice(0, 40)}...`);
    const body = mdToBody(join(articlesDir, draft.file));

    await page.goto(`https://editor.note.com/notes/${draft.noteId}/edit/`, { waitUntil: "domcontentloaded" });
    await sleep(4000);

    if (page.url().includes("/login")) {
      console.log("  ⚠️  ログインにリダイレクト (このドラフトはこのアカウントにない可能性)");
      await page.screenshot({ path: join(ssDir, `${idx + 1}_noauth.png`) });
      continue;
    }

    const editorOk = await page.waitForSelector(".ProseMirror", { timeout: 20000 }).then(() => true).catch(() => false);
    if (!editorOk) {
      console.log("  ⚠️  エディタロード失敗");
      await page.screenshot({ path: join(ssDir, `${idx + 1}_fail.png`) });
      continue;
    }

    await dismissDialog(page);
    await page.screenshot({ path: join(ssDir, `${idx + 1}a.png`) });

    await fillTitle(page, draft.title);
    await sleep(600);
    await page.screenshot({ path: join(ssDir, `${idx + 1}b.png`) });

    await fillBody(page, body);
    await sleep(800);
    await page.screenshot({ path: join(ssDir, `${idx + 1}c.png`) });

    let url = await publishArticle(page, `${idx + 1}`);
    if (!url) {
      console.log("  🔄 再試行...");
      await fillTitle(page, draft.title);
      await sleep(400);
      url = await publishArticle(page, `${idx + 1}r`);
    }
    if (url) publishedUrls.push(url);
    await page.screenshot({ path: join(ssDir, `${idx + 1}d.png`) });
    if (idx < DRAFTS.length - 1) await sleep(4000);
  }

  console.log("\n📊 公開済みURL:");
  publishedUrls.forEach((u, i) => console.log(`  [${i + 1}] ${u}`));

  // 6. アカウント設定
  await setupProfile(page);

  console.log("\n🎉 完了！");
  console.log(`📸 スクリーンショット: ${ssDir}`);
  await sleep(5000);
  await browser.close();
}

main().catch(e => {
  console.error("❌ エラー:", e.message);
  process.exit(1);
});
