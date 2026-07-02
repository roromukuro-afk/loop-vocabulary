# 教材データ 完全重複行 削除計画

> 自動生成: `node scripts/materials/deduplicate-material-words.mjs` (最終生成: 2026-07-02T11:36:36.540Z)
> モード: **実削除 (apply)**
> 機械可読版: [reports/materials-duplicate-delete-plan.json](reports/materials-duplicate-delete-plan.json)
> バックアップ: [reports/materials-duplicate-backup.json](reports/materials-duplicate-backup.json)
> ロールバックSQL: [reports/materials-duplicate-rollback.sql](reports/materials-duplicate-rollback.sql)

---

## 対象の定義

同一教材内で **word・meaning・pos・example・example_ja・importance・frequency・level**
が全て一致する行のみを削除対象とする（前後空白は除去して比較、大文字小文字は区別する）。

- 意味違いの重複（同じ見出し語だが内容が異なる）は対象外
- 大文字小文字の表記ゆれ（例: "Book" と "book"）はwordのテキスト自体が異なるため対象外
- 教材をまたぐ重複は対象外（同一教材内のみ）

## 残す行 / 削除する行の判断基準

完全一致グループ内で **`created_at`が最も古い行を残し**、同点の場合は **`id`が小さい行を残す**。
残りの行（2件目以降）を削除候補とする。

---

## サマリ

- 完全重複グループ数: **243件**
- 削除対象行数: **245件**
- 影響を受ける教材数: **14件**
- 実削除結果: **245件削除**（失敗: 0件）

## 影響範囲の確認

- **`words`（ユーザーの単語帳データ）への影響: なし。**`material_words.id`を参照する
  外部キーはDB上に存在せず（確認済み）、`/api/material/[id]/import`は`material_words`の
  内容を`words`に**コピー**するだけで以後は独立するため、既にインポート済みのユーザーの
  単語・復習履歴・SRSパラメータは一切変化しない。
- **今後のインポートへの影響**: 削除後にインポートすると、単語帳に入る語数が
  「削除された重複行の数」だけ減る（内容としては全く同じ語の重複コピーが無くなるだけ）。
- **PDFテスト生成への影響**: `material_words`から直接語をサンプリングする経路のため、
  重複が減ることでランダム抽出時に同じ語が連続表示される確率がわずかに下がる（改善方向）。
- **DBスキーマ・RLS・SRS V2ロジック・teacher機能への影響**: なし（`material_words`の行削除のみ）。

---

## 教材別内訳

| 教材タイトル | 削除前語数 | 削除対象行数 | 削除後語数 |
|---|---:|---:|---:|
| loop受験英単語②【高校入試】 | 1,600 | 92 | 1,508 |
| loop受験英単語①【中学完成】 | 2,000 | 59 | 1,941 |
| loop学びなおし英単語②【旅行・海外】 | 1,500 | 28 | 1,472 |
| 高校3年・共通テスト重要語 | 1,500 | 22 | 1,478 |
| 高校2年英語 重要単語 | 1,202 | 14 | 1,188 |
| loop受験英単語③【高校基礎】 | 1,500 | 8 | 1,492 |
| 英検1級 必須単語 | 1,500 | 7 | 1,493 |
| loop学びなおし英単語④【基礎からやり直し】 | 297 | 4 | 293 |
| 高校1年英語 重要単語 | 1,000 | 3 | 997 |
| 英検2級 必須単語800 | 352 | 3 | 349 |
| 英検準1級 必須単語600 | 267 | 2 | 265 |
| 英検準2級 重要単語 | 1,480 | 1 | 1,479 |
| loop受験英単語④【共通テスト】 | 300 | 1 | 299 |
| TOEIC頻出単語600 | 264 | 1 | 263 |

---

## ロールバック手順

1. `reports/materials-duplicate-backup.json` に削除対象行の全カラムのスナップショットが
   保存されている（実削除の直前に必ず生成・保存すること）。
2. 復元する場合は `reports/materials-duplicate-rollback.sql` をSupabase SQL Editor等で実行する
   （元の`id`をそのまま使う`INSERT ... ON CONFLICT (id) DO NOTHING`のため、二重実行しても安全）。
3. 復元後は `npm run audit:materials` を実行し、対象教材の総語数が削除前の数値に
   戻っていることを確認する。

## 削除前後の検証方法

- 削除前: `npm run audit:materials` で完全重複行数を確認（本レポートの数値と一致すること）
- 削除直後: `npm run audit:materials` を再実行し、完全重複行数が0になっていること・
  意味違いの重複行数が変化していないことを確認
- `npm run validate:materials` / `npm run test:materials` / `npm run test:materials:e2e` /
  `npm run test:smoke` / `npm run verify:prod` / `npm run verify:srs-global` を通し、
  既存教材数・インポート・SRS・PDF導線に影響がないことを確認する
