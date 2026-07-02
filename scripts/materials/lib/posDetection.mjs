/**
 * material_words の品詞(pos)未設定行に対する「補完候補」検出ロジック（監査・dry-run計画で共有）。
 *
 * このモジュールはDBを一切変更しない。分類結果を返すだけ。
 *
 * 設計方針:
 * ・既存のpos表記は教材ごとにバラバラ（"名詞"/"noun"/"n" 等が混在）。
 *   教材ごとに最も多く使われている表記方式（scheme）を検出し、補完時はその教材の
 *   既存表記に合わせる（表記の統一感を壊さないため）。
 * ・「同じword+同じmeaningで既に他教材にposが設定されている」場合は、そのpos文字列を
 *   そのまま流用する（実データからの裏付けがあるため）。
 * ・辞書（閉じた品詞クラス）・意味パターンによる推定は、ユーザー指定の5ルールのみを
 *   「自動補完候補」として扱う。それ以外はすべて「慎重に扱う」に分類する。
 */

// ---- 既存pos表記 → 正規化タグ の対応表 ----
// 複数品詞をまとめた表記（"n/v" 等）は複数タグを返す。
const RAW_POS_TAG_MAP = {
  "名詞": ["NOUN"], "noun": ["NOUN"], "n": ["NOUN"],
  "動詞": ["VERB"], "verb": ["VERB"], "v": ["VERB"],
  "形容詞": ["ADJ"], "adjective": ["ADJ"], "adj": ["ADJ"],
  "副詞": ["ADV"], "adverb": ["ADV"], "adv": ["ADV"],
  "前置詞": ["PREP"], "preposition": ["PREP"], "prep": ["PREP"],
  "接続詞": ["CONJ"], "conjunction": ["CONJ"], "conj": ["CONJ"],
  "代名詞": ["PRON"], "pronoun": ["PRON"], "pron": ["PRON"],
  "冠詞": ["DET"], "det": ["DET"], "determiner": ["DET"],
  "感嘆詞": ["INTJ"], "間投詞": ["INTJ"], "interjection": ["INTJ"],
  "数詞": ["NUM"], "疑問詞": ["PRON"], "助動詞": ["VERB"],
  "phrase": ["PHRASE"], "フレーズ": ["PHRASE"], "表現": ["PHRASE"],
  "動詞句": ["PHRASE"], "副詞句": ["PHRASE"], "前置詞句": ["PHRASE"], "接続詞句": ["PHRASE"], "助動詞句": ["PHRASE"],
};

// 複合表記("v/n", "noun/verb", "動詞/名詞", "verb, noun" 等)をトークンに分解する
function splitCompoundPos(raw) {
  return raw.split(/[/,、・]|\s+,\s*/).map((s) => s.trim()).filter(Boolean);
}

export function normalizeRawPos(raw) {
  if (!raw) return { tags: [], recognized: false };
  const lower = raw.trim().toLowerCase();
  const parts = lower.includes("/") || lower.includes(",") || lower.includes("、")
    ? splitCompoundPos(lower)
    : [lower];
  const tags = new Set();
  let recognized = false;
  for (const p of parts) {
    const t = RAW_POS_TAG_MAP[p] ?? RAW_POS_TAG_MAP[raw.trim()]; // 日本語部分は元表記でも引き直す
    if (t) { t.forEach((x) => tags.add(x)); recognized = true; }
  }
  return { tags: [...tags], recognized };
}

// ---- 教材ごとの表記方式(scheme family) ----
const SCHEME_FAMILIES = {
  ja_full: { NOUN: "名詞", VERB: "動詞", ADJ: "形容詞", ADV: "副詞", PREP: "前置詞", CONJ: "接続詞", PRON: "代名詞", DET: "冠詞", INTJ: "感嘆詞", NUM: "数詞" },
  en_abbr: { NOUN: "n", VERB: "v", ADJ: "adj", ADV: "adv", PREP: "prep", CONJ: "conj", PRON: "pron", DET: "det", INTJ: "interjection", NUM: "n" },
  en_full: { NOUN: "noun", VERB: "verb", ADJ: "adjective", ADV: "adverb", PREP: "preposition", CONJ: "conjunction", PRON: "pronoun", DET: "det", INTJ: "interjection", NUM: "noun" },
};
const DEFAULT_SCHEME_FAMILY = "en_abbr"; // 教材内に手がかりが全く無い場合のコーパス全体での最多派

// 単一タグ(複合表記でない)の行だけを使って、教材の主流表記を判定する
function detectMaterialScheme(nonNullRowsInMaterial) {
  const counts = { ja_full: 0, en_abbr: 0, en_full: 0 };
  for (const r of nonNullRowsInMaterial) {
    const raw = (r.pos ?? "").trim().toLowerCase();
    if (!raw || raw.includes("/") || raw.includes(",") || raw.includes("、")) continue; // 複合表記は除外
    for (const [family, map] of Object.entries(SCHEME_FAMILIES)) {
      if (Object.values(map).some((v) => v.toLowerCase() === raw)) counts[family]++;
    }
  }
  let best = null, bestCount = 0;
  for (const [family, c] of Object.entries(counts)) {
    if (c > bestCount) { best = family; bestCount = c; }
  }
  return best ?? null; // 手がかりが無ければnull（呼び出し側でデフォルトにフォールバック）
}

function posStringFor(canonTag, schemeFamily) {
  const family = SCHEME_FAMILIES[schemeFamily] ? schemeFamily : DEFAULT_SCHEME_FAMILY;
  return SCHEME_FAMILIES[family][canonTag] ?? SCHEME_FAMILIES[DEFAULT_SCHEME_FAMILY][canonTag];
}

// ---- 閉じた品詞クラス（辞書）----
const PRONOUNS = new Set([
  "i", "me", "my", "mine", "myself", "you", "your", "yours", "yourself", "yourselves",
  "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself",
  "we", "us", "our", "ours", "ourselves", "they", "them", "their", "theirs", "themselves",
  "who", "whom", "whose", "someone", "something", "somebody", "anyone", "anything", "anybody",
  "everyone", "everything", "everybody", "nothing", "nobody",
]);
// since/until/before/after（接続詞との兼用）、up/down/off/over/through（副詞との兼用）は
// 誤判定リスクがあるため意図的に除外している
const PREPOSITIONS = new Set([
  "in", "on", "at", "by", "for", "with", "about", "against", "between", "into",
  "during", "above", "below", "to", "from", "of", "under", "without", "within",
  "along", "across", "behind", "beyond", "near", "among", "throughout", "upon",
  "toward", "towards", "via", "despite", "except", "per", "versus",
]);
// while/though/since/than/as/yet（前置詞・副詞との兼用や多義）は誤判定リスクがあるため除外している
const CONJUNCTIONS = new Set([
  "and", "but", "or", "nor", "so", "although", "because", "unless", "whether",
]);
const DETERMINERS = new Set(["a", "an", "the"]);
const CLOSED_CLASS_MAP = new Map([
  ...[...PRONOUNS].map((w) => [w, "PRON"]),
  ...[...PREPOSITIONS].map((w) => [w, "PREP"]),
  ...[...CONJUNCTIONS].map((w) => [w, "CONJ"]),
  ...[...DETERMINERS].map((w) => [w, "DET"]),
]);

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
  "hundred", "thousand", "million", "billion", "dozen",
  "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
];
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MONTHS = [
  "january", "february", "march", "april", "may", "june", "july", "august", "september",
  "october", "november", "december",
];
// 形容詞・名詞としての用法もある語（still/even/only/just/yet/now/then/today/tomorrow/
// yesterday/alone/forward/away 等）は誤判定リスクがあるため意図的に除外している。
const BASIC_ADVERBS = [
  "always", "never", "often", "sometimes", "usually", "rarely", "seldom", "again",
  "already", "soon", "here", "there", "very", "too", "also", "quite", "almost",
  "together", "ago", "abroad", "indoors", "outdoors",
];
const FIXED_CLASS_MAP = new Map([
  ...NUMBER_WORDS.map((w) => [w, "NUM"]),
  ...WEEKDAYS.map((w) => [w, "NOUN"]),
  ...MONTHS.map((w) => [w, "NOUN"]),
  ...BASIC_ADVERBS.map((w) => [w, "ADV"]),
]);

function isMultiWord(word) {
  return /\s/.test((word ?? "").trim());
}

// ---- コーパス横断の索引構築 ----
// rows: material_words全行（word/meaning/pos/material_id等を含む）
export function buildPosIndex(rows) {
  // exactKey: material横断でword(小文字trim)+meaning(trim)が一致するもの
  const exactIndex = new Map(); // `${wordLower}${meaning}` -> [{pos, materialId}]
  // wordIndex: material横断でword(小文字trim)のみが一致するもの（意味は問わない）
  const wordIndex = new Map(); // wordLower -> [{pos, meaning, materialId}]
  // materialNonNullRows: material_id -> 非null posの行配列（教材のscheme判定用）
  const materialNonNullRows = new Map();

  for (const r of rows) {
    if (!r.material_id) continue;
    if (!materialNonNullRows.has(r.material_id)) materialNonNullRows.set(r.material_id, []);
    if (r.pos) materialNonNullRows.get(r.material_id).push(r);

    if (!r.pos || !r.word) continue;
    const wLower = r.word.trim().toLowerCase();
    const mTrim = (r.meaning ?? "").trim();

    const ek = `${wLower}${mTrim}`;
    if (!exactIndex.has(ek)) exactIndex.set(ek, []);
    exactIndex.get(ek).push({ pos: r.pos, materialId: r.material_id });

    if (!wordIndex.has(wLower)) wordIndex.set(wLower, []);
    wordIndex.get(wLower).push({ pos: r.pos, meaning: mTrim, materialId: r.material_id });
  }

  const materialScheme = new Map();
  for (const [materialId, nonNull] of materialNonNullRows) {
    materialScheme.set(materialId, detectMaterialScheme(nonNull));
  }

  return { exactIndex, wordIndex, materialScheme };
}

/**
 * 1行分の分類結果を返す。
 * 戻り値: {
 *   rule: string,                 // 適用ルールID
 *   confidence: "auto" | "caution",
 *   candidatePos: string | null,  // 補完する場合の値（cautionの場合はnull）
 *   reason: string,               // 人間向けの説明
 *   evidence: object | null,      // 根拠(参照行数・教材名など)
 * }
 */
export function classifyNullPosRow(row, index) {
  const word = (row.word ?? "").trim();
  const meaning = (row.meaning ?? "").trim();
  const wLower = word.toLowerCase();

  // 0. 熟語・句動詞（複数語）は常に慎重に扱う（最優先チェック）
  if (isMultiWord(word)) {
    return { rule: "multi_word_phrase", confidence: "caution", candidatePos: null, reason: "複数語（熟語・句動詞の可能性）のため自動判定しない", evidence: null };
  }

  // 意味が短すぎる（1文字以下）ものは慎重に扱う
  if (meaning.length <= 1) {
    return { rule: "meaning_too_short", confidence: "caution", candidatePos: null, reason: `meaningが短すぎて品詞を推定できない ("${meaning}")`, evidence: null };
  }

  const scheme = index.materialScheme.get(row.material_id) ?? DEFAULT_SCHEME_FAMILY;

  // 1. 同じword+同じmeaningで、他教材にposが設定済み（最優先の自動補完ルール）
  const exactMatches = (index.exactIndex.get(`${wLower}${meaning}`) ?? []).filter((m) => m.materialId !== row.material_id || true);
  if (exactMatches.length > 0) {
    const posValues = new Set(exactMatches.map((m) => m.pos.trim()));
    if (posValues.size === 1) {
      return {
        rule: "exact_word_meaning_match",
        confidence: "auto",
        candidatePos: [...posValues][0],
        reason: `同じword「${word}」+同じmeaning「${meaning}」が他${exactMatches.length}箇所で見つかり、posは全て一致`,
        evidence: { matchCount: exactMatches.length },
      };
    }
    // meaning完全一致だがposが割れている場合は慎重に扱う（矛盾データのため）
  }

  // 2. 明らかな代名詞・前置詞・接続詞・冠詞
  if (CLOSED_CLASS_MAP.has(wLower)) {
    const tag = CLOSED_CLASS_MAP.get(wLower);
    return {
      rule: "closed_class_function_word",
      confidence: "auto",
      candidatePos: posStringFor(tag, scheme),
      reason: `代名詞・前置詞・接続詞・冠詞の固定辞書に一致（${tag}）`,
      evidence: { tag },
    };
  }

  // 3. 数詞・曜日・月・基本副詞など、品詞がほぼ固定のもの
  if (FIXED_CLASS_MAP.has(wLower)) {
    const tag = FIXED_CLASS_MAP.get(wLower);
    return {
      rule: "closed_class_fixed_pos",
      confidence: "auto",
      candidatePos: posStringFor(tag, scheme),
      reason: `数詞・曜日・月・基本副詞の固定辞書に一致（${tag}）`,
      evidence: { tag },
    };
  }

  // 4. meaningに「〜する」とあり、動詞と判断しやすいもの
  if (/する$/.test(meaning) && meaning !== "する") {
    return {
      rule: "meaning_pattern_verb",
      confidence: "auto",
      candidatePos: posStringFor("VERB", scheme),
      reason: `meaningが「〜する」で終わる（"${meaning}"）ため動詞と推定`,
      evidence: null,
    };
  }

  // 5. meaningに「〜な」「〜の」とあり、形容詞と判断しやすいもの
  if (/(な|の)$/.test(meaning) && meaning.length >= 2) {
    return {
      rule: "meaning_pattern_adjective",
      confidence: "auto",
      candidatePos: posStringFor("ADJ", scheme),
      reason: `meaningが「〜な/〜の」で終わる（"${meaning}"）ため形容詞と推定`,
      evidence: null,
    };
  }

  // 6.（追加提案・ユーザー確認推奨）同じwordのみ一致（意味は問わない）で、
  //    見つかった全posが単一の正規化タグに一致する場合
  const wordMatches = index.wordIndex.get(wLower) ?? [];
  if (wordMatches.length > 0) {
    const tagSet = new Set();
    let allRecognized = true;
    for (const m of wordMatches) {
      const { tags, recognized } = normalizeRawPos(m.pos);
      if (!recognized || tags.length === 0) { allRecognized = false; continue; }
      tags.forEach((t) => tagSet.add(t));
    }
    if (tagSet.size === 1 && allRecognized) {
      const soleTag = [...tagSet][0];
      return {
        rule: "consistent_word_pos_match",
        confidence: "auto_secondary", // ユーザー承認時に別枠で提示する追加提案ルール
        candidatePos: posStringFor(soleTag, scheme),
        reason: `同じword「${word}」が他${wordMatches.length}箇所（意味は不問）に存在し、posは全て${soleTag}系で一致`,
        evidence: { matchCount: wordMatches.length, tag: soleTag },
      };
    }
    if (tagSet.size > 1) {
      return {
        rule: "ambiguous_multi_pos",
        confidence: "caution",
        candidatePos: null,
        reason: `同じword「${word}」に複数の品詞（${[...tagSet].join("/")}）が他教材で見つかったため自動判定しない`,
        evidence: { tags: [...tagSet] },
      };
    }
  }

  // それ以外は判断材料なし
  return { rule: "no_signal_needs_review", confidence: "caution", candidatePos: null, reason: "日本語訳・辞書・他教材のいずれからも品詞を判定する手がかりが得られなかった", evidence: null };
}

export { detectMaterialScheme, DEFAULT_SCHEME_FAMILY };
