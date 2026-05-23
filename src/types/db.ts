// Supabase テーブルの TypeScript 型
// 生成ツール (supabase gen types) を使うのが理想だが、ここでは手書きで定義
export type UUID = string;
export type ISODate = string;

export type Profile = {
  id: UUID;
  email: string | null;
  display_name: string | null;
  is_admin: boolean;
  is_premium: boolean;
  daily_ai_used: number;
  daily_ai_reset_at: string;
  created_at: ISODate;
  updated_at: ISODate;
};

export type Level =
  | "中学基礎" | "高校基礎"
  | "大学受験基礎" | "大学受験標準" | "大学受験難関"
  | "英検5級" | "英検4級" | "英検3級" | "英検準2級" | "英検2級" | "英検準1級"
  | "TOEIC基礎" | "TOEIC標準" | "TOEIC高得点"
  | "自作単語" | "苦手単語" | "学校の小テスト" | "参考書別単語";

export const LEVELS: Level[] = [
  "中学基礎","高校基礎",
  "大学受験基礎","大学受験標準","大学受験難関",
  "英検5級","英検4級","英検3級","英検準2級","英検2級","英検準1級",
  "TOEIC基礎","TOEIC標準","TOEIC高得点",
  "自作単語","苦手単語","学校の小テスト","参考書別単語",
];

export type WordBook = {
  id: UUID;
  user_id: UUID;
  title: string;
  description: string | null;
  level: Level | null;
  exam_type: string | null;
  source_type: "custom" | "material" | "system";
  source_material_id: UUID | null;
  created_at: ISODate;
  updated_at: ISODate;
};

export type Word = {
  id: UUID;
  user_id: UUID;
  word_book_id: UUID | null;
  word: string;
  meaning: string;
  pos: string | null;
  phonetic: string | null;
  example: string | null;
  example_ja: string | null;
  etymology: string | null;
  nuance: string | null;
  similar_words: string | null;
  antonym: string | null;
  derivative: string | null;
  idiom: string | null;
  tags: string[];
  importance: number;
  mastery: number;
  last_studied_at: ISODate | null;
  next_review_at: ISODate | null;
  correct_count: number;
  wrong_count: number;
  streak: number;
  is_weak: boolean;
  material_id: UUID | null;
  source_id: string | null;
  license_status: string;
  created_at: ISODate;
  updated_at: ISODate;
};

export type Material = {
  id: UUID;
  title: string;
  publisher: string | null;
  author: string | null;
  description: string | null;
  level: string | null;
  exam_type: string | null;
  source_url: string | null;
  license_id: UUID | null;
  license_status: string;
  license_note: string | null;
  is_public: boolean;
  created_at: ISODate;
  updated_at: ISODate;
};

export type MaterialWord = {
  id: UUID;
  material_id: UUID;
  unit_id: UUID | null;
  word: string;
  meaning: string;
  pos: string | null;
  example: string | null;
  example_ja: string | null;
  importance: number;
  frequency: number;
  level: string | null;
  display_order: number;
};

export type StudyMode = "choice" | "input" | "review";
