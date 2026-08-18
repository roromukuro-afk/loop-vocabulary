// PDF小テスト機能(認証版 /pdf、公開版 /tools/vocab-test-maker)で共有する型。
export type Row = { word: string; meaning: string };

export type Direction = "en2ja" | "ja2en";
export type Format = "write" | "choice";
export type Columns = 1 | 2;
export type AnswerMode = "none" | "inline" | "separate";
export type Order = "sequential" | "random";
