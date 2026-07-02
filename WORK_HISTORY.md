# WORK_HISTORY — Loop Vocabulary

> 作業の時系列ログ。新しいものを上に追記する。
> 最終更新: 2026-07-03

---

## 2026-07-03 品詞(pos)未設定9,997件の補完方針設計 + dry-run

完全重複行削除に続き、既存教材の技術的負債の2つ目「品詞(pos)未設定9,997件」の補完方針を
設計し、dry-run計画を作成した。**実データへの補完は一切実行していない。**

**現状調査**: 既存pos表記は教材ごとに大きくばらつきがあることが判明（"名詞"/"noun"/"n"、
"動詞"/"verb"/"v" 等、日本語フルネーム・英語省略形・英語フルネームの3系統が教材単位で
概ね統一されているが、教材間では全く異なる）。品詞未設定が0%の教材から100%の教材まで存在し、
6教材（大学受験英単語1500・英検準2級 重要単語・英検2級 必須単語800・英検準1級 必須単語600・
TOEIC頻出単語600・中学校英単語 基礎・標準、計4,026件）はpos設定済み行が教材内に1件もなく、
教材内の表記方式を参照できない。

**分類ロジック（[scripts/materials/lib/posDetection.mjs](scripts/materials/lib/posDetection.mjs)、監査/補完計画で共有）**:
教材ごとに既存pos表記から支配的な表記方式（日本語フルネーム/英語省略形/英語フルネーム）を検出し、
補完時はその教材の既存表記に合わせる（全教材に手がかりがない場合は、コーパス全体で最多派の
英語省略形をデフォルトとする）。分類ルールは優先順で適用:

1. 熟語・句動詞（複数語）→ 常に慎重に扱う（他の判定より優先）
2. meaningが1文字以下 → 慎重に扱う
3. 同じword+同じmeaningが他教材にpos設定済み → 自動補完（最高信頼度）
4. 代名詞・前置詞・接続詞・冠詞の固定辞書 → 自動補完（前置詞/接続詞/基本副詞は
   前置詞・接続詞・副詞のいずれにもなりうる多義語(since/until/before/after/while/though/
   still/even/only/just/yet/today/tomorrow等)を意図的に除外し、単一機能の語のみ収録）
5. 数詞・曜日・月・基本副詞の固定辞書 → 自動補完
6. meaningが「〜する」で終わる → 動詞と推定・自動補完
7. meaningが「〜な/〜の」で終わる → 形容詞と推定・自動補完
8.（追加提案・今回の既定対象外）同じwordが他教材に存在し意味は問わず品詞が一貫 → 提案のみ
9. 同じwordで複数品詞が他教材で見つかる（例: claim/concern/debate/benefit等の名詞/動詞
   兼用語）→ 慎重に扱う
10. 上記いずれにも該当しない → 慎重に扱う

**安全確認**: 補完によって同一教材内に新たな完全重複（word/meaning/pos/example/example_ja/
importance/frequency/levelが全て一致する行）が生じないかを事前検証し、**0件**であることを
確認済み（該当があれば自動的に補完対象から除外する仕組みも実装済み）。

**dry-run結果**:
- 品詞未設定: 9,997件
- 自動補完候補（ルール3〜7、高信頼度、既定のdry-run/apply対象）: **3,267件**
- 追加提案（ルール8、同一word一貫性、既定では対象外）: 2,797件
- 慎重に扱う（自動補完しない）: 6,730件
  （熟語・句動詞1,888件、判断材料なし1,600件、複数品詞345件、meaning短すぎ100件、
  上記の重複を除いた実数。詳細は[MATERIALS_POS_AUDIT.md](MATERIALS_POS_AUDIT.md)参照）

**新規スクリプト・npm script**:
- `scripts/materials/lib/posDetection.mjs`（新規）: 分類ロジック・固定辞書・教材別表記方式検出
- `scripts/materials/audit-materials-pos.mjs`（新規、`npm run audit:materials-pos`）: 品詞未設定の
  内訳監査（[MATERIALS_POS_AUDIT.md](MATERIALS_POS_AUDIT.md) / `reports/materials-pos-audit.json`を生成）
- `scripts/materials/fill-material-pos.mjs`（新規）: dry-run（既定）/ apply（`--apply`）の両方を持つ。
  実補完は環境変数`CONFIRM_MATERIALS_POS_FILL=yes`の明示指定がなければ即エラー終了する二重ガード付き。
  word/meaning/exampleは一切変更しない。
- `npm run materials:pos:dry-run` / `npm run materials:pos:apply`（新規）

**今回実施していないこと**: `materials:pos:apply`の実行（実データ補完）。ユーザーの承認を
得てから別途実施する。追加提案ルール8（2,797件）・慎重に扱う6,730件のいずれにも触れていない。

**制約**: DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし、
word/meaning/exampleは変更対象外、市販教材や外部辞書のコピーなし、実データの補完・上書きなし
（dry-runのみ）。

**検証**: `tsc --noEmit` / `build` / `audit:materials`（完全重複0件・pos未設定9,997件のまま
変化なしを確認） / `validate:materials`（4パックerrors=0） / `test:materials`（18項目PASS） /
`test:materials:e2e`（18項目PASS） / `test:smoke` / `verify:prod` / `verify:srs-global` 全通過。

---

## 2026-07-02 完全重複行245件の実削除（ユーザー承認済み）

前回のdry-run計画（完全重複行245件、14教材）についてユーザーの承認を得て、実データ削除を実施した。

**実行前の最終確認（8項目、全て一致を確認してから実行）**:
1. `material_words`総件数が32,587件 — SQL照会で確認
2. 完全重複削除対象が245件 — `reports/materials-duplicate-delete-plan.json`と独立SQLクエリが一致
3. 対象教材が14件 — 一致
4. 意味違い重複は削除対象に含まれていない — 削除候補245件全てが「残す行」とバイト単位で
   完全一致することをNodeスクリプトで個別検証（不一致0件）
5. `reports/materials-duplicate-backup.json`が存在 — 確認
6. `reports/materials-duplicate-rollback.sql`が存在 — 確認
7. rollback SQLが245件分の復元に対応 — `INSERT INTO`行数245件を確認
8. `words`側（ユーザー単語帳・SRS履歴）には影響しない — `material_words.id`を参照する外部キーが
   DB上に存在しないことを事前確認済み（前回のdry-run時に検証済み）

**実削除**: `CONFIRM_MATERIALS_DEDUPE=yes npm run materials:dedupe:apply` を実行。
245件削除成功・失敗0件。

**実行後の確認**:
- `material_words`総件数: 32,587件 → **32,342件**（245件減、想定通り）
- 完全重複行: 245件 → **0件**
- 意味違いの重複行: 2,181件 → 1,952件（削除された完全重複ペアの一部が同じ見出し語グループ内に
  混在していたため、グループ構造の変化に伴い減少。削除計画は完全重複のみを対象にしており
  意味違いの行そのものは削除していない。減少分は「完全重複2件のみで構成されていたグループが
  1件を残して重複グループでなくなった」ケースであり、内容の欠落ではない）
- 品詞(pos)未設定: 10,004件 → 9,997件（削除された重複行のうち7件がpos未設定だったため連動して減少）
- 既存35教材（既存31 + 新規プリセット4）は全て残存、総語数0の教材なし
- `words`（ユーザーの単語帳・SRS履歴）: 削除前後で無関係に推移（外部キー無し、想定通り無影響）

**バックアップ・ロールバック**: `reports/materials-duplicate-backup.json`（削除前の全488行）・
`reports/materials-duplicate-rollback.sql`（245件のINSERT、`ON CONFLICT (id) DO NOTHING`で冪等）は
削除実行後も変更せず保持している。復元が必要な場合はSupabase SQL Editor等で
rollback.sqlを実行すればよい。

**検証**: `npm run audit:materials`（完全重複0件・意味違い1,952件・35教材・32,342語）/
`npm run validate:materials`（4パックerrors=0） / `npm run test:materials`（18項目PASS、
新規4パック無傷・既存教材数維持を再確認） / `npm run test:materials:e2e`（18項目PASS、
削除後もインポート・SRS初期値・PDF選択肢反映・再インポート防止が正常動作） /
`npm run test:e2e`（8フロー全PASS） / `npm run test:smoke` / `npm run verify:prod` /
`npm run verify:srs-global` 全通過。

**制約**: DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし。
意味違いの重複1,952件・品詞未設定9,997件には触れていない（優先度Bとして継続検討）。

---

## 2026-07-02 完全重複行の削除計画（dry-run）+ 重複検出ロジックの精緻化

前回の監査で見つかった「完全重複行237件」について、削除の**dry-run（計画作成のみ・実削除なし）**
を実施した。ユーザーからの明示的な承認が出るまで、実データの削除は一切行っていない。

**重複検出ロジックの精緻化（237件→245件に修正）**:
dry-run計画を厳密に作るにあたり、既存の`audit-existing-materials.mjs`の重複判定ロジックに
分類バグを発見して修正した。旧ロジックは「同じ見出し語(大文字小文字無視)のグループ全体が
一様に完全一致する場合のみ」完全重複と判定しており、例えば5行中4行が完全一致・1行だけ
内容が異なる、というケースは全て「意味違いの重複」側に誤分類していた（本来は4行のうち
3行を安全に削除できるはずだった）。新ロジック（[scripts/materials/lib/duplicateDetection.mjs](scripts/materials/lib/duplicateDetection.mjs)、
監査・削除計画の両スクリプトで共有）は教材内の各行を
word(前後空白除去・大文字小文字区別)/meaning/pos/example/example_ja/importance/frequency/level
の厳密なタプルでグルーピングし直し、正確な完全重複238→245件・意味違いの重複2,181件を算出した
（Supabase上のSQLクエリで独立に再計算し一致することを確認済み）。

**dry-run結果**:
- 完全重複グループ: 243件 / 削除対象行: **245件** / 影響教材: **14件**
  （loop受験英単語②【高校入試】92件、loop受験英単語①【中学完成】59件 が上位2件、他12教材は
  1〜28件。詳細は[reports/materials-duplicate-delete-plan.md](reports/materials-duplicate-delete-plan.md)）
- 残す行の基準: グループ内で`created_at`が最古の行（同点は`id`昇順）
- 影響確認: `material_words.id`を参照する外部キーはDB上に存在しないため、削除しても
  `words`（ユーザーの単語帳・SRS履歴）・インポート済みデータには一切影響しない
  （import APIは`material_words`の内容を`words`にコピーするだけで以後は独立するため）
- バックアップ: 削除対象グループの全488行（残す行含む）を[reports/materials-duplicate-backup.json](reports/materials-duplicate-backup.json)に保存
- ロールバック: [reports/materials-duplicate-rollback.sql](reports/materials-duplicate-rollback.sql)（`INSERT ... ON CONFLICT (id) DO NOTHING`で冪等）

**新規スクリプト・npm script**:
- `scripts/materials/lib/duplicateDetection.mjs`（新規）: 完全重複検出の共有ロジック
- `scripts/materials/deduplicate-material-words.mjs`（新規）: dry-run（既定）/ apply（`--apply`）の
  両方を持つ。実削除は環境変数`CONFIRM_MATERIALS_DEDUPE=yes`の明示指定がなければ即エラー終了する
  二重ガード付き。dry-run/apply いずれのモードでも同じ4ファイル
  （delete-plan.json/md、backup.json、rollback.sql）を生成する
- `npm run materials:dedupe:dry-run` / `npm run materials:dedupe:apply`（新規）

**今回実施していないこと**: `materials:dedupe:apply`の実行（実データ削除）。ユーザーの承認を
得てから別途実施する。意味違いの重複2,181件・品詞未設定10,004件にも触れていない。

**制約**: DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし、
実データの削除・上書きなし（dry-runのみ）。

**検証**: `tsc --noEmit` / `build` / `audit:materials`（245件と再確認） / `validate:materials`
（4パックerrors=0） / `test:materials`（18項目PASS） / `test:materials:e2e`（18項目PASS） /
`test:smoke` / `verify:prod` / `verify:srs-global` 全通過。

---

## 2026-07-02 既存教材の品質監査基盤 + 教材インポートE2E追加

前回のプリセット教材パック基盤構築で見つかった「既存31教材・約32,000語の技術的負債」に対応する
第一段階。**いきなり修正はせず、まず監査レポートと検証基盤を整備し、修正方針を提案するところまで**を
実施した（実データの削除・上書きは一切行っていない）。

**1. 既存教材の品質監査**

新規スクリプト [scripts/materials/audit-existing-materials.mjs](scripts/materials/audit-existing-materials.mjs)
（読み取り専用）を作成。DB上の全35教材（既存31 + 新規プリセット4）について、教材ごとに
総語数・教材内重複（完全重複／意味違い重複を区別）・pos未設定・meaning/example/example_ja空欄・
difficulty(importance)範囲外・level/exam_typeの不整合・インポート可否・PDF/SRS互換性を集計し、
[MATERIALS_AUDIT.md](MATERIALS_AUDIT.md)（人間向け）と`reports/materials-audit.json`（機械可読）に出力する。

重複検出は「完全重複行」（同一教材内でword/meaning/pos/example/example_jaが全て一致する余剰コピー。
情報損失なく削除できる）と「意味違いの重複行」（同じ見出し語でも意味・品詞・例文が異なる。
複数の意味を持つ単語や、教材の意図上の重複の可能性があり自動削除しない）を明確に区別した。

**監査結果（2026-07-02時点）**:
- 対象35教材・総語数32,587語
- 完全重複行: 237件（0.7%）— 削除しても情報損失なしと判断できる
- 意味違いの重複行: 1,954件（6.0%）— 手動確認が必要
- 品詞(pos)未設定: 10,004件（30.7%）
- meaning/word空欄: 0件、example空欄: 29,746件（91.3%、主に大規模教材のフィールド未投入）
- difficulty範囲外: 0件
- タグ/カテゴリ不整合（level/exam_type空 or 未知値）のある教材: 1件
- インポート不可・PDF/SRS互換性に問題のある教材: 0件

**2. 修正方針の分類（提案のみ・未実行）**

- **自動修正してよい可能性が高いもの**: 完全重複行237件の削除（全項目一致のため情報損失なし）、
  前後空白・大文字小文字の表記ゆれ正規化（詳細スキャンは次のステップとして提案）
- **慎重に扱うべきもの**: 意味違いの重複行1,954件（別義の可能性）、品詞未設定10,004件の
  自動一括補完（辞書API等による誤判定リスク）、教材をまたぐ重複（意図的な設計のため対象外）

実データの削除・上書きは、対象・件数・リスク・ロールバック方法を別途報告してから着手する方針とし、
今回は着手していない。詳細は`NEXT_IMPROVEMENTS.md`優先度B-2a/2bに記録。

**3. 検証基盤への統合（非破壊・非ブロッキング）**

- `npm run validate:materials`: 従来のプリセットパック静的検証（4パック限定・ブロッキング）に加え、
  末尾で上記の監査を実行しレポートを再生成するステップを追加。**既存教材のデータ品質は
  このコマンドの合否判定には影響しない**（新規パックのCIゲートとしての機能を維持するため）。
- `npm run test:materials`: 末尾に「既存教材への非破壊確認」ステップを追加。プリセットパック以外の
  教材が31件以上維持されているか、総語数0の教材が発生していないかを回帰ガードとして検証（18項目、全PASS）。
- `npm run audit:materials`: 監査レポートを単独で再生成するための新規コマンド。

**4. 教材インポートの実ブラウザE2E追加**

新規 [scripts/testing/e2e/materials.mjs](scripts/testing/e2e/materials.mjs)（`npm run test:materials:e2e`、
`test:e2e`にも8フロー目として統合）。検証内容:
- 未ログイン時は無料登録CTA（`/signup?next=...`）を表示し、実際のインポートボタンは表示しない
- ログイン済みで教材詳細ページを開き「自分の単語帳にインポート」で単語帳が作成される
- 実際のAPI（`/api/material/[id]/import`）経由でインポートされた単語がSRS既定値
  （ease_factor=2.5, interval_days=0, next_review_at=+24h想定）を持つことをDBで確認
- /pdf の「自分の単語帳」選択肢にインポート後の単語帳が反映され、生成ボタンが有効化される
- /review は本日分の復習対象0件（next_review_atが翌日のため想定通りの空状態）
- 同一教材への再インポート（APIを直接2回呼び出し）が`alreadyImported:true`を返し、
  単語帳・単語データが重複増殖しないことを確認
- 対応するUI側に`data-testid`を追加（`ImportMaterialButton.tsx`・`materials/[id]/page.tsx`・
  `PdfTestBuilder.tsx`）。表示ロジック・スタイルは変更していない。

全18項目PASS。`npm run test:e2e`実行時も8フロー全PASS（onboarding/dictionary・SRS V2・teacher・
admin・教材インポート）。

**制約**: DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、teacher機能変更なし、
既存教材データの削除・上書きなし（監査は読み取り専用）。

**検証**: `tsc --noEmit` / `build` / `validate:materials`（4パックerrors=0） / `test:materials`
（18項目全PASS） / `test:materials:e2e`（18項目全PASS） / `test:e2e`（8フロー全PASS） /
`test:smoke` / `verify:prod` / `verify:srs-global` 全通過。

**残課題**（`NEXT_IMPROVEMENTS.md`優先度Bに記録）: 完全重複行237件の削除実施（要事前承認）、
品詞未設定10,004件の補完方針検討、既存31教材へのpresetMeta拡張。

---

## 2026-07-02 プリセット教材パック基盤の構築 + スターターパック4種を追加

「登録直後から学習を始められる英単語教材アプリ」への強化フェーズ第一弾。教材データの
標準フォーマット・品質チェック・投入導線を整備した上で、小規模・高品質な教材パック4種を追加した。

**現状調査で判明したこと**（想定より大規模な既存システムがあった）:
- `materials`/`material_units`/`material_words`（教材本体）と`word_books`/`words`（ユーザー単語帳）
  は分離されており、`/api/material/[id]/import`がmaterial_wordsをコピーしてユーザー自身の
  `words`行を作る設計（教材側は読み取り専用の"マスタ"、インポート後は完全に独立したコピー）
- 本番には**既に31教材・約32,187語**が稼働中（`scripts/seed-words.mjs`・`admin/seed-vocab`経由で
  AI生成データを投入済み。中学〜大学受験・英検5級〜1級・TOEIC・日常会話まで広くカバー）
- `/materials`は既にカテゴリ別表示（大学受験/英検/TOEIC/中学高校基礎）・検索・インポート状況・
  学習進捗表示・「はじめての方へ」導線を備えた成熟したページだった
- インポートされた単語は`words.material_id`で教材と紐付いたまま、SRS(ease_factor/interval_days
  はDBデフォルトの2.5/0で開始・next_review_atは24時間後に設定)・PDFテスト生成（`word_book_id`
  または`material_id`のどちらでも生成可能）の両方でそのまま利用できる設計だった
- **既存データの品質チェックで技術的負債を発見**: 同一教材内での単語重複1,137件、
  品詞(pos)未設定10,004件（全体の約31%）。今回は修正せず`NEXT_IMPROVEMENTS.md`優先度Bに記録
  （実害が出てから対応を判断する方針）

**教材データの標準フォーマット**（DBスキーマは変更せず、TS型として設計）:
[src/lib/materials/types.ts](src/lib/materials/types.ts)に`PresetMaterialPack`/`PresetWordEntry`
型を定義。教材ID・タイトル・対象レベル(level)・対象学年(grade)・目的(purpose)・推奨学習期間
(recommendedWeeks)・1日あたりの目安語数(dailyWordTarget)・カテゴリ(category)・タグ(tags)・
確認テスト対象か(testTarget)・SRS対象か(srsTarget)をパック単位、単語(word)・意味(meaning)・
品詞(pos)・例文(example)・例文訳(example_ja)・難易度(difficulty)を単語単位で持つ。
`grade`/`purpose`/`recommendedWeeks`/`dailyWordTarget`/`tags`はDBカラムを追加せず、
[presetMeta.ts](src/lib/materials/presetMeta.ts)が教材IDをキーにしたレジストリとして
表示時のみ参照する設計にした（DBスキーマ変更ゼロ）。

**品質チェックの仕組み**:
- `npm run validate:materials`（[scripts/materials/validate-materials.mjs](scripts/materials/validate-materials.mjs)）:
  DB不要の静的チェック。word/meaning/example/example_jaが空でない、教材内で単語が重複していない、
  posが許容値（noun/verb/adjective/adverb/preposition/conjunction/pronoun/interjection/phrase）
  の範囲内、difficultyが1〜5の整数、タグが許容セットの範囲内、例文に見出し語の語幹が含まれているか
  （簡易ヒューリスティック、外れても警告のみ）を検証
- `npm run test:materials`（[scripts/materials/test-materials.mjs](scripts/materials/test-materials.mjs)）:
  上記の静的検証→materials/material_wordsへの冪等投入→DB上の語数がパック定義と一致するか→
  実際のインポートAPIと同一ロジックでtest+onboardingアカウントにインポートし、結果の`words`行が
  SRS既定値(ease_factor=2.5, interval_days=0, next_review_at設定済み)・PDFテスト対象
  (word_book_id設定済み)になっているかを確認→テストデータを削除して冪等性を確保、の一連を実行。
  2回連続実行して冪等性を確認済み

**追加した教材パック**（すべてオリジナル作成・市販教材からの転載なし、計400語）:
1. [中学英単語 基礎100](src/data/presets/junior-basic-100.ts) — 中学1〜2年、高校入試対策
2. [高校英単語 基礎100](src/data/presets/highschool-basic-100.ts) — 高校1〜2年、大学受験基礎
3. [英検準2級 基礎100](src/data/presets/eiken-pre2-basic-100.ts) — 高校1〜2年、英検対策（動詞中心）
4. [大学受験 基礎動詞100](src/data/presets/university-basic-verbs-100.ts) — 高校2〜3年、長文読解基礎動詞

各パックとも推奨学習期間2週間・1日7語ペース。`materials.license_status='original'`
（自社オリジナル）・`is_public=true`で本番に投入済み（`test:materials`実行時に投入、
固定UUID `10000000-0000-0000-0000-000000000101`〜`104`を使用し、既存31教材とは完全に独立）。

**アプリ内導線**:
- [materials/page.tsx](src/app/materials/page.tsx): 新規カテゴリ「🔰 はじめての人におすすめ」を
  最上部に追加（`presetMeta`の`はじめての人におすすめ`タグでフィルタ）。既存の4カテゴリ
  （大学受験・英検・TOEIC・中学高校基礎）にも各パックのlevel/exam_typeに応じて重複表示される
  （既存の大規模教材と同じ表示ロジックを踏襲）。`MaterialCard`に推奨期間・1日目安語数・タグの
  バッジを追加（`presetMeta`が無い既存31教材は従来通りlevel/exam_typeのみ表示、影響なし）
- [materials/[id]/page.tsx](src/app/materials/[id]/page.tsx): プリセットパックの詳細ページに、
  タグ・目的・対象学年・目安期間・目安ペースを表示する情報パネルと「単語帳に追加すると、そのまま
  復習（SRS）・PDFテストに進めます」という案内文を追加

**検証**: `tsc --noEmit` / `build` / `validate:materials`(400語・エラー0件、警告1件は
"catch/caught"の語幹ヒューリスティックの想定内の誤検知) / `test:materials`(15項目全PASS、
2回連続実行で冪等性確認) / `test:smoke` / `test:e2e`(4フロー全PASS) / `verify:prod` /
`verify:srs-global` すべて通過。プレビューで`/materials`一覧・`/materials/[id]`詳細の両方を
実際に表示確認（スターターパックの表示・バッジ・情報パネルが意図通り機能することを確認）。

**制約**: DBスキーマは変更なし（`materials`/`material_words`の既存カラムのみ使用）、RLS変更なし、
SRS V2ロジック変更なし、teacher機能は無関係のため触れていない、既存31教材・既存ユーザーの
word_books/wordsには一切影響なし（新規4材料IDのみ操作）。

**残課題**: 既存31教材の重複/pos補完（技術的負債）、`presetMeta`の既存教材への拡張、
教材インポートの実ブラウザPlaywright E2E追加（今回はDBレベルのシミュレーションで代替）、
`/road`ページのMATERIAL_MAP統合。いずれも`NEXT_IMPROVEMENTS.md`優先度Bに記録。

---

## 2026-07-02 運用状態の整理・本番ヘルスチェック（優先度A完了の棚卸し）

新機能追加はせず、優先度Aの完了状況をドキュメント上で棚卸しし、本番ヘルスチェックを実施、
次の優先度を再整理した。

**優先度A完了状況の確認**（`NEXT_IMPROVEMENTS.md`とのズレを修正）:
1. ✅ Google Search Console対応（2026-07-01完了）— `NEXT_IMPROVEMENTS.md`の未完了表記を修正
2. ✅ SRS V2の利用状況可視化（`/admin/srs`、2026-07-02完了）
3. ✅ teacher招待コード失効・再発行（migration 013、2026-07-02完了）
4. ✅ admin向けE2E検証基盤（`test+admin`、2026-07-02完了）— 元々`NEXT_IMPROVEMENTS.md`の
   独立項目ではなかったため、今回完了済み項目として新規追記
5. ✅ JST日付統一（streak/カレンダー本体+関連4ファイル、2026-07-01〜07-02完了）— 同上、新規追記
6. ✅ 未使用・壊れたAPI(`api/ranking/route.ts`)削除（2026-07-02完了）— 同上、新規追記

いずれも実装・検証・本番デプロイまで完了済みであることをコード（該当ファイルの存在・内容）と
過去のWORK_HISTORYエントリで再確認した。`NEXT_IMPROVEMENTS.md`を全面的に整理し、
「✅完了済み」セクションに6項目すべてを明記、以降の優先度A/B/Cを再分類した（詳細は
[NEXT_IMPROVEMENTS.md](NEXT_IMPROVEMENTS.md)参照）。

**本番ヘルスチェック結果（2026-07-02実施、すべてPASS）**:
- `npm run test:dates`: 39 passed, 0 failed
- `npm run test:smoke`: build成功＋日付ユーティリティ39ケース＋公開/認証/API healthチェック 全PASS
- `npm run test:e2e`: 4フロー（onboarding/dictionary・SRS V2・teacher（招待コードライフサイクル含む）・admin）全PASS
- `npm run verify:prod`: 本番の公開ページ200／認証ページ307／POST専用API 405（`/api/teacher/invite-code`含む）全PASS
- `npm run verify:srs-global`: SRS V2グローバルフラグが個人フラグに関係なく本番で有効に効いていることを確認

E2E実行で招待コードが再発行/無効化された状態になったため、`seed-test-data.mjs`で
本番テストクラスの招待コードを既知の状態（`TESTCLS1`・無期限・有効）にリセット済み。

**現在の本番状態: 安定運用中**。優先度Aの主要6項目はすべて実装・デプロイ・検証済みで、
既知の未解決バグ・回帰は無い。DBスキーマ・RLS・SRS V2ロジックは今回変更していない
（本エントリはドキュメント整理と検証のみで、コード変更は無し）。

**次に推奨する作業**（詳細は`NEXT_IMPROVEMENTS.md`）: 新機能追加は見送り、
(1) Search Console初回結果確認（2026-07-08頃目安）、(2) 週次運用チェックリスト
（PRODUCTION_MONITORING.md §2）を定常運用として回す、の2点を推奨。優先度B以降
（教材ワンタップ導入短縮・通知強化・SEO記事追加・teacher生徒詳細画面等）は
利用データが蓄積してから着手判断する方針とした。

## 2026-07-02 teacher招待コードの失効・再発行・期限管理

`NEXT_IMPROVEMENTS.md`の優先度A項目3「招待コード失効・再発行」を実施。長期間使い回せていた
招待コードに、失効・再発行・使用停止・期限管理を追加した。

**現状調査で確認した内容**:
- `classes.invite_code`（`unique not null`）は生成時(`generateInviteCode`)以降ずっと不変で、
  失効・期限の概念がなかった
- 参加処理は `lookup_class_by_code(p_code)` RPC（SECURITY DEFINER）でコード→クラスを解決し、
  `/join/[code]`（表示）と`/api/teacher/join`（実際の参加）の両方がこのRPCを共有していた
- teacher画面（`/teacher`一覧・`/teacher/[classId]`ロスター）で招待コードを表示していた

**DB変更**: `supabase/migrations/013_invite_code_lifecycle.sql`（本番Supabaseに適用済み）。
- `classes`に`invite_code_expires_at` / `invite_code_revoked_at` / `invite_code_updated_at`
  （すべてnullable。`invite_code_updated_at`のみ`default now()`）を追加。既存データは変更なし
- `lookup_class_by_code`をDROP+CREATEで再作成し、`status`列（'ok'|'revoked'|'expired'）を追加
  （PostgreSQLは`CREATE OR REPLACE`で`RETURNS TABLE`の列構成を変更できないためDROP必須）。
  `archived=false`の絞り込みは既存のまま変更なし
- RLS変更なし。招待コードの更新は既存の"classes teacher all"ポリシー(`teacher_id = auth.uid()`)が
  そのまま保護する

**既存データへの影響**: 適用後に確認（本番のクラスは1件、`TEST_検証クラス`）。
`invite_code_expires_at`/`invite_code_revoked_at`とも`null`のまま＝無期限・有効を維持し、
`lookup_class_by_code`は`status='ok'`を返すことを確認。既存の参加導線は無変更で動作する。

**アプリ変更**:
- [src/lib/teacher/code.ts](src/lib/teacher/code.ts): `INVITE_CODE_DEFAULT_TTL_DAYS=90`と
  `inviteCodeExpiresAtFromNow()`を追加
- [api/teacher/classes](src/app/api/teacher/classes/route.ts)（クラス新規作成）: 新規クラスは
  作成時から90日後の期限を設定（安全側のデフォルト。既存クラスはこのカラムがnullのまま不変）
- [api/teacher/invite-code](src/app/api/teacher/invite-code/route.ts)（新規）: `POST {classId,
  action:"reissue"|"revoke"}`。reissueは新コード発行＋期限90日でリセット＋無効化解除、revokeは
  即座に無効化。所有確認（`teacher_id = auth.uid()`一致）に失敗すると404、未ログインは401
- [api/teacher/join](src/app/api/teacher/join/route.ts): `status`が'revoked'/'expired'の場合は
  410でエラーメッセージを返すよう変更（従来の「見つからない」404とは別メッセージ）
- [join/[code]/page.tsx](src/app/join/[code]/page.tsx): 「見つからない」「無効化されています」
  「期限切れです」を区別して表示
- [teacher/[classId]/InviteCodeManager.tsx](src/app/teacher/[classId]/InviteCodeManager.tsx)（新規）:
  現在のコード・状態（有効/無効化済み/期限切れ）・有効期限を表示し、再発行/無効化ボタンを提供
- [teacher/page.tsx](src/app/teacher/page.tsx)（クラス一覧）にも状態バッジを追加

**E2E**: [scripts/testing/e2e/teacher.mjs](scripts/testing/e2e/teacher.mjs)を拡張（新規ファイルは
作らず既存を拡張、npm run test:teacher / test:e2e の両方に含まれる）。追加した検証:
teacher視点で招待コード管理セクション表示・再発行（コードが変わる）・無効化（状態表示・ボタンdisabled化）、
生徒視点で旧コード失効・新コード参加可・無効化後は理由付きで参加不可、非teacher(test+srs)は
他人のクラスを再発行/無効化できない(404)、未ログインはAPI操作不可(401)・`/join/[code]`は`/login`へ誘導。
[scripts/testing/seed-test-data.mjs](scripts/testing/seed-test-data.mjs)の`seedTeacherClass`を、
毎回招待コードを既知の値(`TESTCLS1`・無期限・有効)にリセットするよう変更（前回実行で再発行/無効化
されていても次回実行で復元される冪等性を確保。2回連続実行して確認済み）。
[smoke.mjs](scripts/testing/smoke.mjs)/[verify-prod.mjs](scripts/testing/verify-prod.mjs)の
POST専用APIチェックにも`/api/teacher/invite-code`を追加。

**検証**: `tsc --noEmit` / `build` / `test:teacher`（新規22項目含め全PASS、2回連続実行で冪等性確認）/
`test:e2e`（4フロー全PASS）/ `test:smoke`（新チェック含め全PASS）/ `verify:srs-global` 全通過。
`verify:prod`はデプロイ前時点では新ルート未反映のため`/api/teacher/invite-code`が404で一時的に
FAILしたが、これは想定通り（デプロイ後に再実行して確認）。

**制約**: DBスキーマは追加のみ（破壊的変更なし）、RLSは変更なし、SRS V2には触れていない、
実ユーザーのクラス・参加データは削除していない、既存招待コードをいきなり無効化していない。

## 2026-07-02 admin向けE2E検証基盤の整備（`test+admin`アカウント + `/admin/srs`自律検証）

前回の`/admin/srs`実装で残課題としていた「admin権限を持つE2Eテストアカウントが未整備」を解消。
管理画面も手動確認に頼らず自律的に検証できる状態にした。

**テストアカウント**: `test+admin@loop-vocabulary.app`を新規作成（既存の`setup-test-users.mjs`/
`TEST_ACCOUNTS`の仕組みをそのまま踏襲）。`profiles.is_test_account=true`に加え、このアカウントのみ
`profiles.is_admin=true`を付与（[scripts/testing/lib/testAccounts.mjs](scripts/testing/lib/testAccounts.mjs)に
`isAdmin: true`フラグを追加し、[setup-test-users.mjs](scripts/testing/setup-test-users.mjs)が
`cfg.isAdmin === true`の場合のみ`is_admin`をtrueにするよう変更。他の既存テストアカウント・実ユーザーの
`is_admin`/`role`には一切影響しない）。パスワードは`.env.local`の`TEST_ADMIN_PASSWORD`にのみ保存。

**E2E追加**: [scripts/testing/e2e/admin.mjs](scripts/testing/e2e/admin.mjs)（新規、`npm run test:admin`・
`npm run test:e2e`の両方から実行可能）。検証内容:
- `test+admin`で`/admin/srs`にアクセスでき、主要指標・異常値検知の各セクションが表示される
- ページ本文に個別の単語・意味データ（テスト単語帳の実単語）や`user_id`ラベルが含まれていない
- ページ表示前後で`words`テーブルの総行数が変化しない（書き込みが発生しないことの実測確認）
- 非admin(`test+srs`)で`/admin/srs`にアクセスすると`/dashboard`にリダイレクトされる
- 未ログインで`/admin/srs`にアクセスすると`/login`にリダイレクトされる

[src/app/admin/srs/page.tsx](src/app/admin/srs/page.tsx)には上記アサーション用に
`data-testid="admin-srs-page"` / `admin-srs-metrics-section` / `admin-srs-anomalies-section` を
追加（表示ロジック・集計ロジックは変更なし）。

**認可への影響**: なし。既存の`requireAdmin()`をそのまま使用しており、実装や判定ロジックは変更していない。
テスト用admin以外のユーザーのroleや権限も変更していない。DBスキーマ・RLSも変更なし
（`is_admin`は既存カラムへのデータ更新のみで、対象は`test+admin`という管理下のメールアドレス1件のみ）。

**検証**: `tsc --noEmit` / `build` / `test:admin`（新規、全項目PASS） / `test:e2e`（4フロー全PASS、
admin含む） / `test:smoke` / `verify:prod` / `verify:srs-global` 全通過。

ドキュメント: `PRODUCTION_MONITORING.md`（自動検証コマンド表に`test:admin`追加、weekly checklistの
`test:e2e`を4フロー表記に更新、`/admin/srs`項目を「値の異常確認のみでよい」と明確化）を更新。

## 2026-07-02 SRS V2利用状況モニタリング画面 `/admin/srs` を追加

`NEXT_IMPROVEMENTS.md`の優先度A項目「SRS V2の利用状況可視化」を実施。SRS V2が全ユーザーONに
なったことを受け、管理者が異常を早期発見できる読み取り専用ダッシュボードを追加。

**実装**: [src/app/admin/srs/page.tsx](src/app/admin/srs/page.tsx)（新規）。既存の`requireAdmin()`
（`/admin`配下の他ページと同じ認可方式）を使用し、`words`テーブルから集計に必要な列
（`ease_factor, interval_days, correct_count, wrong_count, is_weak, next_review_at, last_studied_at`）
のみを取得してJS側で集計。`word`/`meaning`等の学習内容や`user_id`は一切取得しない
（個別ユーザー・単語は非表示、全体集計のみ）。

**表示指標**: 総単語数／復習対象単語数（現在復習待ち・滞留含む）／今日・明日・7日以内に復習予定
（JST基準）／`is_weak`件数・比率／`ease_factor`平均・最小・最大／`interval_days`平均・最大／
正解数・不正解数合計・正答率／異常値5種（`ease_factor`範囲外・`interval_days`上限超過・
`next_review_at`異常未来・`next_review_at`未設定の既学習単語・7日以上滞留・`is_weak`比率過多）。
しきい値は`src/lib/srs/index.ts`の`SRS_V2`定数（`EASE_MIN/MAX`, `INTERVAL_MAX`）をそのまま import して
使用し、SRS V2の計算ロジック自体には一切触れていない。

**負荷確認**: 実装前に本番`words`テーブルの行数を確認（2026-07-02時点で1,069件）。この規模では
全件取得＋JS集計で十分軽量なため、SQL集計RPCの追加は見送り。念のため取得上限
（`FETCH_LIMIT=50000`）を設け、上限に達した場合はページ上に警告を表示する。将来的に単語数が
大きく増えた場合はRPC化を検討（`NEXT_IMPROVEMENTS.md`に残課題として記載）。

**認可・RLS**: 新規テーブル・カラムなし。既存の`words`/`profiles`のRLSは変更していない
（`createAdminClient()`はservice_roleのため元々RLSをバイパスするが、これは既存の`/admin/stats`等の
他adminページと同じ方式を踏襲したもの）。`requireAdmin()`により`profiles.is_admin=true`のユーザー
以外は`/dashboard`にリダイレクトされ、書き込み操作は一切ない。

**検証**: `tsc --noEmit` / `build` / `test:smoke` / `verify:prod` / `verify:srs-global`
全通過。SRS V2ロジック・onboarding/dictionary・teacherフローには触れていないため`test:e2e`は
今回スキップ（判断として明記）。

## 2026-07-02 未使用・壊れたAPI `api/ranking/route.ts` を削除

前回のJST日付修正で「スコープ外」としてフラグした`src/app/api/ranking/route.ts`を精査し削除。

**確認内容**:
- 呼び出し元: リポジトリ全体を検索しても`/api/ranking`への参照はゼロ
  （`ranking/page.tsx`はこのAPIを使わず、Server Componentとして直接DBをクエリしている）
- 外部公開API意図: READMEに公開APIとしての言及なし。`requireUser()`は同一オリジン内部認証のみで
  APIキー/CORS設計もなく、外部（モバイルアプリ等）向けの意図は確認できなかった
  （`mobile-shell/`はCapacitor用の静的PWAシェルのみで、このAPIには依存していない）
- 実際に呼ばれた場合の挙動: `daily_stats`の実カラムは`day`/`studied_count`
  （[supabase/schema.sql](supabase/schema.sql)で確認）。ルートが参照していた`words_studied`/
  `studied_date`は存在しないため、呼び出せば必ず500エラーになる機能不全のコードだった

**判断**: 未使用・呼び出し不可能なコードのため削除（DBスキーマ・RLS・rankingページのUI挙動・
SRS V2・先生機能には触れていない）。以前spawnしたフォローアップタスク(`task_fc910af5`)は
このセッションで対応したため取り下げ。

**検証**: `tsc --noEmit` / `build` / `test:smoke` / `verify:prod`（デプロイ前後）全通過。

## 2026-07-02 残り4ファイルのUTC日付パターンをJST基準に統一（本番デプロイ済 `d816edd`）

前回（2026-07-01）のstreak/カレンダー修正で「未対応」として報告した残り4ファイルを対応。
すべて `new Date().toISOString().slice(0,10)` 相当のUTC暦日切り出しがJST境界
（00:00〜09:00 JST）でズレる同一バグパターン。

**修正内容**（すべて `src/lib/utils/date.ts` の既存JSTユーティリティを利用）:
- [ranking/page.tsx](src/app/ranking/page.tsx): 週間ランキングの週起点(月曜0:00)を
  `now.getDay()`/`getDate()`/`setHours()`（サーバーのローカルTZ依存）から
  `todayJST()`+`jstWeekdayIndex()`+`daysAgoJST()`に変更
- [api/cron/weekly-digest/route.ts](src/app/api/cron/weekly-digest/route.ts):
  対象週(7日前)の起点を`daysAgoJST(7)`に統一（`next_review_at`比較用の`now`は
  TIMESTAMPTZ絶対比較のため変更不要と判断し据え置き）
- [api/export/stats/route.ts](src/app/api/export/stats/route.ts) /
  [settings/ExportButton.tsx](src/app/settings/ExportButton.tsx):
  CSV出力ファイル名の日付を`todayJST()`に統一（PDFエクスポートには日付付きファイル名なし、対象外）
- [plan/StudyPlanClient.tsx](src/app/plan/StudyPlanClient.tsx): AIプランのmin-date(14日後)を
  `toJstDateString()`でJST暦日として文字列化（+14日の絶対時刻計算自体は変更なし）

**スコープ外として意図的に見送ったもの**: `api/ranking/route.ts` は同じUTC日付バグに加え、
存在しないカラム(`words_studied`/`studied_date`。実際は`studied_count`/`day`)を参照しており、
grepで呼び出し元ゼロ（未使用コード）と確認済み。日付ズレ修正のスコープからは外れるため触れず、
別タスクとして`spawn_task`済み（`task_fc910af5`）。

**テスト**: `test-date-utils.mjs`に4区分・11ケース追加（週間ランキング境界／weekly digest対象週／
エクスポートファイル名／AIプランmin-date）、いずれもJST早朝(00:00-09:00)でUTC基準との乖離が
起きることを再現しつつ、JST基準実装が正しい値を返すことを検証。ホストのローカルタイムゾーンに
依存しないよう、テスト内の「旧実装」比較はミリ秒演算またはUTC ISO文字列のみで構成（`setDate`等の
ローカルTZ依存メソッドは使わず、ホスト環境が変わっても結果が一定になるようにした）。
合計39ケース全PASS（既存25＋新規11＋todayJST健全性3の内訳）。

**制約**: 既存データの削除・補正なし、DBスキーマ変更なし、RLS変更なし、SRS V2ロジック変更なし、
先生機能変更なし。日付表示・集計境界・ファイル名のUTC由来ズレ修正のみに限定。

**検証**: `test:dates`(39 passed) / `tsc --noEmit` / `build` / `test:smoke` /
`test:e2e`(onboarding・SRS V2・teacherの3フロー全PASS) / `verify:prod` / `verify:srs-global`
すべてデプロイ前後の両方で実施、全通過。

**デプロイ**: commit `d816edd` → push → Vercel `dpl_CpKrBpBLfBES3e6PQ9F5kDJn4NsR` READY
（`loop-vocabulary.app`エイリアス反映確認済み）→ 本番`verify:prod`/`verify:srs-global`再実行、
回帰なし。

## 2026-07-01 streak/カレンダーの日付バグ修正（本番デプロイ済 `bc04e47`）

**原因**: `new Date().toISOString().slice(0,10)`（UTC日付）が `daily_stats.day` の書き込み・
streak計算・カレンダー表示など9ファイルで使われており、JST(UTC+9)の 0:00〜9:00 の間は
UTC日付が前日のままになるため、①1つのJST日の学習が2つのUTC日にまたがって記録され
streakが不正に増える／減る、②`StudyWeekGraph`で日付キー(UTC)と曜日ラベル(ローカル時刻)が
別々のタイムゾーンで計算され曜日と日付が一致しない、という2つのバグが発生していた。

**修正**: `src/lib/utils/date.ts`（新規）に固定UTC+9オフセット計算のJSTユーティリティを実装
（`todayJST`/`daysAgoJST`/`jstWeekdayIndex`/`lastNDaysJST`/`jstHour`/`jstDayOfMonth`/
`todayStartJstISO`）。`saveResult.ts`（daily_stats書き込み元）・`dashboard/page.tsx`・
`stats/page.tsx`・カレンダー2種・`StudyWeekGraph`・`admin/stats`・AI/PDFの日次クォータに適用。
DBスキーマ・RLS・SRS V2の算出ロジック・先生機能・課金には触れていない。
**既存データの補正（過去のdaily_stats行の是正）は実施していない**（低価値・高リスクと判断、
理由は完了報告で説明済み）。

**テスト**: `scripts/testing/test-date-utils.mjs`（`npm run test:dates`、`test:smoke`にも組込）
25ケース全PASS。`test:e2e`3本も回帰なし。

## 2026-07-01 Google Search Console 登録完了

- オーナーが `https://loop-vocabulary.app`（URLプレフィックス）を登録・所有権確認済み
  （既存のGoogleアカウント/GA連携により、私の想定していたHTMLタグ追加は不要だった）
- sitemap送信済み: ステータス **Success**、**Discovered pages: 69**（sitemap全体は78件、クロール遅延の範囲内）
- [SEARCH_CONSOLE_SETUP.md](SEARCH_CONSOLE_SETUP.md) を実態に合わせて更新（§0にステータス追記）
- 次回: 1週間後目安に「ページ」タブでインデックス済み/除外の内訳を確認

## 2026-07-01 SRS V2 全ユーザーON（本番反映済）

- Vercel CLI（`vercel env add` / `vercel --prod`）で `NEXT_PUBLIC_SRS_V2=1` を
  **Production のみ**に追加し、同一コミット(`4a29a8f`)のまま再デプロイして反映。
  デプロイ `dpl_CybPCKKWxmPjath6PGuQg1e9QA9K` READY・`https://loop-vocabulary.app` エイリアス済み。
- `npm run verify:prod`: 全チェックPASS（回帰なし）。
- **本番でのグローバル有効化を実地確認**: test+srsアカウントの個人フラグ(`profiles.srs_v2`)を
  明示的に`false`に固定した状態で本番`/review`にアクセスし、4段階評価UI(V2)が表示されることを確認
  （個人フラグに関係なくグローバルenvだけで有効化されている＝正しく本番ビルドに反映）。
  確認用に `scripts/testing/check-prod-srs-v2-global.mjs`（`npm run verify:srs-global`）を追加。
- **ロールバック手順（維持・未実施）**: `vercel env rm NEXT_PUBLIC_SRS_V2 production` → 再デプロイ
  → 全ユーザーV1へ復帰。個人opt-in(`profiles.srs_v2`)は引き続き独立して機能する。
- 主要ページ回帰: `verify:prod`で確認済み（公開200・認証307・API405）。

## 2026-07-01 既存バグ2件の修正（本番デプロイ済 `17015d9`）

- `ReferralCard.tsx`: `typeof window!=="undefined"` 分岐を廃止、`NEXT_PUBLIC_SITE_URL`
  （ビルド時に静的インライン化＝サーバー/クライアントで同一値）を初期値にし、
  マウント後に実際のoriginが異なる場合（vercel.appエイリアス等）のみ`useEffect`で補完。
  → ハイドレーションミスマッチ解消（E2Eの警告が1〜2件→0件に）。
- `SrsModeToggle.tsx` / `NotificationToggles.tsx`: PATCH後に`router.refresh()`を追加。
  同一プロセス内でページ再訪問してもSSR結果が古いままだった問題を解消。
- 副次的に発見: `srs.mjs`のE2Eで4件目（最後）の評価だけ保存前にタブを離れるレースが
  あり修正（毎回の評価後、次のカードへの遷移＝保存完了を待ってから次に進む設計に統一）。

**検証**: tsc✓ build✓ `test:e2e`（3本全PASS・警告0件）✓ `verify:prod`（本番）✓。

## 2026-07-01 自律E2E検証基盤の構築（本番デプロイ済 `8af9a79`）

**目的**: 今後のログイン後UI確認をオーナーに戻さず、テスト専用アカウント/データで自律検証する体制。

- migration 012（本番適用済・非破壊）: `profiles.is_test_account` フラグ。
- テストアカウント3件（Supabase Admin Auth APIで冪等作成、パスワードは`.env.local`のみ保存・非コミット）:
  `test+onboarding@loop-vocabulary.app`（0件リセット用）/ `test+srs@loop-vocabulary.app`（SRS検証・先生ロスター用生徒）/
  `test+teacher@loop-vocabulary.app`（先生ロール）。
- テストデータ投入（`scripts/testing/seed-test-data.mjs`、冪等・対象は上記3IDのみ）: SRSユーザーに復習期限切れ8語、
  先生用クラス+同意済みメンバー。
- data-testid属性を追加（非機能変更）: FlipCardRunner・SrsModeToggle・DictionarySearch・
  EnsureDefaultWordbook・FirstStepsGuide・review空状態・teacherロスター・MyClasses・join同意・login。
- Playwright実ブラウザE2E（`scripts/testing/e2e/`）: onboarding/dictionary・srs・teacher の3本。
  **`next build && next start`（本番ビルド）に対して実行**（`next dev`はSSRデータの
  再訪問時キャッシュ不具合があり検証に不向きと判明したため）。
- smoke/verify-prod（HTTPのみ・ブラウザ不要）を追加。
- npm scripts: `test:setup` `test:e2e` `test:srs` `test:teacher` `test:onboarding` `test:smoke` `verify:prod`。

**検証結果**: tsc✓ build✓ 3本のE2E全PASS（SRS V2はDB直読みで
ease_factor/interval_days/next_review_at/streak/is_weak/correct_count/wrong_count が
4評価すべてで期待値と一致、先生ロスターは集計のみ・生データ非開示・同意撤回で即除外を確認）。
smoke✓ verify:prod（本番）✓。

**発見した既存の課題（今回のスコープ外・spawn_task で別途フラグ済み）**:
1. `ReferralCard.tsx` の `typeof window !== "undefined"` 分岐によるハイドレーションミスマッチ
   （`NEXT_PUBLIC_SITE_URL`以外のオリジンで発生。vercel.appエイリアスでも起こりうる）。
2. `SrsModeToggle`等のトグルがPATCH後に`router.refresh()`を呼んでおらず、同一サーバプロセス内で
   `/settings`等を再訪問してもSSR結果が更新されない（DBは正しく更新される。UIの見た目のみ古い）。
   `next dev`/`next start`両方で再現。E2Eはこれを踏まえDB直読みで正解性を判定する設計にした。

## 2026-07-01 /dictionary 直行時のデフォルト単語帳保証（本番デプロイ済 `e078cd5`）

- `DictionarySearch.tsx`: マウント時、**ログイン済み＆単語帳0件**なら既存 `/api/wordbook/ensure-default`
  を呼び冪等にデフォルト単語帳を用意（`ensured` refで1回のみ）。作成後は追加先を自動設定し即追加可能に。
  未ログイン(`!loggedIn`)・単語帳保有済みは早期returnで対象外＝発火しない。
- `api/wordbook/ensure-default`: 表示精度のため title も返すよう変更（既存冪等ロジックは不変）。
- 検証: tsc/build、preview(anon)で ensure非発火・検索UI健全・mobile崩れ無し(overflow 0)・エラー無し、
  本番回帰(anon /dictionary 200・API GET405・公開200)、DB(既存3件・重複なし)。

## 2026-07-01 デフォルト単語帳の自動作成 + 追加後導線（本番デプロイ済 `08a3f5b`）

- `.claude/launch.json` を origin状態（`loop-vocabulary`/port3000/整形）に復元し working tree クリーン化。
- 新規 `api/wordbook/ensure-default`（**冪等**: 単語帳0件のときのみ「マイ単語帳」を作成。既存ユーザーは不変・重複なし）。
- 新規 `components/dashboard/EnsureDefaultWordbook.tsx`: 単語帳0件ユーザーのダッシュボードで自動作成＋「作成しました」案内（作成できたときのみ表示・×で閉じる）。
- `dashboard/page.tsx`: 単語帳count取得＋0件時に上記をマウント。
- `DictionarySearch.tsx`: 1語追加後に「復習で覚える/テスト」CTAを表示。
- 検証: tsc/build、本番回帰（API GET405・/dashboard307・公開200）、DB確認（既存3件のまま・重複作成なし）。
- 補足: 実際の自動作成はログイン済み0件ユーザーのダッシュボード表示時に発火（既存2ユーザーは保有済みで対象外）。dictionary直行の0件ケースは従来通り（主要導線のダッシュボードでカバー）。

## 2026-07-01 導線最適化（新規ユーザー動線・本番デプロイ済 `c2287dc`）

- `dashboard/page.tsx`: アクションCTAを動的化。**単語0件→「辞書で追加/教材から追加」を最優先**、
  単語あり→復習(due>0)またはレッスンを優先。文言で迷いを軽減。
- `materials/page.tsx`: 未インポートのログインユーザーに「はじめての方へ」ヒントを追加。
- 検証: tsc/build、モバイル(375px) /materials 崩れ無し(overflow 0)・エラー無し、本番回帰(認証307・公開200)。

## 2026-07-01 初回オンボーディング改善（本番デプロイ済 `d7c847d`）

- 新規 `components/dashboard/FirstStepsGuide.tsx`: ダッシュボード上部に「はじめの3ステップ」
  （単語追加→学習→復習）を表示。ステップは wordCount/学習有無で自動判定、現在ステップにCTA。
  **一度でも学習すると非表示**（`!everStudied` で制御）。既存 OnboardingModal（目標/レベル選択）と併存。
- `dashboard/page.tsx`: 上記ガイド＋先生機能への軽い導線を追加。
- `review/page.tsx`: 復習0件の空状態を「辞書/教材で単語を追加」CTA付きに改善。
- 検証: tsc/build、本番回帰（/dashboard・/review→login・500なし、公開200）。
- ※認証必須画面のため実UIはログイン後にご確認ください（表示コンポーネント＋Linkのみで低リスク）。

## 2026-07-01 保留分の整理 & 残SEO・UI改善（本番デプロイ済）

**B/C保留分の整理**:
- `94ff6fc` feat: 目標パーソナライズ（road/dashboard/GoalProgress）を別コミット化・本番化。回帰なし。
- `d5b5ec2` chore: content生成スクリプト（scripts/*.mjs）を追跡開始（ビルド非関与）。
- `.claude/launch.json`: **巻き戻し候補として held のまま**（意図不明の局所dev変更・本番非関与・理由明記済）。未コミット・未変更。

**残SEO・UI改善** `577d9aa`:
- landing の教材カテゴリ表記ゆれを表示時に統合（大学入試→大学受験, 高校英語→高校入試等。**データ不変・表示のみ**）＋フォールバック更新。
- `/signup`（indexable・コンバージョン）/`/login`（noindex）に layout.tsx でメタデータ付与。
- モバイル(375px)landing検証: 横崩れ無し(overflow 0)・コンソールエラー無し・フッター正常。
- 監査: 主要公開ページのmetadataは概ね網羅（/test はログイン必須で対象外）。OGP/Twitter/JSON-LD/Breadcrumbは既存で網羅。

## 2026-07-01 Phase 2-B: 先生向け進捗管理 MVP — 先生UI（本番デプロイ済 `35d2c17`）

- ページ: `/teacher`（先生ダッシュボード・role昇格・クラス作成・招待コード）、
  `/teacher/[classId]`（`get_class_progress`ロスター・所有ガード・集計のみ）、
  `/join/[code]`（`lookup_class_by_code`＋**明示同意画面**→参加）。
- 設定: 参加中クラス一覧＋同意撤回/退出（`get_my_memberships`＋`/api/teacher/membership`）、/teacher導線。
- API: `promote` / `classes`(作成・role検証・招待コードリトライ) / `join`(consent必須) / `membership`。
- 規約/プライバシー: 先生機能・進捗共有・同意撤回の節を追記。
- **検証**: tsc/build、本番DBライフサイクル(作成→参加→ロスター1→撤回0→退出0)PASS・残存0、
  本番回帰(非ログイン307、API GET405、公開200)。生徒の生データは先生に非開示（集計RPCのみ）。
- 補足: `/teacher` は非先生でも「先生機能の案内＋昇格CTA」を表示（データ非開示）。クラス作成・
  ロスター閲覧は role/所有/RPC認可で厳格ガード。

## 2026-07-01 Phase 2-B: 先生向け進捗管理 MVP — DB基盤（migration 011・本番適用済）

**目的**: 塾講師/家庭教師が担当生徒の学習状況を集計で把握。生の単語データは見せない。
- `supabase/migrations/011_teacher.sql`（**本番適用済・非破壊**）:
  - `profiles.role`（student/teacher）追加、`classes` / `class_members`（consent付）新規、index。
  - **新規テーブルにのみ RLS**（既存RLSは不変）: classes=先生本人CRUD / class_members=生徒本人RW＋先生は自クラスのみread。
  - **SECURITY DEFINER RPC**: `get_class_progress`（先生所有＆consent検証→集計のみ）、`lookup_class_by_code`、`get_my_memberships`。authenticatedのみ実行可（anon revoke）。
- **認可テスト（本番DBで一時フィクスチャ→検証→削除）全PASS**:
  - 非先生の `get_class_progress` 呼び出し → `blocked: not authorized`
  - 先生呼び出し → 同意済み生徒1件
  - 同意撤回後 → 0件（集計対象外）
  - テストデータ削除済み・RLS3ポリシー/RPC3種存在確認。
- **未実装（次段階）**: 先生UI（/teacher, /teacher/[classId]）、参加(/join/[code])＋同意画面、設定の同意撤回、teacherロール昇格、利用規約/プライバシー追記。
- 生UIが無いため現状は**完全にinert**（本番影響なし）。migration 011 は本番適用済み・ファイルはこのコミットで追跡開始。

## 2026-07-01 Phase 2-A(続): SRS V2 per-user opt-in（本番デプロイ済・V2はグローバルOFF）

- `supabase/migrations/010_srs_v2_optin.sql`（**本番適用済・非破壊**）: `profiles.srs_v2 bool default false`。
- `srsV2EnabledFor(profileFlag)` = env `NEXT_PUBLIC_SRS_V2` OR ユーザーの `profiles.srs_v2`。
- `saveStudyResult` が per-user で V2 判定。review ページが `v2Enabled` を FlipCardRunner に渡す。
- 設定に「学習設定 → 動的復習アルゴリズム(β)」トグル＋ `/api/settings/srs` PATCH。
- コミット `c60f4b4`・本番デプロイREADY。回帰なし（/settings /review→login, 公開200, /api/settings/srs→405）。
- opted-in=0（全員V1）。**オーナーは設定トグルONで自分だけV2検証可**。全ユーザーONは検証後に env フリップ。

## 2026-07-01 Phase 2-C: PDFカスタマイズ強化（本番デプロイ済）

- `PdfTestBuilder.tsx`: 段組み(1/2列)・解答用紙分離(改ページ)・印刷レイアウト改善（氏名/日付/得点欄）。commit `ba81db9`。

## 2026-07-01 Phase 2-A: 動的SRS基盤（本番デプロイ済・flag OFF）

- `applySrsV2`(SM-2簡易)・`saveResult` flag分岐・`FlipCardRunner` 4評価UI・migration 009。commit `a8501ed`。サンプル12/12 PASS。

## 2026-07-01 Phase 1: 信頼性・表記・SEO・登録不要の改善を実装（未コミット）

オーナー指示の「現段階の改善策」を working tree に実装。**commit / デプロイ / 巻き戻しは未実施。**
`npx tsc --noEmit` パス。dev サーバ(3001)で挙動確認済み。

- `src/app/layout.tsx` — WebSite JSON-LD の `SearchAction`(potentialAction) を削除（不整合解消）。
- `src/app/dictionary/page.tsx` — `requireUser`→`createClient`＋任意user。**登録不要で検索可**に。
  未ログイン時は無料登録CTAを表示。metadata/OGP 追加。
- `src/app/dictionary/DictionarySearch.tsx` — `loggedIn` prop 追加。未ログインは追加先セレクタ/
  追加ボタンを隠し、`/signup?next=/dictionary` への登録リンクに切替。
- `src/app/page.tsx` — 無料/Premium 表現の整合（FAQ回答・FAQ_LD・機能見出し・ヒーロー文言）。
  フッターを刷新（公式URL明記・問い合わせ導線・2カラム化・著作年 2025→2025–2026）。
- `src/app/materials/[id]/page.tsx` — BreadcrumbList JSON-LD 追加。

**検証:** 匿名で `/dictionary` が HTTP 200（従来はloginリダイレクト）。RLS `material_words public read`
は anon 可のため公開検索が成立。landing に公式URL・新コピー反映、HTML から SearchAction が消滅。

**未決:** 運営者名/特商法表記（捏造不可・要オーナー提供、コードに TODO(運営者) 明記）、
GSC 登録（外部作業）、辞書 `q` パラメータ対応→SearchAction 復活。

### Phase 2（分離・未着手）＝オーナー整理の「そのうえで」領域
- 復習アルゴリズムの動的化（自己評価「簡単/普通/難しい」・正答率で間隔可変）
- 先生向け進捗管理画面（生徒の学習日数/語数/正答率/苦手/復習状況）… 新DB設計・ロール必要
- PDFテストのカスタマイズ（シャッフル/解答分離/段組/問題数/日英⇔英日/苦手のみ）
→ いずれも新スキーマ・大改修を伴うため、別途設計してから着手する。

---

## 2026-07-01 セッション引き継ぎ（現状把握）

前セッションの引き継ぎ資料（`PROJECT_CONTEXT.md` / `WORK_HISTORY.md` / `HANDOFF.md`）は
**ファイル保存されておらず Markdown 本文として出力されただけ**だったため、本セッションで
git 差分をもとに 3 ファイルを新規作成した（このファイルもその一つ）。

### この時点の git 状態

- branch: `main`（origin と同期、未コミットの作業ツリー変更あり）
- 直近コミット:
  - `69f1f09 fix: license_status フィルターを approved+original に拡張`
  - `e1930b8 feat: UX強化 - 例文表示・スワイプ・直接開始・AI補完`
  - `f7d34a0 feat: PWA offline cache, offline page, push send API, health endpoint`

### 未コミットの変更（作業ツリー）

**変更 28 ファイル / 新規（未追跡）多数。** 目的別に3系統へ分類した。

#### A系統：今回の主目的 = SEO・信頼性改善（コミット対象）
- `src/app/layout.tsx` — Organization / WebSite の JSON-LD 追加
  - ※ WebSite の `SearchAction` が `/dictionary?q=...` を指すが、`/dictionary` は
    ログイン必須かつ `q` 未対応 → **不整合（要修正）**。詳細は HANDOFF 参照。
- `src/app/page.tsx` — FAQPage JSON-LD 追加（4問）
- `src/app/sitemap.ts` — 非同期・動的化。公開教材ID / 追加 guide スラッグ 10 件 /
  文法レッスン（`/grammar/[slug]`）/ `/materials`・`/grammar` を収録。
- `src/app/materials/page.tsx` — `requireUser` → `createClient` 化で**未ログイン閲覧可**、
  metadata / OGP 追加、未ログイン向け無料登録 CTA。
- `src/app/materials/[id]/page.tsx` — 同上の未ログイン開放、`generateMetadata`（教材別 title/description/OGP）、
  未ログイン時はインポートボタンを「無料登録して単語帳にインポート」リンクに切替。
- `src/app/guide/page.tsx` — 記事カード 10 本追加、`/grammar` への誘導バナー追加。
- `src/app/guide/[slug]/page.tsx`（+約1020行）— 追加記事の本文・Amazon書籍セクション
  （`@/components/affiliate/AmazonBook`, ASIN指定）・教材内部 CTA（`GuideMaterialCTA`）。
- `src/app/guide/*/page.tsx`（個別 18 ファイル, 各 +1〜11 行）— 教材 CTA / 導線の小追加。
- 新規 `src/components/guide/GuideMaterialCTA.tsx` — 記事から教材ページへの内部リンクCTA。
- 新規 `src/app/grammar/`, `src/components/grammar/`, `src/lib/grammar/` — 英文法レッスン機能。
  - `lessons.ts`(423行) だが**レッスン実体は現状 2 本のみ**（`kanshi-a-an-the` / `meishi-kasan-fukasan`）。

#### B系統：目標パーソナライズ機能（今回のSEO改善とは分離・保留）
- `src/app/road/page.tsx` — `profiles.exam_goal` 取得 → 目標関連教材ハイライト表示。追加のみ・破壊的変更なし。
- `src/app/dashboard/page.tsx` — `GoalProgress` を import + 設置（4行）。
- 新規 `src/components/dashboard/GoalProgress.tsx` — 目標別進捗カード（Server Component）。

#### C系統：運用ツール・ローカル設定（今回のSEO改善とは分離・保留）
- 新規 `scripts/generate-materials.mjs` — Claude API 単語帳生成スクリプト。
- 新規 `scripts/fill-empty-materials.mjs` — 低語数教材の補完スクリプト。
- `.claude/launch.json` — dev 構成名変更＋**ポート 3000 → 3001**、JSON を1行に圧縮。

### 本セッションで行ったこと
- 現状把握（各ファイルの diff 確認）。**コード変更・commit・デプロイ・巻き戻しは未実施。**
- `PROJECT_CONTEXT.md` / `WORK_HISTORY.md` / `HANDOFF.md` を新規作成。

### 未着手（次セッションへ）
→ `HANDOFF.md` の「次にやること」を参照。
