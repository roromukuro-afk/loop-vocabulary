// ============================================================
// mobile-shell ビルドスクリプト
// ------------------------------------------------------------
// Capacitor の `cap sync` には webDir が必要だが、本アプリは
// `server.url` 方式で本番 Vercel を表示する Hybrid 構成のため
// webDir には最小限のスプラッシュ HTML だけ置く。
//
// 使い方:
//   node ./scripts/build-mobile-shell.mjs
//   (npm run cap:shell から呼ばれる)
// ============================================================

import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "mobile-shell");

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, "icons"), { recursive: true });

// アイコンとマニフェストをコピー (オフライン時の表示用)
const copies = [
  ["public/manifest.json",        "manifest.json"],
  ["public/favicon.ico",          "favicon.ico"],
  ["public/icons/icon-192.png",   "icons/icon-192.png"],
  ["public/icons/icon-512.png",   "icons/icon-512.png"],
  ["public/apple-touch-icon.png", "apple-touch-icon.png"],
];
for (const [src, dst] of copies) {
  const sp = join(root, src);
  const dp = join(outDir, dst);
  if (existsSync(sp)) copyFileSync(sp, dp);
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
  <meta name="theme-color" content="#243860" />
  <link rel="icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <title>Loop Vocabulary</title>
  <style>
    html, body { margin:0; padding:0; height:100%; background:#243860; color:#fff;
                  font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif; }
    .wrap { display:flex; flex-direction:column; align-items:center; justify-content:center;
            height:100%; padding:24px; text-align:center; }
    .title { font-size:24px; font-weight:bold; margin-top:16px; }
    .sub   { font-size:13px; color:#bcdcff; margin-top:8px; }
    .spinner {
      width:42px; height:42px; border:3px solid rgba(255,255,255,0.2);
      border-top-color:#bcdcff; border-radius:50%; margin-top:24px;
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="wrap">
    <img src="/icons/icon-192.png" alt="Loop Vocabulary" width="96" height="96" style="border-radius:20px" onerror="this.style.display='none'" />
    <div class="title">Loop Vocabulary</div>
    <div class="sub">起動中…</div>
    <div class="spinner"></div>
  </div>
  <script>
    // Capacitor.server.url で本番アプリに遷移するため、このページは一瞬しか出ない。
    // ネットワークエラー等で server.url に到達できない場合に視覚的にエラーを示す。
    setTimeout(function () {
      var sub = document.querySelector('.sub');
      if (sub) sub.textContent = 'ネットワークを確認しています…';
    }, 4000);
  </script>
</body>
</html>
`;
writeFileSync(join(outDir, "index.html"), html, "utf8");

console.log("✓ mobile-shell built at", outDir);
