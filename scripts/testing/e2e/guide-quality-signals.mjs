/**
 * 上位ガイド記事の品質シグナル（対象者・出典・最終更新日・更新履歴）確認（Phase 6）。
 *
 * 使い方: node scripts/testing/e2e/guide-quality-signals.mjs
 */
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

const REWRITTEN_GUIDES = [
  "eitango-oboeru-houhou",
  "spaced-repetition-english-vocabulary",
  "flashcards-vs-multiple-choice",
  "ai-vocabulary-learning",
  "listening-and-pronunciation-vocabulary",
];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;

  try {
    for (const slug of REWRITTEN_GUIDES) {
      const res = await fetch(`${baseUrl}/guide/${slug}`);
      if (res.status !== 200) {
        fail(`/guide/${slug}: 200で取得できない`);
        continue;
      }
      const html = await res.text();

      if (html.includes("対象者:")) ok(`/guide/${slug}: 対象者が明示されている`);
      else fail(`/guide/${slug}: 対象者の明示がない`);

      if (html.includes("出典・参考:")) ok(`/guide/${slug}: 出典・参考が明示されている`);
      else fail(`/guide/${slug}: 出典・参考の明示がない`);

      // Reactがハイドレーション境界用に<!-- -->をテキストと変数の間に挿入することがあるため
      // (例: "最終更新日: <!-- -->2026-07-12")、コメントを除去してから判定する。
      const textOnly = html.replace(/<!--.*?-->/g, "");
      if (/最終更新日: ?\d{4}-\d{2}-\d{2}/.test(textOnly)) ok(`/guide/${slug}: 最終更新日が明示されている`);
      else fail(`/guide/${slug}: 最終更新日の明示がない`);

      if (html.includes("更新履歴:")) ok(`/guide/${slug}: 更新履歴がある`);
      else fail(`/guide/${slug}: 更新履歴がない`);

      // 誇張・保証表現が混入していないことも合わせて確認。
      // 「〜を保証するものではありません」という既存の免責文言と紐づく部分文字列を
      // 誤検出しないよう、guides-content.mjs と同じ禁止表現リストを使う。
      const BANNED = ["合格を保証", "必ず覚えられる", "成績が必ず上がる", "必ず伸びる", "合格実績"];
      const found = BANNED.filter((p) => html.includes(p));
      if (found.length === 0) ok(`/guide/${slug}: 誇張・保証表現が含まれていない`);
      else fail(`/guide/${slug}: 禁止表現が含まれている: ${found.join(", ")}`);
    }

    console.log(process.exitCode ? "\n=== test:guide-quality-signals: FAILED ===" : "\n=== test:guide-quality-signals RESULT: all checks passed ===");
  } finally {
    stopDevServer(dev);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
