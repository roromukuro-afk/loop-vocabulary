/**
 * 学習系テストモード共通の出題単語選定ロジック（src/lib/learning/wordSelection.ts）の単体テスト。
 *
 * 「未学習単語より既出単語ばかり出る」バグ修正（4択テスト）で追加し、その後
 * input/typing/listening/attackの全モードへ同じロジックを横展開した際に対象を拡張。
 * 実装本体を直接importして検証する（Node 24 の .ts 型ストリップを利用、追加設定不要）。
 * 全モードが同一のsrc/lib/learning/wordSelection.tsを利用するため、ここでのテストが
 * 全モード共通の正しさを保証する（モードごとの重複テストは不要）。
 *
 * SRS本体（applySrsV2によるease_factor/interval_days/correct_count/wrong_count/
 * is_weakの更新）は saveStudyResult 経由で /review 画面と共有しており、
 * 既に npm run test:srs（実ブラウザE2E、DB検証込み）でカバー済みのためここでは
 * 重複させない。ここでは「出題選定・選択肢生成」ロジックのみを対象にする。
 *
 * 使い方: node scripts/testing/test-learning-selection.mjs
 * （npm run test:quiz / npm run test:learning-selection のいずれからも実行可能）
 */
import {
  classifyWordState,
  selectQuizWords,
  pickDistractors,
} from "../../src/lib/learning/wordSelection.ts";

let pass = 0;
let fail = 0;

function assertTrue(cond, label) {
  if (cond) { pass++; console.log(`✅ ${label}`); }
  else { fail++; console.error(`❌ FAIL: ${label}`); }
}

function assertEqual(actual, expected, label) {
  assertTrue(actual === expected, `${label} (got=${JSON.stringify(actual)}, expected=${JSON.stringify(expected)})`);
}

const NOW = new Date("2026-07-03T00:00:00.000Z");
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

function iso(offsetMs) {
  return new Date(NOW.getTime() + offsetMs).toISOString();
}

function makeWord(overrides) {
  return {
    id: overrides.id,
    word: overrides.word ?? overrides.id,
    meaning: overrides.meaning ?? `意味-${overrides.id}`,
    pos: overrides.pos ?? "verb",
    importance: overrides.importance ?? 3,
    correct_count: overrides.correct_count ?? 0,
    wrong_count: overrides.wrong_count ?? 0,
    is_weak: overrides.is_weak ?? false,
    next_review_at: overrides.next_review_at ?? null,
    interval_days: overrides.interval_days ?? 0,
    ease_factor: overrides.ease_factor ?? 2.5,
    last_studied_at: overrides.last_studied_at ?? null,
    streak: overrides.streak ?? 0,
    ...overrides,
  };
}

// ============================================================
// classifyWordState
// ============================================================
console.log("\n--- classifyWordState ---");

assertEqual(
  classifyWordState(makeWord({ id: "a" }), NOW),
  "unseen",
  "correct_count=0 かつ wrong_count=0 かつ last_studied_at=null は unseen",
);

assertEqual(
  classifyWordState(
    makeWord({ id: "b", correct_count: 1, next_review_at: iso(-HOUR) }),
    NOW,
  ),
  "due",
  "next_review_at が過去なら due（is_weak/masteredより優先）",
);

assertEqual(
  classifyWordState(
    makeWord({ id: "c", is_weak: true, correct_count: 2, next_review_at: iso(DAY) }),
    NOW,
  ),
  "weak",
  "is_weak=true かつ next_review_at が未来なら weak",
);

assertEqual(
  classifyWordState(
    makeWord({
      id: "d", correct_count: 6, wrong_count: 0, interval_days: 20,
      is_weak: false, next_review_at: iso(10 * DAY),
    }),
    NOW,
  ),
  "mastered",
  "正解数十分・間隔が長く・次回復習が先で・苦手でないなら mastered",
);

assertEqual(
  classifyWordState(
    makeWord({ id: "e", correct_count: 1, wrong_count: 1, next_review_at: iso(DAY) }),
    NOW,
  ),
  "learning",
  "累計解答数が少なければ learning",
);

assertEqual(
  classifyWordState(
    makeWord({
      id: "f", correct_count: 4, wrong_count: 1, interval_days: 5,
      next_review_at: iso(2 * DAY),
    }),
    NOW,
  ),
  "reviewing",
  "学習継続中だがmastered/learning/weak/dueいずれでもなければ reviewing",
);

assertEqual(
  classifyWordState(
    makeWord({
      id: "g", correct_count: 8, interval_days: 30, next_review_at: iso(-HOUR),
    }),
    NOW,
  ),
  "due",
  "mastered相当でも復習期限が来ていれば due に再分類される（出さない、ではなく期限が来たら出す）",
);

// ============================================================
// selectQuizWords: 出題順テスト
// ============================================================
console.log("\n--- selectQuizWords ---");

{
  const pool = [
    makeWord({ id: "u1" }), // unseen
    makeWord({ id: "u2" }), // unseen
    makeWord({ id: "m1", correct_count: 8, interval_days: 30, next_review_at: iso(30 * DAY) }), // mastered
    makeWord({ id: "m2", correct_count: 8, interval_days: 30, next_review_at: iso(30 * DAY) }), // mastered
    makeWord({ id: "d1", correct_count: 2, next_review_at: iso(-HOUR) }), // due
  ];
  const selected = selectQuizWords(pool, 2, { now: NOW });
  const ids = selected.map((w) => w.id);
  assertTrue(
    ids.includes("u1") && ids.includes("u2"),
    "未学習単語が単語帳に残っている場合、未学習単語が優先的に選ばれる",
  );
}

{
  // 全て既習（unseenなし）の場合、dueが優先的に選ばれる（重み付きだが多数回試行で有意差を確認）
  const pool = [
    makeWord({ id: "d1", correct_count: 2, next_review_at: iso(-HOUR) }),
    makeWord({ id: "d2", correct_count: 2, next_review_at: iso(-HOUR) }),
    makeWord({ id: "mst1", correct_count: 8, interval_days: 30, next_review_at: iso(30 * DAY) }),
    makeWord({ id: "mst2", correct_count: 8, interval_days: 30, next_review_at: iso(30 * DAY) }),
    makeWord({ id: "mst3", correct_count: 8, interval_days: 30, next_review_at: iso(30 * DAY) }),
    makeWord({ id: "mst4", correct_count: 8, interval_days: 30, next_review_at: iso(30 * DAY) }),
  ];
  let dueCount = 0;
  const trials = 300;
  for (let i = 0; i < trials; i++) {
    const selected = selectQuizWords(pool, 1, { now: NOW });
    if (selected[0].id.startsWith("d")) dueCount++;
  }
  // due単語は2/6だが重みが高いため、単純な比率(33%)より有意に高く選ばれるはず
  assertTrue(
    dueCount / trials > 0.45,
    `全て既習なら復習期限(due)の単語が優先的に選ばれる（due選択率=${(dueCount / trials * 100).toFixed(0)}% > 45%）`,
  );
}

{
  // 苦手単語が適度に混ざる（0にはならない）が、mastered/reviewingも完全排除されない
  const pool = [
    makeWord({ id: "w1", is_weak: true, correct_count: 1, next_review_at: iso(DAY) }),
    makeWord({ id: "w2", is_weak: true, correct_count: 1, next_review_at: iso(DAY) }),
    makeWord({ id: "r1", correct_count: 4, wrong_count: 1, interval_days: 5, next_review_at: iso(2 * DAY) }),
    makeWord({ id: "r2", correct_count: 4, wrong_count: 1, interval_days: 5, next_review_at: iso(2 * DAY) }),
    makeWord({ id: "mst1", correct_count: 8, interval_days: 30, next_review_at: iso(30 * DAY) }),
    makeWord({ id: "mst2", correct_count: 8, interval_days: 30, next_review_at: iso(30 * DAY) }),
  ];
  const seenStates = new Set();
  for (let i = 0; i < 200; i++) {
    const selected = selectQuizWords(pool, 3, { now: NOW });
    for (const w of selected) seenStates.add(classifyWordState(w, NOW));
  }
  assertTrue(seenStates.has("weak"), "苦手単語(weak)が出題候補に含まれる（0にならない）");
  assertTrue(seenStates.has("mastered"), "定着済み(mastered)単語も完全には排除されない");
}

{
  // 定着済みは頻度が下がる（reviewingより出現率が低いはず）
  const pool = [
    makeWord({ id: "r1", correct_count: 4, wrong_count: 1, interval_days: 5, next_review_at: iso(2 * DAY) }),
    makeWord({ id: "r2", correct_count: 4, wrong_count: 1, interval_days: 5, next_review_at: iso(2 * DAY) }),
    makeWord({ id: "mst1", correct_count: 8, interval_days: 30, next_review_at: iso(30 * DAY) }),
    makeWord({ id: "mst2", correct_count: 8, interval_days: 30, next_review_at: iso(30 * DAY) }),
  ];
  let reviewingCount = 0;
  let masteredCount = 0;
  const trials = 400;
  for (let i = 0; i < trials; i++) {
    const [w] = selectQuizWords(pool, 1, { now: NOW });
    const state = classifyWordState(w, NOW);
    if (state === "reviewing") reviewingCount++;
    if (state === "mastered") masteredCount++;
  }
  assertTrue(
    reviewingCount > masteredCount,
    `定着済み(mastered)単語は同数存在するreviewingより出現頻度が低い（reviewing=${reviewingCount} > mastered=${masteredCount}）`,
  );
}

{
  // 直近出題済み単語の除外（プールに十分な余裕がある場合）
  const pool = Array.from({ length: 10 }, (_, i) => makeWord({ id: `x${i}` }));
  const excludeIds = pool.slice(0, 8).map((w) => w.id); // 8/10を除外
  const selected = selectQuizWords(pool, 2, { now: NOW, excludeIds });
  const selectedIds = selected.map((w) => w.id);
  assertTrue(
    selectedIds.every((id) => !excludeIds.includes(id)),
    "十分な代替候補がある場合、直近出題済み単語は除外される",
  );
}

{
  // 除外すると必要数を満たせない小さい単語帳では、除外を解除して出題を継続する
  const pool = Array.from({ length: 4 }, (_, i) => makeWord({ id: `y${i}` }));
  const excludeIds = pool.map((w) => w.id); // 全件除外指定
  const selected = selectQuizWords(pool, 4, { now: NOW, excludeIds });
  assertEqual(selected.length, 4, "除外すると出題不能になる小規模単語帳では除外を解除し出題を継続する");
}

{
  // n >= pool.length（attackモードの「プール全体を優先順に並べた出題キュー」用途）
  // でも、unseenが必ず先頭にまとまって並ぶことを確認する
  const pool = [
    makeWord({ id: "u1" }),
    makeWord({ id: "u2" }),
    makeWord({ id: "u3" }),
    makeWord({ id: "d1", correct_count: 2, next_review_at: iso(-HOUR) }),
    makeWord({ id: "mst1", correct_count: 8, interval_days: 30, next_review_at: iso(30 * DAY) }),
  ];
  const queue = selectQuizWords(pool, pool.length, { now: NOW });
  assertEqual(queue.length, pool.length, "n=pool.lengthで指定すると全件が返る（出題キューとして使える）");
  assertEqual(new Set(queue.map((w) => w.id)).size, pool.length, "出題キューに重複がない（全件が1回ずつ）");
  const firstThreeIds = queue.slice(0, 3).map((w) => w.id).sort();
  assertEqual(
    JSON.stringify(firstThreeIds),
    JSON.stringify(["u1", "u2", "u3"]),
    "出題キューの先頭は必ずunseen単語で占められる",
  );
}

// ============================================================
// pickDistractors: 四択選択肢テスト
// ============================================================
console.log("\n--- pickDistractors ---");

{
  const correct = makeWord({ id: "c1", word: "apple", meaning: "りんご", pos: "noun" });
  const pool = [
    correct,
    makeWord({ id: "c2", word: "book", meaning: "本", pos: "noun" }),
    makeWord({ id: "c3", word: "run", meaning: "走る", pos: "verb" }),
    makeWord({ id: "c4", word: "happy", meaning: "幸せな", pos: "adjective" }),
    makeWord({ id: "c5", word: "dog", meaning: "犬", pos: "noun" }),
  ];
  const distractors = pickDistractors(correct, pool, 3, "en2ja");
  assertEqual(distractors.length, 3, "distractorが3件返る");
  assertTrue(!distractors.includes(correct.meaning), "正解の意味がdistractorに含まれない");
  assertTrue(new Set(distractors).size === distractors.length, "distractor同士で重複がない");
  assertTrue(distractors.every((d) => d && d.trim().length > 0), "空欄のdistractorがない");
}

{
  // 同じ意味の単語がある場合、正解と同じテキストのdistractorは除外される
  const correct = makeWord({ id: "s1", word: "big", meaning: "大きい", pos: "adjective" });
  const pool = [
    correct,
    makeWord({ id: "s2", word: "large", meaning: "大きい", pos: "adjective" }), // 同じ意味
    makeWord({ id: "s3", word: "small", meaning: "小さい", pos: "adjective" }),
    makeWord({ id: "s4", word: "tall", meaning: "背が高い", pos: "adjective" }),
    makeWord({ id: "s5", word: "short", meaning: "短い", pos: "adjective" }),
  ];
  const distractors = pickDistractors(correct, pool, 3, "en2ja");
  assertTrue(!distractors.includes("大きい"), "正解と同じ意味のdistractorは選ばれない（複数正解の事故を防ぐ）");
}

{
  // 4択全体として正解が1つだけ含まれることを確認（buildQuestions相当の統合確認）
  const correct = makeWord({ id: "t1", word: "eat", meaning: "食べる", pos: "verb" });
  const pool = [
    correct,
    makeWord({ id: "t2", word: "drink", meaning: "飲む", pos: "verb" }),
    makeWord({ id: "t3", word: "sleep", meaning: "眠る", pos: "verb" }),
    makeWord({ id: "t4", word: "walk", meaning: "歩く", pos: "verb" }),
  ];
  const distractors = pickDistractors(correct, pool, 3, "en2ja");
  const choices = [correct.meaning, ...distractors];
  const correctCount = choices.filter((c) => c === correct.meaning).length;
  assertEqual(choices.length, 4, "選択肢が4つ揃う");
  assertEqual(correctCount, 1, "正解が選択肢内に必ず1つだけ存在する");
}

{
  // 品詞が同じ候補を優先することの確認（統計的に、同じposの候補がある場合は優先的に選ばれる）
  const correct = makeWord({ id: "p1", word: "run", meaning: "走る", pos: "verb" });
  const pool = [
    correct,
    makeWord({ id: "p2", word: "walk", meaning: "歩く", pos: "verb" }),
    makeWord({ id: "p3", word: "jump", meaning: "跳ぶ", pos: "verb" }),
    makeWord({ id: "p4", word: "swim", meaning: "泳ぐ", pos: "verb" }),
    makeWord({ id: "p5", word: "book", meaning: "本", pos: "noun" }),
    makeWord({ id: "p6", word: "car", meaning: "車", pos: "noun" }),
  ];
  let sameVerbCount = 0;
  const trials = 100;
  for (let i = 0; i < trials; i++) {
    const distractors = pickDistractors(correct, pool, 3, "en2ja");
    sameVerbCount += distractors.filter((d) => ["歩く", "跳ぶ", "泳ぐ"].includes(d)).length;
  }
  // verb候補が3件しかなくちょうどcount=3のため、ほぼ毎回同じ品詞3件で埋まるはず
  assertTrue(
    sameVerbCount / trials >= 2.9,
    `同じ品詞の候補が十分にある場合、優先的に選ばれる（平均${(sameVerbCount / trials).toFixed(2)}/3件 >= 2.9）`,
  );
}

{
  // 極小プールでも厳密フィルタで不足する場合はフォールバックで必要数を満たす
  const correct = makeWord({ id: "f1", word: "cat", meaning: "猫", pos: "noun" });
  const pool = [
    correct,
    makeWord({ id: "f2", word: "cat2", meaning: "猫", pos: "noun" }), // 同じ意味(除外される)
    makeWord({ id: "f3", word: "dog", meaning: "犬", pos: "noun" }),
    makeWord({ id: "f4", word: "bird", meaning: "鳥", pos: "noun" }),
  ];
  const distractors = pickDistractors(correct, pool, 3, "en2ja");
  assertTrue(distractors.length <= 2, "同じ意味の候補は除外されるため、プールが小さいと3件に満たない場合がある（フォールバックの限界を確認）");
  assertTrue(new Set(distractors).size === distractors.length, "フォールバック時も重複は発生しない");
}

console.log(`\n=== test:learning-selection RESULT: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
