# コンテンツ出所ポリシー（Content Source Policy）

作成日: 2026-07-12
関連: `EXTERNAL_MATERIALS_RIGHTS_AUDIT.md`（本ポリシー策定のきっかけとなった監査）、
`src/app/legal/content-policy/page.tsx`（ユーザー向け公開ページ）

本ドキュメントは、Loop Vocabularyが外部由来のコンテンツ（市販教材の単語データ、
市販単語帳の名称・比較記事など）を扱う際に、今後も一貫して守るべき社内向けルールを
定める。**法的助言ではない**（最終的な著作権判断は必要に応じて専門家に相談すること）。

---

## 1. 教材（`materials`テーブル）を `license_status="approved"` にする前の必須要件

現状、`materials.license_status` は `"original"`（自社作成）/ `"approved"`（外部由来だが
許諾済み）を主に取り、`materials.license_id` で `licenses`テーブル
（`id, name, status, source_url, note, approved_by, approved_at, created_at`）と
紐づく構造が**既に存在する**（新規カラム追加は不要）。今後 `"approved"` を
新規に付与する場合、**以下すべてを満たし、その根拠を `licenses`テーブルに
記録すること**:

1. **許諾の実在確認**: 権利者（出版社・個人サイト運営者等）から、単語データを
   Loop Vocabulary上で公開・提供することについて、書面（メール等でも可）で
   明示的な許諾を得ていること。「規約上グレーだが黙認されていそう」は不可。
2. **`licenses`テーブルへの記録**: 以下を必ず埋める。
   - `note`: 許諾の範囲（例: 「単語・意味の掲載は可、例文の転載は不可」等の
     制限があれば明記）と、許諾のやり取りの保管場所（メール検索キーワード・
     契約書ファイル名等）。
     監査時点（2026-07-12）で既存の3件（受かる英語・小テストジェネレーター・
     VOCABULARISM）は `note`に「サイト運営者から使用許諾取得済み」とだけ
     記載され、日付・連絡先・許諾範囲の詳細を欠く**簡素すぎる記録**だった。
     今後はこの3件と同水準の記録で満足せず、より具体的な内容を残すこと。
   - `approved_by`: 社内で誰が承認したか（氏名/役割）。既存3件はすべて`null`のまま
     になっており、今後は必ず埋める。
   - `approved_at`: 承認日時。既存3件は3件とも同一タイムスタンプ
     （一括シード時の値とみられる）になっており、実際の許諾取得日を反映して
     いない可能性が高い。今後追加する分は実際の許諾取得日を記録すること。
3. **`publisher`/`author` の設定**: 表示用の出典情報として `materials.publisher`・
   `materials.author`列を必ず設定する。空欄のまま `license_status="approved"` には
   しない。
4. **公開ページでの出典表示の確認**: `/materials/[id]` で実際に出典が表示されることを
   デプロイ前に目視確認する（`src/app/materials/[id]/page.tsx` の実装に依存した
   自動表示のため、テンプレート変更時は退行がないかE2Eで確認する
   — `scripts/testing/e2e/external-material-rights.mjs` 参照）。
5. **再配布経路の遮断確認**: 新しい教材を追加した際、その教材からインポートされた
   単語帳が、意図せず外部に再配布可能な経路（共有機能・エクスポート機能等）に
   露出しないか確認する。現状の対策:
   - `/share/[code]`: `word_books.source_type !== "custom"` は共有不可
     （`src/app/api/wordbook/[id]/share/route.ts`）。
   - PDF/CSVエクスポート: 教材由来の単語には出典を明記する（削除・秘匿はしない）。
   新しい配布経路（例: SNS連携、API公開等）を追加する際は、同様の
   `source_type`/`source_material_id` チェックを必ず組み込むこと。

上記を満たさない場合は `license_status="approved"` にせず、`"draft"`や`is_public=false`
など非公開の状態に留め、要件を満たしてから公開すること。

---

## 2. 比較記事・学習法解説コンテンツ（市販単語帳を名指しする記事）のルール

対象: ガイド記事（`src/app/guide/[slug]/page.tsx`）のうち、実在する市販単語帳
（ターゲット1900・システム英単語・LEAP・鉄壁 等）を名指しで扱う記事
（現行 `BRAND_REVIEW_SLUGS`）。

### 2-1. 常に守ること

1. **公式提携・監修・推薦の誤認を生む表現をしない**。「〇〇と提携」「〇〇公認」
   「〇〇監修」等、事実に反する、または確認が取れない関係性を示唆する表現は禁止。
2. **非公式であることの明示**: 記事内に「Loop Vocabulary は各出版社と公式に
   提携するものではなく、本記事は独自の解説・比較です」に類する一文を必ず含める
   （既存の実装パターンを踏襲: L2002-2009 `src/app/guide/[slug]/page.tsx`）。
   新規に市販教材を名指しする記事を追加する場合は、必ず `BRAND_REVIEW_SLUGS`
   （または将来のより一般化されたフラグ）にそのslugを追加すること。
3. **教材の「見出し語の選定・配列」を丸ごと・逐語的に再現しない**。
   - 禁止: 「実際の収録順」「実データ」等と称して、教材の特定セクション
     （例: 「Final Stage」「Part 3」の実際の単語）をそのまま抜き出して掲載すること。
   - 許容: 「大学受験で頻出とされる基本動詞の例」のような、一般的な語彙知識としての
     単語の例示（教材の独自の選定・配列を「実際にそのまま」と主張しない形）。
   - 判断に迷う場合は「一般的な傾向として」「イメージとして」等の言葉を使い、
     特定の版・特定ページの実際の内容を検証済みであるかのような主張を避ける。
4. **価格・ASIN等のAmazonアフィリエイト情報**は、公開されている書誌情報
   （タイトル・著者・出版社・価格帯）の範囲に留め、教材の中身（単語リスト・
   例文等）の転載とは明確に区別する。
5. 誇張・保証表現（「合格を保証」「必ず覚えられる」等）を含めない
   （既存の `scripts/testing/e2e/guides-content.mjs` の `BAN_PHRASES` と同じ基準）。

### 2-2. 新規記事追加時のチェックリスト

- [ ] 非公式ディスクレーマーの一文が入っている
- [ ] 「実データ」「実際の並び」等、逐語的再現を主張する表現がない
- [ ] 誇張・保証表現がない
- [ ] `scripts/testing/e2e/external-material-rights.mjs`（比較記事を追加した場合は
      対象slugをこのテストの `BRAND_REVIEW_SLUGS` 相当リストに追加）で検証済み

---

## 3. 定期的な棚卸し

- 四半期に1回を目安に、`materials`テーブルで `publisher`/`author` が
  `"Loop Vocabulary"` 以外の行を棚卸しし、`license_note`の記載内容が
  今も有効か（許諾期間の定めがある場合は特に）を確認する。
- 新しい配布経路（共有・エクスポート・API等）を追加する際は、この棚卸しの
  対象に「その経路が外部由来コンテンツを漏らさないか」を追加項目として含める。

```sql
-- 棚卸し用クエリ例（licenses テーブルと突き合わせ、approved_by欠落も検出する）
select m.id, m.title, m.publisher, m.author, m.license_status,
       l.name as license_name, l.status as license_row_status,
       l.note, l.approved_by, l.approved_at
from materials m
left join licenses l on l.id = m.license_id
where m.is_public = true
  and m.publisher is not null
  and m.publisher <> 'Loop Vocabulary';
```
