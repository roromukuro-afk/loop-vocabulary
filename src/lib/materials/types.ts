/**
 * プリセット教材パックの標準フォーマット。
 *
 * `materials`/`material_words`（DBスキーマ）に直接対応する項目と、
 * アプリ内の導線表示のみに使う付加メタデータ（学年・目的・推奨期間など）を分けている。
 * 付加メタデータはDBカラムを追加せず、`src/lib/materials/presetMeta.ts`経由で
 * 画面表示時にのみ使う（教材IDをキーにしたコード側のレジストリ）。
 */

/** DB(material_words.pos)は自由入力のtextだが、品質チェックのため許容値を固定する */
export const ALLOWED_POS = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "preposition",
  "conjunction",
  "pronoun",
  "interjection",
  "phrase",
] as const;
export type PartOfSpeech = (typeof ALLOWED_POS)[number];

/** material_words.importance は 1..5 の整数（DB制約はないが運用上の範囲） */
export const DIFFICULTY_MIN = 1;
export const DIFFICULTY_MAX = 5;

/**
 * アプリ内導線で使うタグの許容セット（想定外タグの混入を防ぐ）。
 * "大学受験向け"・"TOEIC対策"・"日常会話"・"重要語"・"完成・発展" は既存31教材への
 * presetMeta拡張（DBスキーマ変更なし・表示専用）で追加した。
 */
export const ALLOWED_TAGS = [
  "はじめての人におすすめ",
  "中学生向け",
  "高校生向け",
  "英検対策",
  "大学受験基礎",
  "大学受験向け",
  "TOEIC対策",
  "日常会話",
  "短期集中",
  "基礎固め",
  "動詞強化",
  "重要語",
  "完成・発展",
] as const;
export type PresetTag = (typeof ALLOWED_TAGS)[number];

/** "toeic"・"general"（日常会話・学び直し）は既存31教材への presetMeta 拡張で追加した */
export const ALLOWED_CATEGORIES = [
  "junior",
  "highschool",
  "eiken",
  "university",
  "toeic",
  "general",
] as const;
export type PresetCategory = (typeof ALLOWED_CATEGORIES)[number];

export type PresetWordEntry = {
  word: string;
  meaning: string;
  pos: PartOfSpeech;
  example: string;
  example_ja: string;
  /** 1(易)〜5(難)。DBの material_words.importance にそのまま入る */
  difficulty: number;
};

export type PresetMaterialPack = {
  /** 固定UUID。再実行しても同じ教材を指すように毎回このIDで upsert する */
  id: string;
  title: string;
  /** materials.level に入る値（既存教材の表記規則に合わせる） */
  level: string;
  /** materials.exam_type に入る値 */
  examType: string;
  /** 対象学年（DB非保存・表示専用） */
  grade: string;
  /** 目的（DB非保存・表示専用） */
  purpose: string;
  /** 推奨学習期間（週。DB非保存・表示専用） */
  recommendedWeeks: number;
  /** 1日あたりの目安語数（DB非保存・表示専用） */
  dailyWordTarget: number;
  category: PresetCategory;
  tags: PresetTag[];
  /**
   * 確認テスト(PDF)対象にするか / SRS対象にするか。
   * 現状の実装では、インポートされた単語は自動的にPDFテスト・SRS復習の両方で
   * 利用可能になる（除外する仕組みは無い）ため、実質的には常にtrueになる想定。
   * 将来「暗記対象外の参考語彙」等を作る場合に備えたメタデータとして残す。
   */
  testTarget: boolean;
  srsTarget: boolean;
  /** materials.description に入る値 */
  description: string;
  words: PresetWordEntry[];
};
