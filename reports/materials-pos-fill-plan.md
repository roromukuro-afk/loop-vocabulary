# 教材データ 品詞(pos)補完 dry-run計画

> 自動生成: `node scripts/materials/fill-material-pos.mjs` (最終生成: 2026-07-03T00:32:12.956Z)
> モード: **実補完 (apply)**・ルール1〜5のみ
> 機械可読版: [reports/materials-pos-fill-plan.json](reports/materials-pos-fill-plan.json)
> ロールバックSQL: [reports/materials-pos-fill-rollback.sql](reports/materials-pos-fill-rollback.sql)
> 監査の詳細: [MATERIALS_POS_AUDIT.md](MATERIALS_POS_AUDIT.md)

---

## 対象の定義・補完しないもの

word・meaning・exampleなど他のフィールドは一切変更しない。posが**NULLの行のみ**、
以下の高信頼度ルール（[scripts/materials/lib/posDetection.mjs](scripts/materials/lib/posDetection.mjs)）に
一致した場合のみ補完候補とする。

1. 同じword + 同じmeaningで、他教材にposが設定済み
2. 明らかな代名詞・前置詞・接続詞・冠詞（固定辞書）
3. 数詞・曜日・月・基本副詞など、品詞がほぼ固定のもの（固定辞書）
4. meaningに「〜する」とあり、動詞と判断しやすいもの
5. meaningに「〜な」「〜の」とあり、形容詞と判断しやすいもの

**意味違いの重複行・熟語や句動詞・意味が短すぎるもの・複数品詞の可能性があるもの・
判断材料のないものは今回一切補完しない**（[MATERIALS_POS_AUDIT.md](MATERIALS_POS_AUDIT.md)の
「慎重に扱うもの」を参照）。

---

## サマリ

- 補完候補件数（合計）: **3,267件**
- ルール1〜5（高信頼度）: **3,267件**
- ルール6（追加提案・今回対象外）: **0件**
- 実補完結果: **3267件成功**（失敗: 0件）

### 補完しない理由別件数（全9,997件中、今回のcaution分）

| 理由 | 件数 |
|---|---:|
| 判断材料なし | 1,600 |
| 同じwordで複数品詞が存在 | 345 |
| meaningが短すぎる | 100 |
| 熟語・句動詞（複数語） | 1,888 |

### 補完予定のpos内訳（正規化タグ別、書き込む実際の文字列は教材の既存表記に合わせる）

| 正規化タグ | 件数 |
|---|---:|
| adj | 1,254 |
| v | 988 |
| n | 308 |
| 名詞 | 206 |
| verb | 146 |
| noun | 87 |
| adjective | 85 |
| 形容詞 | 48 |
| adv | 34 |
| 動詞 | 28 |
| prep | 27 |
| adverb | 16 |
| 副詞 | 13 |
| conj | 10 |
| pron | 6 |
| preposition | 4 |
| 接続詞 | 3 |
| 前置詞 | 1 |
| フレーズ | 1 |
| conjunction | 1 |
| v/n | 1 |

---

## 教材別の補完候補件数

| 教材タイトル | 補完候補件数 | 教材内のpos未設定総数 |
|---|---:|---:|
| 大学受験英単語1500 | 576 | 1,553 |
| 英検準2級 重要単語 | 427 | 1,479 |
| 最難関大学への英単語 | 290 | 701 |
| 大学入試頻出英単語 2000+ | 256 | 647 |
| 英検準1級 必須単語600 | 202 | 265 |
| 英検2級 必須単語800 | 196 | 349 |
| 高校英語基礎 重要単語 | 173 | 699 |
| 高校3年・共通テスト重要語 | 164 | 700 |
| TOEIC頻出単語600 | 154 | 263 |
| 高校2年英語 重要単語 | 151 | 502 |
| 高校1年英語 重要単語 | 129 | 500 |
| 慶應大学 英語頻出単語 (2026年度実績) | 126 | 708 |
| 英検2級 重要単語 | 120 | 349 |
| 英検1級 必須単語 | 118 | 301 |
| TOEIC 頻出単語 800 | 84 | 611 |
| 英検3級 重要単語 | 38 | 123 |
| 中学校英単語 基礎・標準 | 37 | 117 |
| 英検準1級 重要単語 | 26 | 97 |

---

## 補完前後のサンプル（ルール別・各3件）

| ルール | word | meaning | 補完前 | 補完後 |
|---|---|---|---|---|
| exact_word_meaning_match | ability | 能力 | (NULL) | noun |
| exact_word_meaning_match | abolish | 廃止する | (NULL) | v |
| closed_class_fixed_pos | abroad | 海外で、海外へ | (NULL) | adv |
| exact_word_meaning_match | absolute | 絶対的な、完全な | (NULL) | adj |
| meaning_pattern_adjective | abstract | 抽象的な | (NULL) | adj |
| meaning_pattern_adjective | absurd | ばかげた、不合理な | (NULL) | adj |
| meaning_pattern_adjective | academic | 学問の、学園の | (NULL) | adj |
| meaning_pattern_verb | accelerate | 加速させる、促進する | (NULL) | v |
| meaning_pattern_verb | accompany | 同行する | (NULL) | v |
| meaning_pattern_verb | accomplish | 成し遂げる、達成する | (NULL) | v |
| closed_class_function_word | despite | 〜にもかかわらず | (NULL) | prep |
| closed_class_function_word | except | を除いて，除外して | (NULL) | prep |
| closed_class_function_word | toward | 向かって，のほうへ | (NULL) | prep |
| closed_class_fixed_pos | almost | ほとんど，たいてい | (NULL) | adv |
| closed_class_fixed_pos | abroad | 海外に | (NULL) | adv |

---

## ロールバック手順

1. 補完対象idの一覧は[reports/materials-pos-fill-plan.json](reports/materials-pos-fill-plan.json)の`targetIds`に記録されている。
2. 復元する場合は[reports/materials-pos-fill-rollback.sql](reports/materials-pos-fill-rollback.sql)を
   Supabase SQL Editor等で実行する（対象idのposをNULLに戻すUPDATE文、冪等）。
3. 復元後は `npm run audit:materials-pos` を実行し、pos未設定数が補完前の数値に
   戻っていることを確認する。

## 検証方法

- `npm run validate:materials` / `npm run test:materials` / `npm run test:materials:e2e` /
  `npm run test:smoke` / `npm run verify:prod` / `npm run verify:srs-global` を通し、
  既存教材数・インポート・SRS・PDF導線に影響がないことを確認する
- word/meaning/exampleは一切変更していないため、完全重複・意味違い重複の件数は
  変化しないはず（`npm run audit:materials`で確認）
