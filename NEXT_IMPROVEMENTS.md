# NEXT_IMPROVEMENTS — 次の改善候補（優先順位付き）

> 安定運用フェーズの方針: 新機能実装より先に「今すぐやるべき軽い作業」を優先し、
> 大きめの機能追加は実際の利用状況を見てから判断する。
> 各項目は着手前に個別のご確認をいただく（本ドキュメントは提案のみ・実装はまだしない）。
>
> **2026-07-03時点: 優先度A（下記10項目）はすべて完了。現在は次の優先度整理フェーズ。**
> 本番ヘルスチェック結果・現在の運用状態は [WORK_HISTORY.md](WORK_HISTORY.md) の
> 「2026-07-02 運用状態の整理・本番ヘルスチェック」を参照。
> 既存教材の品質状況は [MATERIALS_AUDIT.md](MATERIALS_AUDIT.md) を参照
> （`npm run audit:materials` / `npm run validate:materials` で再生成可能）。

---

## ✅ 優先度A（完了済み・2026-07-01〜07-02）

1. ✅ **完了（2026-07-01）: Google Search Console対応**
   `https://loop-vocabulary.app`（URLプレフィックス）を登録・所有権確認済み、sitemap送信済み
   （ステータスSuccess、Discovered pages: 69）。登録前チェック（sitemap/robots.txt整合性）も実施済み。
   詳細は[SEARCH_CONSOLE_SETUP.md](SEARCH_CONSOLE_SETUP.md)、[WORK_HISTORY.md](WORK_HISTORY.md)参照。
   **次のアクション**: 登録から1週間程度（2026-07-08頃目安）で「ページ」タブのインデックス状況・
   検索パフォーマンスの初回結果を確認する（下記「優先度A: 次に着手」参照）。

2. ✅ **完了（2026-07-02）: SRS V2の利用状況可視化**
   [`/admin/srs`](src/app/admin/srs/page.tsx) に読み取り専用モニタリング画面を実装済み。
   総単語数・復習対象/今日/明日/7日以内予定・`is_weak`比率・`ease_factor`/`interval_days`の
   平均/最小/最大・正誤合計と正答率・5種類の異常値検知（ease範囲外/interval上限超過/
   next_review_at異常未来/未設定/滞留・is_weak過多）を表示。詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。
   **残課題**: 現在の集計はwordsテーブル全件をJS側で読み込む方式（2026-07時点で約1,000件のため
   十分高速）。将来、総単語数が数万〜十万件規模まで増えた場合はSQL側の集計RPC（`avg()`/`count()`を
   Postgres側で計算し行を転送しない方式）への切り替えを検討する（→下記優先度Cに再掲）。

3. ✅ **完了（2026-07-02）: 招待コード失効・再発行**
   `classes`に`invite_code_expires_at`/`invite_code_revoked_at`/`invite_code_updated_at`を追加
   （migration 013、nullable・既存クラスは無期限のまま無影響）。`/teacher/[classId]`から
   再発行・無効化が可能（[InviteCodeManager](src/app/teacher/[classId]/InviteCodeManager.tsx)）。
   新規クラス・再発行は既定90日で自動失効（`INVITE_CODE_DEFAULT_TTL_DAYS`）。
   `/join/[code]`は失効/無効化/存在しないコードをそれぞれ判別してメッセージ表示。詳細は
   [WORK_HISTORY.md](WORK_HISTORY.md)参照。
   **残課題**: 再発行前の旧コードは即座に「存在しない」扱いになるだけで、履歴（誰がいつ再発行したか）
   は保持していない（→下記優先度Bに再掲）。

4. ✅ **完了（2026-07-01〜07-02）: JST日付統一**
   `new Date().toISOString().slice(0,10)`（UTC暦日）がJST(UTC+9)の0:00〜9:00で前日を指してしまう
   バグパターンを、streak計算・カレンダー曜日表示・週間ランキング境界・weekly digest集計・
   CSV/PDFエクスポートファイル名・AIプランmin-dateなど計13ファイルで修正。共通ユーティリティ
   [src/lib/utils/date.ts](src/lib/utils/date.ts)を新設し全箇所で使用。テスト39ケース全PASS。
   詳細は[WORK_HISTORY.md](WORK_HISTORY.md)の2026-07-01/07-02の各エントリ参照。
   **既存データの補正は実施していない**（低価値・高リスクと判断。理由は該当エントリに記載）。

5. ✅ **完了（2026-07-02）: 未使用・壊れたAPI削除**
   `src/app/api/ranking/route.ts`を削除。呼び出し元ゼロ（`ranking/page.tsx`はServer Componentで
   直接DBクエリしており依存なし）かつ存在しないカラム参照で常に500になる機能不全コードだった。
   詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

6. ✅ **完了（2026-07-02）: admin向けE2E検証基盤**
   `test+admin@loop-vocabulary.app`テストアカウント（`profiles.is_admin=true`）を新設し、
   `/admin/srs`の表示・認可（非admin/未ログイン時の拒否）・個別データ非開示・書き込み無しを
   `npm run test:admin`（`test:e2e`にも統合）で自律検証できるようにした。詳細は
   [WORK_HISTORY.md](WORK_HISTORY.md)参照。

7. ✅ **完了（2026-07-02）: プリセット教材パック基盤 + スターターパック4種**
   教材データの標準フォーマット（[src/lib/materials/types.ts](src/lib/materials/types.ts)）、
   静的品質チェック（`npm run validate:materials`）、DB投入+SRS/PDF互換性のエンドツーエンド検証
   （`npm run test:materials`）を新設。「中学英単語 基礎100」「高校英単語 基礎100」
   「英検準2級 基礎100」「大学受験 基礎動詞100」の4パック(計400語)を投入し、`/materials`に
   「はじめての人におすすめ」セクションと期間/ペース/タグのバッジ表示を追加。詳細は
   [WORK_HISTORY.md](WORK_HISTORY.md)参照。
   **調査で判明した既存の技術的負債**（今回は着手せず優先度Bに記載）: 既存31教材・約32,000語の
   `material_words`に、教材内重複1,137件・品詞(pos)未設定10,004件を検出。

8. ✅ **完了（2026-07-02）: 既存教材の品質監査基盤 + 教材インポートE2E追加**
   既存35教材（既存31 + 新規4パック）を対象にした読み取り専用監査スクリプト
   （`npm run audit:materials`、[scripts/materials/audit-existing-materials.mjs](scripts/materials/audit-existing-materials.mjs)）を新設し、
   [MATERIALS_AUDIT.md](MATERIALS_AUDIT.md) / [reports/materials-audit.json](reports/materials-audit.json)を生成。
   `npm run validate:materials`実行時に非ブロッキングで自動更新、`npm run test:materials`には
   既存教材が減っていないか（31件以上維持・総語数0の教材なし）を確認する回帰ガードを追加。
   教材インポートの実ブラウザE2E（`npm run test:materials:e2e`、`test:e2e`にも統合）を新設し、
   未ログイン時のCTA誘導・インポート→単語帳作成→SRS既定値→PDF選択肢反映→再インポート時の
   重複防止までを検証。**DBの書き込み・削除は一切行っていない**（監査は読み取り専用）。
   詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

9. ✅ **完了（2026-07-03）: 4択テストの出題ロジックをSRS状態考慮型に修正**
   `/test/choice`が完全ランダム出題（SRSフィールド未参照）だった問題を修正。
   `src/lib/learning/wordSelection.ts`（新規、後日`src/lib/quiz/`から移動）に、既存カラムから
   都度算出する学習状態ラベル（unseen/due/weak/mastered/learning/reviewing。DBスキーマ変更なし）
   と、未学習優先→due/weak優先の重み付き抽選→直近出題除外、を行う`selectQuizWords`、正解と
   同義・空欄・重複を避けつつ品詞を優先する`pickDistractors`を実装し`/test/choice`に適用。
   `npm run test:quiz`（単体24項目）・`npm run test:quiz:e2e`（実ブラウザ25項目、`test:e2e`にも
   6フロー目として統合）を新設、全PASS。修正過程で判明した既存E2E基盤の不備
   （`resetOnboardingUser`がstudy_results/daily_statsを未リセット）も合わせて修正。
   詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

10. ✅ **完了（2026-07-03）: SRS考慮型の出題ロジックをinput/typing/listening/attackへ横展開**
    項目9の`src/lib/learning/wordSelection.ts`（この際に`src/lib/quiz/`から現在地へ移動）を、
    残る4つの学習モードにも共通適用。調査の過程で2つの独立したバグを発見・修正:
    ①`ListeningTestRunner`が`saveStudyResult()`を一切呼んでおらずリスニングでの学習が
    SRSに反映されていなかった、②`/test/listening`のpage.tsxが存在しないカラム
    `profiles.plan`を参照しておりクエリが常に失敗、**全ユーザーが恒久的にPremiumペイウォール
    表示のまま利用不能**になっていた（`is_premium`参照に修正）。attackモードは
    `word_book_id`でスコープしない設計（他4モードと異なり口座全体から出題）という
    既存の仕様自体は変更せず、出題キューの優先順位付けとダミー選択肢生成のみ統一した。
    `npm run test:quiz`を27項目に拡張、`npm run test:learning-modes:e2e`（新規、20項目、
    `test:e2e`にも7フロー目として統合）を追加、全PASS。詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

11. ✅ **完了（2026-07-03）: attackモードに単語帳スコープ対応（`?book=`）を追加**
    項目10で残課題としていた「attackが`word_book_id`でスコープされておらず口座全体から
    出題される」問題に対応。`/test/attack?book=<word_book_id>`指定時はその単語帳のみから、
    未指定時は従来通り全単語帳横断で出題する（既存の全単語帳横断挙動は維持）。他4モードと
    同じ`sp.book` → `.eq("word_book_id", sp.book)`の慣用パターンを踏襲し、`src/lib/learning/
    wordSelection.ts`本体は無変更。画面上に対象範囲ラベル（「◯◯」から出題中／全単語帳から
    出題中）を新設し、`src/app/wordbooks/[id]/page.tsx`の単語帳詳細ページに
    「⚡ タイムアタック」ボタン（`?book=`付き、従来リンクなし）を追加した。
    `npm run test:learning-modes:e2e`のattackセクションを拡張（対象単語帳＋デコイ単語帳を
    同時に用意し、book指定時はデコイが混入しないこと／指定なしでは両方が母集団になること
    を検証、25項目、全PASS）。詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

12. ✅ **完了（2026-07-03）: `profiles.plan`参照バグをプロジェクト全体で修正**
    項目11の調査中に発見した`wordbooks/[id]/page.tsx`の`profiles.plan`参照バグ（存在しない
    カラムのため`isPremium`が常に`false`扱い）を修正し、同じパターンの箇所を全体検索した
    ところ、他に6箇所（`/plan`, `/extract`, `/weak`の3ページと`/api/ai/weakness-analysis`,
    `/api/ai/extract-words`, `/api/wordbook/[id]/ai-suggest{,/add}`の4API）で同じバグが
    見つかり、全て`profiles.is_premium`を参照する形に統一した。実際のPremiumユーザーが
    AIパーソナル学習プラン・英文抽出・弱点分析・AI単語提案のいずれも使えない状態だった。
    `npm run test:premium-gating`（新規、21項目、`test:e2e`にも8フロー目として統合）で
    非Premium/Premium双方の表示分岐・API 403/非403分岐・5学習モードへの回帰なしを検証、
    全PASS。詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

---

## 🟢 優先度A: 今すぐ着手できる（低工数・高効果・外部依存少）

1. **Search Console初回結果確認**（2026-07-08頃目安）
   登録から約1週間後、「ページ」タブでインデックス状況（登録済み/除外の内訳）と
   検索パフォーマンス（クリック数・表示回数・平均掲載順位）の初回データを確認する。
   外部作業のみ・コード変更なし。SEO記事追加（優先度B）の判断材料にもなる。

## 🟡 優先度B: 次に着手（中工数・利用状況を見てから）

2a. ✅ **完了（2026-07-02）: 既存31教材の完全重複行245件を削除**
   ユーザー承認の上、`npm run materials:dedupe:apply`を実行し完全重複行245件
   （14教材、`material_words`32,587件→32,342件）を削除した。実行前に事前チェック8項目
   （総件数・削除対象件数・対象教材数・意味違い重複が対象外であること・バックアップ/
   ロールバックSQL存在・245件分の復元対応・`words`への無影響）を全て確認してから実施。
   バックアップ（`reports/materials-duplicate-backup.json`）とロールバックSQL
   （`reports/materials-duplicate-rollback.sql`、`INSERT ... ON CONFLICT (id) DO NOTHING`で冪等）は
   削除後も保持している。詳細は[WORK_HISTORY.md](WORK_HISTORY.md)の該当エントリ参照。
   **意味違いの重複行1,952件**（同じ見出し語でも内容が異なる＝別義の可能性）は削除対象外のまま
   保持。`pos`未設定9,997件も今回は触れていない。

2b. ✅ **完了（2026-07-03）: 既存31教材の品詞(pos)未設定のうち自動補完候補3,267件を補完**
   ユーザー承認の上、`npm run materials:pos:apply`を実行し、①同じword+同じmeaningが
   他教材で既にpos設定済み、②代名詞・前置詞・接続詞・冠詞の固定辞書、③数詞・曜日・月・
   基本副詞の固定辞書、④meaningが「〜する」→動詞、⑤meaningが「〜な/〜の」→形容詞、
   の5ルール（高信頼度）に該当する3,267件のみを補完した（`material_words`のpos未設定は
   9,997件→6,730件）。実行前に事前チェック8項目（未設定件数・自動補完候補件数・慎重扱い
   件数・補完対象がpos列のみ・backup/rollback SQL存在・3,267件分の復元対応・既存ユーザーの
   `words`/SRS履歴/teacher機能への無影響）を全て確認してから実施。
   バックアップ（`reports/materials-pos-fill-backup.json`）とロールバックSQL
   （`reports/materials-pos-fill-rollback.sql`、posをNULLに戻すUPDATE文で冪等）は
   補完後も保持している。詳細は[WORK_HISTORY.md](WORK_HISTORY.md)の該当エントリ参照。
   **慎重に扱う6,730件**（追加提案ルール・複数品詞の可能性・熟語句動詞・meaning短すぎ・
   判断材料なし）と**意味違いの重複1,952件**は今回一切触れていない。
   word/meaning/example/example_jaが変更されていないことをサンプル100件で確認済み。

2c. **既存教材へのプリセットメタデータ拡張**
   現在、対象学年・目的・推奨期間・1日目安語数・タグの表示（[presetMeta.ts](src/lib/materials/presetMeta.ts)）
   は新規4パックのみに付与されている。既存31教材にも同様のメタデータを付けたい場合は、
   レジストリにエントリを追加するだけで対応可能（DBスキーマ変更不要）。

2d. **出題の「suspended」ラベル・直近出題履歴の永続化（優先度A完了項目9・10の延長）**
   `suspended`（特定単語の出題を一時停止）は対応するDBカラムが存在せず未実装。必要になった
   場合は`words`に`boolean`列を1つ追加するmigrationから設計する。また、直近出題履歴は
   現状ページ表示中のみ保持（タブを閉じる・再訪問でリセット）。セッションをまたいだ抑制が
   必要になった場合は`localStorage`または新規テーブルでの永続化を検討する。

2e. ✅ **完了（2026-07-03）: attackモードの単語帳スコープ対応**
   優先度A完了項目11で対応済み。`/test/attack?book=<id>`で単語帳指定、未指定時は
   全単語帳横断のまま。詳細は完了項目11参照。

2f. **materials導線からattackへの単語帳引き継ぎ（残課題）**
   `ImportMaterialButton.tsx`の「テスト開始」ボタンは現状`/test/choice?book=`固定で、
   attackへの導線は追加していない（教材インポート直後の推奨モードとして4択のままが
   妥当と判断）。教材インポート後にタイムアタックで遊びたい要望が出た場合は、
   単語帳詳細ページの「⚡ タイムアタック」ボタン（優先度A完了項目11で追加済み）に
   誘導するか、`ImportMaterialButton`側にモード選択を追加するかを検討する。

2g. ✅ **完了（2026-07-03）: `profiles.plan`参照バグの修正**
   優先度A完了項目12で対応済み。`wordbooks/[id]/page.tsx`含む7箇所を`profiles.is_premium`
   参照に統一した。詳細は完了項目12参照。

3. **teacher招待コードの再発行履歴**
   優先度A完了項目3の残課題。現状は再発行すると旧コードの記録が残らない。
   運用上、先生から「前のコードが急に使えなくなった」という問い合わせが増えるようなら、
   `class_invite_history`等の追加テーブルで再発行ログを持たせる設計を検討する。
   **今のところ実クラス数が少ない（本番1件）ため緊急性は低い**。

4. **教材ワンタップ導入の短縮**
   オンボーディング改善の延長。教材ページから単語帳インポートまでのクリック数削減。
   前回のオンボーディング改善が定着してから、追加の効果測定と合わせて実施するのが効率的。

5. **通知・メール導線の整備**
   復習リマインドのメール/プッシュ通知を強化し、継続率を上げる。
   既存の`notify_weekly_email`/`notify_push_enabled`の土台はあるため、活用を広げる形。

6. **SEO記事の追加**
   前回10本追加済み。効果はSearch Console初回結果確認（優先度A-1）が先。
   計測できる状態になってから、反応の良いテーマを優先して追加するのが合理的。

7. **teacher機能の改善（生徒詳細画面）**
   現状はロスターの集計一覧のみ。生徒ごとの苦手単語トップN・学習カレンダー等の詳細画面。
   ただし実際に先生ユーザーの利用が始まってから、どの情報が求められるか見て設計する方が無駄がない。

8. **PWA/モバイル体験の改善**（新規候補・要スコープ整理）
   具体的な要望・課題がまだ整理されていないため、着手前にどこを改善したいか
   （インストール導線・オフライン対応範囲・通知許可導線など）の合意が必要。

9. **教材パックの追加拡充**
   優先度A完了項目7の延長。今回は4パック(400語)のみ。ユーザーの利用状況（どのパックがよく
   インポートされるか）を見てから、次に追加すべきレベル・ジャンルを判断するのが効率的
   （候補は本ドキュメント末尾「次に増やすべき教材候補」参照）。

## 🟠 優先度C: 条件が整ってから（外部要因・法務要因あり、または現時点で不要）

10. **`/admin/srs`のSQL集計RPC化**
    優先度A完了項目2の残課題。現在の全件JS集計は約1,000件では十分高速。
    総単語数が数万〜十万件規模まで増えてから着手すれば十分（今は不要）。

11. **AdSense承認後の広告枠最適化**
    AdSenseの審査状況に依存。承認前に最適化しても意味がないため、**承認され次第**着手。
    審査状況はPRODUCTION_MONITORING.mdの「AdSense/広告まわり」項目で定期確認する。

12. **保護者同意導線**
    先生機能に未成年の生徒が本格的に関わる場合に必要。現状は「本人同意のみ」でMVP化した設計
    （[PHASE2B_TEACHER_DESIGN.md](PHASE2B_TEACHER_DESIGN.md)参照）。
    実際に学校・塾での利用が具体化した段階で、法務観点も含めて設計から見直すべき。

13. **Teacher Planの課金設計**
    設計のみ先行可能（実装・本番課金導入はしない）。教師機能の実利用状況・要望を見てから
    プラン内容を固める方が手戻りが少ない。**課金の本番導入は明示的な承認があるまで行わない**。

## ⚪ 保留・要判断（大きな設計変更を伴う）

- 上記以外の新機能全般は、まず優先度A・Bの安定運用が回り始めてから検討する

## 次に増やすべき教材候補（優先度Bの9番、教材パック拡充の延長）

今回の4パック（中学基礎100・高校基礎100・英検準2級基礎100・大学受験基礎動詞100）の利用状況を
見てから判断するのが基本方針だが、候補として以下を挙げておく。既存の大規模教材（31件）と
レベル帯が重複するため、あくまで「スターターパック」として小規模・高品質に絞って追加する方針を継続する。

- **英検3級 基礎100**: 中学基礎100の次のステップとして自然な位置づけ
- **高校英単語 基礎100（Part 2）**: 今回のPart 1（動詞・名詞・形容詞・副詞100語）の続き
- **大学受験 基礎名詞100**: 今回の「基礎動詞100」と対になる名詞版
- **日常英会話 超基礎50**: 試験対策ではなく実用目的のユーザー向け（既存「日常英会話 基礎フレーズ」
  1500語は初学者には多すぎるため、50語程度の入門版があると導線が滑らかになる）

---

## 今すぐ着手すべきもの（2026-07-02時点の推奨・最大3つ）

優先度Aの主要項目が完了したため、**新機能追加は見送り、以下の運用作業のみを推奨**する。

1. **Search Console初回結果確認を2026-07-08頃に実施**（優先度A-1）。外部作業のみ・コード変更なし。
2. **週次運用チェックリスト（[PRODUCTION_MONITORING.md](PRODUCTION_MONITORING.md) §2）を
   定常運用として回す**。新機能より先に、今回整備した検証基盤（`test:e2e`8フロー・`verify:prod`・
   `verify:srs-global`・`/admin/srs`の目視確認）が実際に週次で回ることを確認する。
3. **既存教材の完全重複行245件の削除は2026-07-02に完了済み**（優先度B-2a）。
   `material_words`32,587件→32,342件、完全重複0件を確認済み。バックアップ・ロールバックSQLは
   `reports/materials-duplicate-*`に保持している。
4. **既存教材の品詞(pos)未設定のうち自動補完候補3,267件の補完は2026-07-03に完了済み**
   （優先度B-2b）。`material_words`のpos未設定9,997件→6,730件、慎重に扱う6,730件・
   意味違い重複1,952件には触れていない。バックアップ・ロールバックSQLは
   `reports/materials-pos-fill-*`に保持している。
5. **上記以外は現時点で「今すぐ」着手する理由が乏しい**。優先度B以降は利用データ
   （Search Consoleの実データ、teacherの実利用状況）が蓄積してから判断する方が手戻りが少ない。

## 判断基準

- **今すぐやる基準**: 低リスク・高効果・外部依存が少ない・既に土台がある
- **次にやる基準**: 中工数だが実装方針が明確・既存機能の延長
- **後回しにする基準**: 外部承認待ち・法務検討が必要・実際の利用状況データが無いと設計を誤りやすい

## 着手時の共通ルール（継続）

- 目的外の変更を混ぜない・機能単位でコミット
- 既存DBの破壊的変更をしない・既存RLSを緩めない
- SRS V2を不用意に戻さない（ロールバック手順は[RELEASE_NOTES.md](RELEASE_NOTES.md)参照）
- 課金の本番導入・外部決済設定は事前承認必須
- 実装後は `tsc` / `build` / 該当する `test:*` / `verify:prod` を通してからデプロイ
