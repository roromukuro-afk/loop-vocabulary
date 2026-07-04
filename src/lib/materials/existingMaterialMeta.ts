/**
 * 既存31教材（seed-vocabで投入済み、新規4スターターパック以外）への表示専用メタデータ。
 *
 * `materials`テーブルにgrade/purpose/recommendedWeeks/dailyWordTarget/category/tagsの
 * カラムは追加していない（DBスキーマ変更なし）。このファイルは教材ID(materials.id)を
 * キーにした純粋なコード側レジストリで、presetMeta.tsが新規4パック由来のメタデータと
 * マージして`getPresetMeta()`から返す。
 *
 * grade/purpose/recommendedWeeks/dailyWordTargetは、各教材のtitle・level・exam_type・
 * 語数から自然に推定できる範囲でのみ設定した（市販教材の説明文の転載はしていない）。
 * 推定が難しい・幅広い対象を持つ教材は、断定的な学年表記を避け「社会人・学び直し」
 * 「高校生・大学生」のような汎用的な表記にしている。
 * recommendedWeeksはおおよそ 語数 ≈ dailyWordTarget × 7 × recommendedWeeks となるよう
 * 概算した目安であり、実際の学習ペースを保証するものではない。
 */
import type { PresetMeta } from "./presetMeta";

export const EXISTING_MATERIAL_META: Record<string, PresetMeta> = {
  // --- 中学・高校入試 ---
  "00000000-0000-0000-0000-000000000010": {
    grade: "中学1年〜",
    purpose: "英語学習の最初の一歩となる超基礎30語を身につける",
    recommendedWeeks: 1,
    dailyWordTarget: 5,
    category: "junior",
    tags: ["はじめての人におすすめ", "中学生向け", "基礎固め"],
  },
  "00000000-0000-0000-0000-000000000045": {
    grade: "中学1-3年",
    purpose: "中学英語の全語彙を体系的に完成させ高校入試の土台を作る",
    recommendedWeeks: 20,
    dailyWordTarget: 14,
    category: "junior",
    tags: ["中学生向け", "基礎固め", "重要語"],
  },
  "00000000-0000-0000-0000-000000000046": {
    grade: "中学3年〜高校1年",
    purpose: "高校入試の出題頻度分析にもとづく必須語彙で得点力を仕上げる",
    recommendedWeeks: 15,
    dailyWordTarget: 15,
    category: "junior",
    tags: ["中学生向け", "高校生向け", "重要語"],
  },
  "00000000-0000-0000-0000-000000000021": {
    grade: "中学1-2年",
    purpose: "中学英語の基礎・標準レベル語彙を固める",
    recommendedWeeks: 2,
    dailyWordTarget: 8,
    category: "junior",
    tags: ["中学生向け", "基礎固め"],
  },

  // --- 高校基礎〜大学受験 ---
  "00000000-0000-0000-0000-000000000047": {
    grade: "高校1-2年",
    purpose: "高校基礎の教科書語彙と大学受験の土台を同時に固める",
    recommendedWeeks: 15,
    dailyWordTarget: 15,
    category: "highschool",
    tags: ["高校生向け", "大学受験向け", "基礎固め"],
  },
  "00000000-0000-0000-0000-000000000048": {
    grade: "高校2-3年",
    purpose: "共通テスト頻出語彙を短期間で総ざらいする",
    recommendedWeeks: 4,
    dailyWordTarget: 11,
    category: "university",
    tags: ["高校生向け", "大学受験向け", "短期集中"],
  },
  "00000000-0000-0000-0000-000000000049": {
    grade: "高校3年",
    purpose: "MARCH・関関同立レベルの頻出語彙で得点力を仕上げる",
    recommendedWeeks: 3,
    dailyWordTarget: 10,
    category: "university",
    tags: ["大学受験向け", "完成・発展"],
  },
  "00000000-0000-0000-0000-000000000050": {
    grade: "高校3年",
    purpose: "早慶・旧帝大レベルの難語・学術語で最終仕上げを行う",
    recommendedWeeks: 3,
    dailyWordTarget: 11,
    category: "university",
    tags: ["大学受験向け", "完成・発展"],
  },
  "00000000-0000-0000-0000-000000000044": {
    grade: "高校3年",
    purpose: "最難関大学入試を見据えた高度語彙を鍛える",
    recommendedWeeks: 12,
    dailyWordTarget: 14,
    category: "university",
    tags: ["大学受験向け", "完成・発展"],
  },
  "00000000-0000-0000-0000-000000000020": {
    grade: "高校2-3年",
    purpose: "大学入試全般で頻出する語彙を横断的に網羅する",
    recommendedWeeks: 20,
    dailyWordTarget: 14,
    category: "university",
    tags: ["大学受験向け", "重要語"],
  },
  "00000000-0000-0000-0000-000000000024": {
    grade: "高校2-3年",
    purpose: "共通テストから難関大まで幅広くカバーする受験語彙を習得する",
    recommendedWeeks: 15,
    dailyWordTarget: 15,
    category: "university",
    tags: ["大学受験向け", "重要語"],
  },
  "00000000-0000-0000-0000-000000000043": {
    grade: "高校3年",
    purpose: "難関私大入試で実際に出題された頻出語彙を集中的に鍛える",
    recommendedWeeks: 12,
    dailyWordTarget: 14,
    category: "university",
    tags: ["大学受験向け", "完成・発展"],
  },
  "00000000-0000-0000-0000-000000000040": {
    grade: "高校1年",
    purpose: "高校入学後に必要な基礎〜標準語彙を体系的に身につける",
    recommendedWeeks: 10,
    dailyWordTarget: 14,
    category: "highschool",
    tags: ["高校生向け", "基礎固め"],
  },
  "00000000-0000-0000-0000-000000000041": {
    grade: "高校2年",
    purpose: "長文読解・論述問題に対応する応用語彙を固める",
    recommendedWeeks: 12,
    dailyWordTarget: 14,
    category: "highschool",
    tags: ["高校生向け", "重要語"],
  },
  "00000000-0000-0000-0000-000000000042": {
    grade: "高校3年",
    purpose: "共通テストを見据えた大学受験直前の語彙強化を行う",
    recommendedWeeks: 15,
    dailyWordTarget: 14,
    category: "highschool",
    tags: ["高校生向け", "大学受験向け", "完成・発展"],
  },
  "00000000-0000-0000-0000-000000000030": {
    grade: "高校1年",
    purpose: "高校英語のスタートとなる基礎重要語彙を固める",
    recommendedWeeks: 15,
    dailyWordTarget: 15,
    category: "highschool",
    tags: ["高校生向け", "基礎固め"],
  },

  // --- 英検 ---
  "00000000-0000-0000-0000-000000000035": {
    grade: "小学生・中学生",
    purpose: "英検5級・4級の基礎語彙をやさしく身につける",
    recommendedWeeks: 16,
    dailyWordTarget: 14,
    category: "eiken",
    tags: ["英検対策", "はじめての人におすすめ", "基礎固め"],
  },
  "00000000-0000-0000-0000-000000000034": {
    grade: "中学生",
    purpose: "英検3級合格に向けた日常・学校生活の重要語彙を身につける",
    recommendedWeeks: 15,
    dailyWordTarget: 14,
    category: "eiken",
    tags: ["英検対策", "中学生向け"],
  },
  "00000000-0000-0000-0000-000000000033": {
    grade: "高校生",
    purpose: "英検準2級で問われる重要語彙を幅広くカバーする",
    recommendedWeeks: 15,
    dailyWordTarget: 14,
    category: "eiken",
    tags: ["英検対策", "重要語"],
  },
  "f2661c18-fb99-4ec2-888f-30e1fd012da0": {
    grade: "高校生",
    purpose: "英検2級合格に必須の頻出語彙をテーマ別に効率よく学ぶ",
    recommendedWeeks: 5,
    dailyWordTarget: 10,
    category: "eiken",
    tags: ["英検対策", "重要語"],
  },
  "00000000-0000-0000-0000-000000000022": {
    grade: "高校生",
    purpose: "英検2級で問われる重要語彙を幅広くカバーする",
    recommendedWeeks: 8,
    dailyWordTarget: 14,
    category: "eiken",
    tags: ["英検対策", "重要語"],
  },
  "5eae7c64-fcb5-4164-99fb-cdb5ce10567c": {
    grade: "高校生・大学生",
    purpose: "英検準1級合格に必須のアカデミック語彙を効率よく学ぶ",
    recommendedWeeks: 4,
    dailyWordTarget: 9,
    category: "eiken",
    tags: ["英検対策", "重要語"],
  },
  "00000000-0000-0000-0000-000000000023": {
    grade: "高校生・大学生",
    purpose: "英検準1級で問われる重要語彙・熟語を幅広くカバーする",
    recommendedWeeks: 7,
    dailyWordTarget: 13,
    category: "eiken",
    tags: ["英検対策", "重要語"],
  },
  "00000000-0000-0000-0000-000000000032": {
    grade: "大学生・社会人",
    purpose: "英検1級合格に必須の高難度語彙を習得する",
    recommendedWeeks: 15,
    dailyWordTarget: 14,
    category: "eiken",
    tags: ["英検対策", "完成・発展"],
  },

  // --- TOEIC ---
  "96d6e5a2-c0f5-48b1-8eed-14a91424790f": {
    grade: "社会人・大学生",
    purpose: "TOEIC対策の入り口となる最頻出のビジネス語彙を身につける",
    recommendedWeeks: 4,
    dailyWordTarget: 9,
    category: "toeic",
    tags: ["TOEIC対策", "はじめての人におすすめ", "基礎固め"],
  },
  "00000000-0000-0000-0000-000000000031": {
    grade: "社会人・大学生",
    purpose: "TOEIC 600〜800点を目指す頻出語彙でスコアアップの土台を作る",
    recommendedWeeks: 24,
    dailyWordTarget: 15,
    category: "toeic",
    tags: ["TOEIC対策", "重要語"],
  },

  // --- 日常会話・学び直し ---
  "00000000-0000-0000-0000-000000000054": {
    grade: "社会人・学び直し",
    purpose: "中学英語をもう一度、ゼロから学び直すための最初の1冊",
    recommendedWeeks: 5,
    dailyWordTarget: 8,
    category: "general",
    tags: ["はじめての人におすすめ", "日常会話", "基礎固め"],
  },
  "00000000-0000-0000-0000-000000000051": {
    grade: "社会人・学び直し",
    purpose: "買い物・医療・手続きなど日常のあらゆる場面で使う実用語彙を学び直す",
    recommendedWeeks: 7,
    dailyWordTarget: 10,
    category: "general",
    tags: ["日常会話", "基礎固め"],
  },
  "00000000-0000-0000-0000-000000000052": {
    grade: "社会人・学び直し",
    purpose: "旅行・ホテル・国際場面で役立つ語彙をまとめて学ぶ",
    recommendedWeeks: 15,
    dailyWordTarget: 14,
    category: "general",
    tags: ["日常会話", "基礎固め"],
  },
  "00000000-0000-0000-0000-000000000053": {
    grade: "社会人・学び直し",
    purpose: "ニュースや教養番組で使われる語彙で読む力を伸ばす",
    recommendedWeeks: 5,
    dailyWordTarget: 9,
    category: "general",
    tags: ["日常会話", "完成・発展"],
  },
  "00000000-0000-0000-0000-000000000036": {
    grade: "社会人・学び直し",
    purpose: "日常会話でよく使う実用フレーズ・語彙を身につける",
    recommendedWeeks: 15,
    dailyWordTarget: 14,
    category: "general",
    tags: ["日常会話", "基礎固め"],
  },
};
