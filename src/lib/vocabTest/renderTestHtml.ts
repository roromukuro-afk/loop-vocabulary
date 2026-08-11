import type { AnswerMode, Columns, Direction, Format, Row } from "./types";

// このファイルはNode CLIから直接importする単体テスト
// (scripts/testing/test-vocab-test-maker-parser.mjs)の対象でもあるため、
// `@/lib/utils/shuffle`への依存を持たない(`@/`エイリアスはNext.js/webpackのみが
// 解決できる。相対import+拡張子指定はTypeScript側のimport制約に抵触するため、
// eventSchema.ts等の既存pure-testableモジュールと同じ方針でゼロ依存にする)。
// 4択のダミー選択肢抽出にのみ使う、極小のFisher-Yatesシャッフル。
function sampleLocal<T>(arr: readonly T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// `/pdf`(認証版)・`/tools/vocab-test-maker`(公開版)の両方が使う、印刷用HTML生成の
// 共通実装。認証・DB・課金には一切依存しない純粋関数。
//
// 重要: `escape()`はXSS対策の要。ユーザー入力(word/meaning)は必ずこの関数を
// 通してからHTMLへ埋め込むこと。生成したHTML文字列は最終的に
// `window.open()` + `document.write()`で新規タブへ書き込まれるため、
// エスケープ漏れは実行可能HTMLの埋め込みに直結する。
export function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

export function renderTestHtml(o: {
  rows: Row[];
  direction: Direction;
  format: Format;
  columns: Columns;
  answerMode: AnswerMode;
  title: string;
  attribution: string | null;
  qrDataUrl: string | null;
}) {
  const { rows, direction, format, columns, answerMode, title, attribution, qrDataUrl } = o;
  const items = rows.map((r, i) => {
    const prompt = direction === "en2ja" ? r.word : r.meaning;
    const answer = direction === "en2ja" ? r.meaning : r.word;
    if (format === "choice") {
      // 4 択: 他の単語からダミーを抽出
      const others = sampleLocal(rows.filter((_, j) => j !== i), 3)
        .map((p) => direction === "en2ja" ? p.meaning : p.word);
      const choices = [answer, ...others].sort(() => Math.random() - 0.5);
      return { i, prompt, answer, choices };
    }
    return { i, prompt, answer, choices: null as string[] | null };
  });

  const olClass = columns === 2 ? "cols2" : "";

  const css = `
    @page { size: A4; margin: 16mm 15mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Hiragino Sans','Noto Sans JP', sans-serif; color:#111e38; margin:0; }
    h1 { font-size: 15pt; margin: 0 0 4mm; }
    .head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 6mm; gap: 6mm; }
    .head .info { display:flex; gap: 4mm; flex-shrink:0; }
    .info-box { border:1px solid #243860; border-radius: 2px; padding: 1.5mm 4mm; font-size: 10pt; white-space:nowrap; }
    .meta { font-size: 9.5pt; color:#476394; margin: 0 0 6mm; }
    .source { font-size: 8.5pt; color:#8092b0; margin: -4mm 0 6mm; }
    ol { margin: 0; padding-left: 8mm; }
    ol.cols2 { column-count: 2; column-gap: 10mm; }
    li { font-size: 11pt; margin-bottom: 5mm; line-height: 1.6; break-inside: avoid; -webkit-column-break-inside: avoid; page-break-inside: avoid; }
    .prompt { font-weight: 500; }
    .ans-line { display:inline-block; min-width: 45mm; border-bottom: 1px solid #243860; margin-left: 3mm; }
    .choices { display:flex; flex-wrap:wrap; gap: 5mm; font-size:10pt; margin-top:1.5mm; }
    .sheet { }
    .answer-sheet { page-break-before: always; }
    .answers-title { font-size: 13pt; margin: 0 0 4mm; border-bottom: 2px solid #243860; padding-bottom: 2mm; }
    .answers.inline { margin-top: 10mm; border-top: 1px dashed #6b87b3; padding-top: 5mm; }
    .answers.inline h2 { font-size: 12pt; margin: 0 0 3mm; }
    ol.answers-list { padding-left: 8mm; }
    ol.answers-list.cols2 { column-count: 2; column-gap: 10mm; }
    ol.answers-list li { font-size: 10pt; margin-bottom: 1.5mm; line-height: 1.5; }
    @media print { .answer-sheet { page-break-before: always; } }
    .lv-footer { margin-top: 8mm; padding-top: 3mm; border-top: 1px solid #d8dfec; display: flex; align-items: center; gap: 3mm; break-inside: avoid; page-break-inside: avoid; }
    .lv-footer img { width: 14mm; height: 14mm; flex-shrink: 0; }
    .lv-footer .lv-text { font-size: 7.5pt; color: #8092b0; line-height: 1.4; }
  `;

  const footerHtml = qrDataUrl
    ? `<div class="lv-footer">
        <img src="${qrDataUrl}" alt="Loop Vocabulary QRコード" />
        <span class="lv-text">作成：Loop Vocabulary（英単語小テストを作成できます）<br/>https://loop-vocabulary.app</span>
      </div>`
    : `<div class="lv-footer"><span class="lv-text">作成：Loop Vocabulary（英単語小テストを作成できます）— https://loop-vocabulary.app</span></div>`;

  const qhtml = items.map((q) => {
    const choicesHtml = q.choices
      ? `<div class="choices">${q.choices.map((c, idx) => `<span>${["ア","イ","ウ","エ"][idx]}. ${escape(c)}</span>`).join("")}</div>`
      : `<span class="ans-line">&nbsp;</span>`;
    return `<li><span class="prompt">${escape(q.prompt)}</span> ${choicesHtml}</li>`;
  }).join("");

  const dirLabel = direction === "en2ja" ? "英 → 日" : "日 → 英";
  const fmtLabel = format === "choice" ? "4 択" : "記述";

  const answersListHtml = `<ol class="answers-list ${olClass}">${items.map((q) => `<li>${escape(q.answer)}</li>`).join("")}</ol>`;

  // 解答の配置: none=なし / inline=同ページ末尾 / separate=別ページ(解答用紙)
  let answersHtml = "";
  if (answerMode === "inline") {
    answersHtml = `<div class="answers inline"><h2>解答</h2>${answersListHtml}</div>`;
  } else if (answerMode === "separate") {
    answersHtml = `<section class="answer-sheet">
      <h1>${escape(title)} 小テスト <span style="font-size:11pt;color:#476394;">— 解答用紙</span></h1>
      <div class="meta">出題方向: ${dirLabel} / 形式: ${fmtLabel} / 全 ${items.length} 問</div>
      ${attribution ? `<div class="source">出典: ${escape(attribution)}</div>` : ""}
      ${answersListHtml}
    </section>`;
  }

  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${escape(title)} 小テスト</title>
<style>${css}</style></head><body>
<section class="sheet">
  <div class="head">
    <h1>${escape(title)} 小テスト</h1>
    <div class="info">
      <span class="info-box">氏名: ______________</span>
      <span class="info-box">日付: ___/___</span>
      <span class="info-box">得点: ____ / ${items.length}</span>
    </div>
  </div>
  <div class="meta">出題方向: ${dirLabel} / 形式: ${fmtLabel} / 全 ${items.length} 問</div>
  ${attribution ? `<div class="source">出典: ${escape(attribution)}</div>` : ""}
  <ol class="${olClass}">${qhtml}</ol>
  ${answerMode === "inline" ? answersHtml : ""}
  ${footerHtml}
</section>
${answerMode === "separate" ? answersHtml : ""}
</body></html>`;
}
