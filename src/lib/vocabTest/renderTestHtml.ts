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

// 4択(choice)には正解1つ+ダミー3つの計4つの選択肢が要る。rows自体が4件未満(または
// word+meaning重複除去後に4件未満)だと、ダミー抽出が3件に満たず選択肢が欠けた
// 壊れた問題が生成される。呼び出し側(UI)のvalidationだけに依存せず、この共有
// render関数自身もfail-closedにする(/pdf・公開ツールいずれの呼び出し経路でも
// 同じ保護がかかるようにするため)。
export const MIN_CHOICE_ROWS = 4;

// 4択の選択肢は「画面に表示される答えの値」がdistinctである必要がある。row自体が
// 別でも答え側の値が同じなら選択肢としては重複表示になり得るため(例: 異なる4つの
// 英単語がすべて「果物」と訳される場合、word+meaningのペアとしては4件distinctでも、
// 選択肢に使える答えの値としては1種類しかない)。ガード・ダミー抽出のいずれも、
// rowではなくanswer側の値のdistinct集合を基準にする。
export function countUniqueAnswers(rows: Row[], direction: Direction): number {
  const values = direction === "en2ja" ? rows.map((r) => r.meaning) : rows.map((r) => r.word);
  return new Set(values).size;
}

// 4択では、同じ「画面に表示されるprompt」が複数rowにまたがって異なる答えを持つと
// (例: word="bank"に対しmeaning="銀行"の行とmeaning="土手"の行が両方ある場合)、
// 同じ見出しの問題が2問生成され、しかも片方の正解がもう片方の問題ではダミー
// 選択肢として紛れ込み得る。答えが一意に定まらず採点不能になるため、
// choice形式ではこの状態を検出してfail-closedにする(Codexレビュー指摘対応)。
export function findConflictingPrompt(rows: Row[], direction: Direction): string | null {
  const seen = new Map<string, string>();
  for (const r of rows) {
    const prompt = direction === "en2ja" ? r.word : r.meaning;
    const answer = direction === "en2ja" ? r.meaning : r.word;
    const existingAnswer = seen.get(prompt);
    if (existingAnswer !== undefined && existingAnswer !== answer) {
      return prompt;
    }
    seen.set(prompt, answer);
  }
  return null;
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
  if (format === "choice") {
    if (countUniqueAnswers(rows, direction) < MIN_CHOICE_ROWS) {
      throw new Error(`4択形式には、答えの種類が異なる組み合わせが最低${MIN_CHOICE_ROWS}種類必要です`);
    }
    if (findConflictingPrompt(rows, direction) !== null) {
      throw new Error("4択形式には使えない組み合わせがあります(同じ単語に複数の異なる意味が登録されているため、正解を一意に決められません)");
    }
  }
  // 選択肢のダミーは「答え側のdistinctな値」から抽出する(row単位でサンプリングすると、
  // 複数rowが同じ答えを持つ場合に選択肢が重複表示され、正解が2つ以上見えることがある)。
  const allAnswerValues = direction === "en2ja" ? rows.map((r) => r.meaning) : rows.map((r) => r.word);
  const uniqueAnswerValues = [...new Set(allAnswerValues)];

  const items = rows.map((r, i) => {
    const prompt = direction === "en2ja" ? r.word : r.meaning;
    const answer = direction === "en2ja" ? r.meaning : r.word;
    if (format === "choice") {
      // 4 択: 正解自身を除いたdistinctな答えの値からダミーを抽出
      const distinctOthers = uniqueAnswerValues.filter((v) => v !== answer);
      const others = sampleLocal(distinctOthers, 3);
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
    li { font-size: 11pt; margin-bottom: 5mm; line-height: 1.6; break-inside: avoid; -webkit-column-break-inside: avoid; page-break-inside: avoid; overflow-wrap: anywhere; }
    .prompt { font-weight: 500; }
    .ans-line { display:inline-block; min-width: 45mm; border-bottom: 1px solid #243860; margin-left: 3mm; }
    .choices { display:flex; flex-wrap:wrap; gap: 5mm; font-size:10pt; margin-top:1.5mm; }
    .choices span { overflow-wrap: anywhere; max-width: 100%; }
    .sheet { }
    .answer-sheet { page-break-before: always; }
    .answers-title { font-size: 13pt; margin: 0 0 4mm; border-bottom: 2px solid #243860; padding-bottom: 2mm; }
    .answers.inline { margin-top: 10mm; border-top: 1px dashed #6b87b3; padding-top: 5mm; }
    .answers.inline h2 { font-size: 12pt; margin: 0 0 3mm; }
    ol.answers-list { padding-left: 8mm; }
    ol.answers-list.cols2 { column-count: 2; column-gap: 10mm; }
    ol.answers-list li { font-size: 10pt; margin-bottom: 1.5mm; line-height: 1.5; overflow-wrap: anywhere; }
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
