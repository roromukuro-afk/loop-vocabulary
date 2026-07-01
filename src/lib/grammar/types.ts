// 英文法レッスン（Loop Grammar）のデータ型
// Notionの複数教材を横断統合してアプリ独自レッスンに再構成するための構造。

export type Block =
  | { type: "p"; text: string }
  | { type: "sub"; text: string } // セクション内の小見出し
  | { type: "callout"; tone: "key" | "tip" | "warn"; title?: string; text: string }
  | { type: "example"; en: string; jp: string; point?: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; items: string[] }
  | {
      type: "quiz";
      prompt: string;
      rows: { q: string; a: string; exp: string }[];
    };

export type Section = {
  heading: string;
  blocks: Block[];
};

export type LevelKey = "chugaku" | "kanko" | "juken";

export type Lesson = {
  slug: string;
  levelKey: LevelKey;
  order: number;
  shortTitle: string; // ナビ用（例: 冠詞）
  title: string; // ページ見出し
  metaTitle: string; // <title>用
  description: string; // SEO description
  keywords: string;
  heroLead: string; // ヒーロー説明文
  readTime: string;
  sections: Section[];
  relatedVocab?: { id: string; title: string }[];
  relatedGuides?: { slug: string; title: string }[];
};

export const LEVELS: Record<LevelKey, { label: string; tag: string; gradient: string }> = {
  chugaku: {
    label: "中学英文法（基礎〜完成）",
    tag: "中学英文法",
    gradient: "from-teal-600 to-teal-800",
  },
  kanko: {
    label: "高校英文法（基礎固め）",
    tag: "高校英文法",
    gradient: "from-sky-600 to-sky-800",
  },
  juken: {
    label: "大学受験・難関英文法",
    tag: "大学受験",
    gradient: "from-navy-700 to-navy-950",
  },
};
