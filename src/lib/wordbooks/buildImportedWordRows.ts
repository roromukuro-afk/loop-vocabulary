export interface SourceWord {
  word: string;
  meaning: string;
  pos: string | null;
  phonetic: string | null;
  importance: number;
}

/**
 * 共有元の単語(id列を含まないselect結果)を、インポート先ownerの新規行へ変換する。
 *
 * 出力objectに`id`というown propertyを一切持たせないこと(値をnull/undefinedにする
 * のではなく、キー自体を存在させない)。Supabase JS clientはbulk array insertの際、
 * 配列内の各objectが同じキー集合を持つ前提でリクエストを組み立てるため、キーを
 * `undefined`にして「存在させたつもり」でも、シリアライズ時にNULLへ変換され、
 * words.id(NOT NULL)制約違反を起こす(単一object insertでは発生しないため
 * 見逃されやすい)。
 */
export function buildImportedWordRows(words: SourceWord[], userId: string, wordBookId: string) {
  return words.map((w) => ({
    word: w.word,
    meaning: w.meaning,
    pos: w.pos,
    phonetic: w.phonetic,
    importance: w.importance,
    user_id: userId,
    word_book_id: wordBookId,
  }));
}
