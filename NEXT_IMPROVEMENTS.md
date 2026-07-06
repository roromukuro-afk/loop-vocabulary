# NEXT_IMPROVEMENTS — 次の改善候補（優先順位付き）

> 安定運用フェーズの方針: 新機能実装より先に「今すぐやるべき軽い作業」を優先し、
> 大きめの機能追加は実際の利用状況を見てから判断する。
> 各項目は着手前に個別のご確認をいただく（本ドキュメントは提案のみ・実装はまだしない）。
>
> **2026-07-05時点: 優先度A（下記30項目）はすべて完了。現在は次の優先度整理フェーズ。**
> 2026-07-04には収益化・成長観点の監査も実施（詳細は本ドキュメント内
> 「💰 収益化・成長 監査」参照）。教材追加以外の指摘事項は下記の優先度A/B/Cに反映済み。
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

13. ✅ **完了（2026-07-04）: 学習モード入口の整理・対象範囲ラベルの全モード統一**
    単語帳詳細ページ(`/wordbooks/[id]`)に4択/入力/タイピング/リスニング/タイムアタック/
    PDFテスト/SRS復習の7導線をすべて`?book=<id>`引き継ぎ付きで整理して追加（従来は
    4択・タイピング・復習の3つのみ、入力/リスニング/PDFへの導線は存在しなかった）。
    attackで先に導入した対象範囲ラベル（「◯◯」から出題中／全単語帳から出題中、
    `data-testid="quiz-scope-label"`）のロジックを`src/lib/learning/scopeLabel.ts`
    （新規共有ヘルパー）に切り出し、choice/input/typing/listening/review/attackの
    全モードへ適用。PDFは`?book=`でのプリセレクト＋対象語数表示を追加。reviewは
    従来モード選択ボタンが`?book=`を引き継いでおらず復習実行時にスコープが失われる
    バグがあったため、これも合わせて修正。typing/listeningのPremium制限は既存の
    ルート単位ブロック（存在は見える・利用時にプレミアム案内・Premiumユーザーは
    正常利用）をそのまま維持し、ゲーティング方式自体は変更していない。
    `scripts/testing/e2e/entry-points.mjs`（新規、33項目、`test:e2e`にも12フロー目
    として統合）で7導線のhref・各モードのラベル表示・PDF語数・review引き継ぎ・
    Premium有無の分岐を検証、全PASS。詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

14. ✅ **完了（2026-07-04）: 教材インポート後導線の整理**
    項目13で残課題としていた「`ImportMaterialButton.tsx`の「テスト開始」が
    `/test/choice?book=`固定」に対応。新規インポート直後・既にインポート済みの
    再訪問時のいずれも、メインCTA「📖 単語帳で学習モードを選ぶ」（`/wordbooks/<id>`）+
    サブCTA「🎯 4択で始める」（`/test/choice?book=`）「📄 PDFテストを作る」
    （`/pdf?book=`）の3ボタン構成に統一した。従来、新規インポート時は成功メッセージ
    表示後800msで自動的に`/wordbooks/<id>`へ遷移するだけで選択肢がなく、既存インポート済み
    時のみ「単語帳を開く」「テスト開始（4択固定）」の2ボタンだった状態を、両方のケースで
    同じ3ボタンパネルに統一（既存インポート済み時は「この教材はすでに単語帳に
    インポート済みです」という案内文も追加）。`scripts/testing/e2e/materials.mjs`を
    更新（23項目、自動遷移前提だった1件のアサーションをボタンクリック経由の遷移確認に
    更新、サブCTA2件の遷移確認を追加）。全PASS。詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

15. ✅ **完了（2026-07-04）: 既存31教材へのpresetMeta拡張**
    項目2cで残課題としていた「既存31教材にpresetMetaが未登録」に対応。
    `src/lib/materials/existingMaterialMeta.ts`（新規、単語データを持たない表示専用
    レジストリ）に既存31教材ぶんの`grade`/`purpose`/`recommendedWeeks`/`dailyWordTarget`/
    `category`/`tags`を追加し、`presetMeta.ts`で新規4パック由来のメタデータとマージする形に
    変更。`types.ts`の`ALLOWED_TAGS`に「大学受験向け」「TOEIC対策」「日常会話」「重要語」
    「完成・発展」を、`ALLOWED_CATEGORIES`に「toeic」「general」を追加。`/materials`一覧
    ページのカードに`preset.grade`を追加表示し、従来どのカテゴリセクションにも属していなかった
    「学び直し・日常会話」系5教材（exam_type="一般"）向けに新セクション「日常会話・学び直し」
    を追加した。`/materials/[id]`詳細ページは既存の`{preset && (...)}`ブロックが無変更のまま
    自動的に既存31教材でも表示されるようになった。grade/purpose/recommendedWeeksは各教材の
    title・level・exam_type・語数から推定した目安であり、市販教材の説明文の転載はしていない。
    調査中に副次的発見: `/materials/[id]`の総語数集計クエリに`.limit()`が無くSupabase既定の
    1000件で頭打ちになるバグ（1000語超の教材15件以上に影響）を発見したが、今回のスコープ外
    のため修正せず別タスクとして提案した（`task_b6814f96`）。
    検証: `tsc --noEmit` / `build` / `validate:materials` / `test:materials`（18/18）/
    `test:materials:e2e`（23/23）/ `test:e2e`（9フロー全PASS）/ `test:smoke` /
    `verify:prod` / `verify:srs-global`、全PASS。詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

16. ✅ **完了（2026-07-04）: `/materials/[id]`の総語数集計クエリの`.limit()`欠如を修正**
    項目15で発見・提案した`task_b6814f96`に対応。総語数(`totalWords`)は
    `.select("*", { count: "exact", head: true })`による厳密なcountクエリに変更し、
    行データを一切取得せずDB側で正確な件数のみを取得する形にした。レベル別タブの
    件数内訳（`levelCounts`）はPostgRESTがGROUP BY集計を返せないため、`level`列のみを
    `.range()`でページングして全件取得する方式を維持（word/meaning等の重い列は含まない
    ため軽量）。表示用の単語リスト自体（`.limit(3000)`）は現状の最大教材(2,500語)を
    上回る余裕があり不具合の対象ではなかったため無変更。一覧ページの語数表示は
    `get_material_word_counts` RPCが`GROUP BY COUNT`をDB側で実行しておりこの不具合の
    対象外、教材インポートAPIの単語コピーは元から`.range()`によるページングが実装済みで
    こちらも対象外であることを確認した。`scripts/testing/e2e/materials.mjs`に、
    実際に1000語を超える既存教材（1,500語・2,000語、教材データ自体は変更せず閲覧のみ）で
    正しい総語数が表示されることを確認するテストを追加（25項目）。全PASS。
    詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

17. ✅ **完了（2026-07-04）: 教材パックの追加拡充 Part2（4パック・計350語）**
    優先度B項目9で候補として挙げていた4パックをすべて追加した:
    「英検3級 基礎100」（100語、英検3級レベルの日常語彙）、「高校英単語 基礎100 Part2」
    （100語、既存Part1の続編として分析・論証系語彙）、「大学受験 基礎名詞100」（100語、
    既存「基礎動詞100」の姉妹編）、「日常英会話 超基礎50」（50語、既存「日常英会話
    基礎フレーズ」1500語には多すぎる初学者向けの入門版）。すべてオリジナル作成で
    市販教材の転載はしていない。`src/data/presets/`に4ファイルを新規追加し、
    `index.ts`の`PRESET_PACKS`に登録。既存の`presetMeta.ts`は`PRESET_PACKS`から
    自動導出する仕組みのため、新4パックのgrade/purpose/recommendedWeeks/
    dailyWordTarget/category/tagsは追加コード不要で自動的に`/materials`・
    `/materials/[id]`に反映された。`scripts/materials/{validate-materials,
    test-materials,seed-preset-materials}.mjs`（3スクリプトとも新規パックを
    ハードコードでimportする設計のため）を更新し、`PRESET_PACKS`配列に追加。
    dev previewで新4パックの詳細ページ・`/materials`一覧（新設「日常会話・学び直し」
    セクション含む）を目視確認済み。検証: `tsc --noEmit` / `build` /
    `validate:materials`（8パック、errors=0） / `test:materials`（26/26、既存31教材
    +新規4パック=35件+今回4パック=39件の非破壊確認含む） / `test:materials:e2e`
    （25/25、回帰なし） / `test:e2e`（9フロー全PASS） / `test:smoke` / `verify:prod` /
    `verify:srs-global`、全PASS。詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

18. ✅ **完了（2026-07-04）: AdSense審査状況の確認・アプリ側の不足項目整理**
    AdSense関連の実装状況を調査し、`NEXT_PUBLIC_ADSENSE_CLIENT`（本番設定済み）・
    `adsbygoogle.js`・`<ins class="adsbygoogle">`・`ads.txt`（Publisher ID一致）が
    すでに実装済みで、プレースホルダではなく実際のAdSense接続であることを確認した。
    広告ユニットのスロットID（`NEXT_PUBLIC_ADSENSE_SLOT_BANNER`等）は未設定のため
    個別広告は未表示（過剰表示の事故なし）。robots.txt/sitemap/Search Console登録は
    2026-07-01の監査で既に整合済みで問題なし。調査で発見した唯一の実質的な不足点
    「プライバシーポリシーがWeb版のGoogle AdSense・広告Cookie・オプトアウト手段に
    触れておらず、Android/iOSアプリ版のAdMobのみ記載されていた」を修正し、Google広告設定
    （オプトアウト）・Googleの広告ポリシーへのリンクを追記した。`README.md`§7の
    「プレースホルダ実装前提」という古い説明も、実際にAdSense/AdMobへ接続済みである
    現状に合わせて更新。AdSense管理画面での審査ステータス・ポリシーセンター警告・
    ads.txt警告の確認方法を[ADSENSE_SETUP.md](ADSENSE_SETUP.md)（新規）にまとめた
    （管理画面の実際の操作・スロットIDの発行はオーナー側の作業）。
    検証: `tsc --noEmit` / `build` / `test:smoke` / `test:e2e`（9フロー全PASS） /
    `verify:prod` / `verify:srs-global`、全PASS。詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

19. ✅ **完了（2026-07-04）: AdSense広告ユニットの本番投入（1箇所限定）**
    オーナーがAdSense管理画面で広告ユニット「Loop Vocabulary Display Banner」
    （ディスプレイ広告・レスポンシブ）を作成し発行された`data-ad-slot="5952840845"`を、
    `NEXT_PUBLIC_ADSENSE_SLOT_BANNER`としてVercel Production環境変数に設定した。
    修正前は`BannerAdPlaceholder`が9ページ10箇所に配置されており、スロットID有効化と
    同時に全箇所で一斉に実広告が表示される状態だったため、AdSenseがまだ`Getting ready`
    （審査未確定）であることを踏まえて**`/dashboard`の1箇所のみ**に限定し、残り8ページ
    （`materials`×2箇所・`materials/[id]`・`review`・`road`・`settings`・`stats`・`weak`・
    `wordbooks/[id]`・`learn`のレッスン結果画面）からは呼び出しとimportを削除した
    （`NativeAdCard`は引き続き各所に残置——`NEXT_PUBLIC_ADSENSE_SLOT_INFEED`が未設定のため
    本番では何も表示されない）。Publisher ID・スロットIDとも新規作成・推測はしていない。
    検証: `tsc --noEmit` / `build` / `test:smoke` / `test:e2e`（9フロー全PASS） /
    `verify:prod` / `verify:srs-global`、全PASS。詳細は[ADSENSE_SETUP.md](ADSENSE_SETUP.md)§4・
    [WORK_HISTORY.md](WORK_HISTORY.md)参照。

20. ✅ **完了（2026-07-04）: 単語帳削除バグの修正（収益化監査Phase 1で発見・最優先修正）**
    収益化観点の監査（本ドキュメント末尾「💰 収益化・成長 監査」参照）の中で、
    「ユーザーが作成・教材インポートで作った単語帳を削除する手段が一切存在しない」ことを
    確認した。UIに削除ボタンが無いのはもちろん、`/api/wordbook/[id]`にDELETEハンドラ自体が
    存在せず、RLS（`word_books owner all`ポリシー）自体は削除を禁止していなかった
    （純粋にアプリ側の機能欠落）。放置した場合、`words.word_book_id`が`on delete set null`
    のため、もし将来DB側だけで削除しても単語が孤立し、`/review`のデフォルト（book未指定）
    復習プールに永久に残り続ける「幽霊単語」問題が起きる設計だったため、単語帳削除時は
    紐づく単語も明示的に削除する仕様とした（`study_results.word_id`は`on delete cascade`の
    ため学習履歴も安全に連鎖削除される。`daily_stats`は日次集計のみで単語IDに依存しない
    ため影響なし。共有単語帳の`import-shared`は取込時に単語を丸ごとコピーする設計のため、
    元の単語帳を後で削除しても他ユーザーの取込先単語帳には影響しない）。
    `src/app/api/wordbook/[id]/route.ts`（新規、DELETEハンドラ）と
    `src/components/wordbooks/DeleteWordbookButton.tsx`（新規、確認ダイアログ付き）を追加し、
    `/wordbooks/[id]`の共有セクション下に危険操作として控えめに配置した。
    DBスキーマ変更・RLS変更は行っていない。
    `scripts/testing/e2e/wordbook-delete.mjs`（新規、`npm run test:wordbook-delete`、
    `test:e2e`にも13フロー目として統合）で、削除ボタン表示→削除実行→DB上でword_books行・
    words行の両方が消えている→`/wordbooks`一覧・`/dashboard`・`/review`に残骸が出ない→
    削除済みIDへの直接アクセスが404になる、を実ブラウザで検証。
    検証: `tsc --noEmit` / `build` / `test:smoke` / `test:e2e`（13フロー全PASS） /
    `verify:prod` / `verify:srs-global`、全PASS。詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

21. ✅ **完了（2026-07-04）: TOEIC/ビジネス英語スターターパック4種の追加（計400語）**
    優先度B完了項目10（旧）で提案していたTOEIC/ビジネス教材の弱さに対応。「TOEIC 基礎100」
    「TOEIC 頻出動詞100」「ビジネス英語 基礎100」「会議・メール英語100」の4パック（各100語、
    計400語）を追加した。すべてオリジナル作成で、市販教材・TOEIC公式問題集からの転載はしていない。
    既存のTOEIC/一般教材（1000語）と照合し、重複を避けて語彙を選定した。
    `src/data/presets/`に4ファイルを新規追加し、`index.ts`の`PRESET_PACKS`に登録。
    `ALLOWED_TAGS`に「ビジネス英語」「社会人向け」「仕事で使える英語」を追加し、
    `/materials`の「TOEIC・ビジネス英語」セクションの一致条件を`exam_type === "ビジネス英語"`
    にも対応するよう拡張した（既存のTOEIC判定は変更なし）。`LEVEL_COLOR`に新レベル用の
    バッジ色（TOEIC基礎/TOEIC/ビジネス基礎/ビジネス実践）を追加。
    `scripts/materials/{validate-materials,test-materials,seed-preset-materials}.mjs`
    （3スクリプトとも新規パックをハードコードでimportする既存パターンのため）を更新。
    検証: `tsc --noEmit` / `build` / `validate:materials`（12パック、errors=0、警告2件は
    フレーズ動詞の語幹検出の既知の誤検知） / `test:materials`（34/34、DB語数一致・SRS既定値・
    既存31教材への非破壊確認含む） / `test:materials:e2e`（25/25、回帰なし） /
    `test:e2e`（13フロー全PASS） / `test:smoke` / `verify:prod` / `verify:srs-global`、全PASS。
    詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

22. ✅ **完了（2026-07-04）: 復習リカバリーモードの実装**（収益化監査#2、離脱防止）
    優先度A項目2で提案していた「復習の雪だるま問題」に対応。`/review`の復習待ちが
    `RECOVERY_THRESHOLD`（20語）以上溜まった時に、ダッシュボード/レビュー画面で
    「まず10語だけ」「20語だけ進める」ボタンを表示し、選んだ件数だけ出題する
    「リカバリーモード」を実装した。URLは`/review?start=1&mode=recovery&limit=10`
    （`&book=<id>`で単語帳スコープにも対応）。出題プールは既存の`.limit(50)`due取得を
    そのまま再利用し、`next_review_at`昇順（最遅延優先）+ `wrong_count`降順（同時刻の
    場合のタイブレーク）でソート済みの配列を`Array.slice(0, limit)`するだけなので、
    追加のDBクエリ・SRS V2の採点/更新ロジック（`saveStudyResult`/`applySrsV2`）は
    一切変更していない。完了後は「今日はここまででOK！」「残り{N}語は少しずつ消化して
    いきましょう」という前向きな表示に切り替わり、ユーザーを責める文言は使っていない。
    通常復習（`mode=flip`・`mode=choice`）は完全に従来通り、上限なしで全due語を出題する。
    ダッシュボードの「今日の復習」ボタン下にも、due件数が20以上の時だけ「まずは10語だけ→」
    の控えめなリンクを追加した。
    `scripts/testing/e2e/recovery-mode.mjs`（新規、`npm run test:recovery-mode`、
    `test:e2e`にも14フロー目として統合）で、35語due時のバナー表示→10語モードで
    ちょうど10語だけ出題・DBで10語のみSRS更新される→残り25語でバナー継続→20語モードで
    20語出題→残り5語でバナー消滅→通常復習は残り全5語を出題、をbook指定のデコイ単語帳
    （スコープ隔離確認用）も交えて実ブラウザで検証。DBスキーマ変更・RLS変更なし。
    検証: `tsc --noEmit` / `build` / `test:smoke` / `test:recovery-mode`（単独実行、全項目
    PASS） / `test:e2e`（14フロー全PASS） / `verify:prod` / `verify:srs-global`、全PASS。
    詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

23. ✅ **完了（2026-07-04）: 教材・辞書ページの内部リンク強化**（収益化監査#7、SEO流入・低コスト高効果）
    優先度A項目3で提案していた内部リンクの弱さに対応。`/materials/[id]`に「関連する教材」
    セクションを新設し、`materials.exam_type`を`大学受験・共通テスト`/`中学・高校基礎`/
    `英検対策`/`TOEIC・ビジネス英語`/`日常会話・学び直し`の5グループに正規化した上で、
    同グループの他教材を最大6件表示する（自身は除外。material_wordsを取得しない軽量
    クエリで4列・最大6行のみ取得）。新規追加したTOEIC/ビジネス英語教材4種も正しく
    同グループとして表示されることを確認済み。教材詳細ページには「🔍 辞書で単語を調べる」
    「📚 教材一覧に戻る」の回遊リンクも追加した（既存のインポート導線は無変更）。
    `/dictionary`には「単語帳を自分で作るのが大変な方へ」というカードを追加し、
    `/materials`への導線を新設（未ログインユーザーにも表示）。`/materials`のカテゴリ別
    表示に、ページ内アンカージャンプ（クイックジャンプ）を追加。`/grammar`・`/guide`・
    `/faq`の下部に`/materials`・`/dictionary`への相互リンクを追加した（新規LPの作成はせず、
    既存ページ内のリンク整理のみ）。SEOメタ情報は監査の結果すでに強かったため大きな変更は
    せず、`/dictionary`にのみ欠けていたBreadcrumb構造化データ（2階層）を追加した。
    `scripts/testing/e2e/internal-links.mjs`（新規、`npm run test:internal-links`、
    `test:e2e`にも15フロー目として統合）で、カテゴリクイックジャンプ表示・関連教材表示
    （新規ビジネス英語教材を含む）・関連教材リンクの遷移・教材⇄辞書の相互導線・既存
    インポート導線の非破壊・モバイル幅(375px)での横スクロール無し、を実ブラウザで検証。
    DBスキーマ変更・RLS変更・教材データ本体の変更・AdSense広告枠追加なし。
    検証: `tsc --noEmit` / `build` / `test:smoke` / `test:internal-links`（単独実行、全項目
    PASS） / `test:materials:e2e`（25/25、回帰なし） / `test:e2e`（15フロー全PASS） /
    `verify:prod` / `verify:srs-global`、全PASS。詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

24. ✅ **完了（2026-07-04）: カテゴリ別公開LP（TOEIC・ビジネス英語）の新設**（収益化監査#7の延長、SEO流入・社会人獲得）
    社会人ユーザー獲得に直結するTOEIC・ビジネス英語の2LPを新設した。`/materials/toeic`
    （TOEIC教材4件: TOEIC基礎100・TOEIC頻出動詞100・既存TOEIC頻出単語800/600）と
    `/materials/business`（ビジネス英語教材2件: ビジネス英語基礎100・会議/メール英語100）。
    `/materials/[id]`（動的ルート）とはNext.js App Routerの静的セグメント優先ルールにより
    衝突しないことを`build`のルート一覧・実ブラウザ確認の両方で検証済み（`toeic`/`business`が
    UUID形式の教材IDと一致することはあり得ないため実質的にも安全）。各LPはmetadata
    （title/description/OGP）・Breadcrumb JSON-LD・ItemList JSON-LDを設定し、教材カード・
    学習の流れ（TOEICは「教材を選ぶ→単語帳に追加→復習→テスト」、ビジネス英語は
    「調べる→登録→復習→テスト」）・辞書導線・LP間相互リンク・`/materials`への導線で構成。
    SEOテキストは短い説明文のみに留め、教材カード・学習導線を主役にした。`/materials`の
    「TOEIC・ビジネス英語」セクション見出し下に、UIをゴチャつかせない小さなリンク行
    （「TOEIC対策ページへ →」「ビジネス英語ページへ →」）を追加。
    `scripts/testing/e2e/category-lps.mjs`（新規、`npm run test:category-lps`、`test:e2e`にも
    16フロー目として統合）で、両LPの200表示・教材カード件数と内容・教材詳細への遷移・
    辞書導線・LP間相互リンク・`/materials`からの導線・モバイル幅(375px)での崩れなし・
    既存`/materials/[id]`への非影響、をすべて実ブラウザで検証。
    DBスキーマ変更・RLS変更・教材データ本体の変更・AdSense広告枠追加なし。
    検証: `tsc --noEmit` / `build`（ルート一覧でtoeic/businessが独立ルートとして生成される
    ことを確認） / `test:smoke` / `test:internal-links`（回帰なし） / `test:category-lps`
    （単独実行、全項目PASS） / `test:materials:e2e`（25/25、回帰なし） / `test:e2e`
    （16フロー全PASS） / `verify:prod` / `verify:srs-global`、全PASS。
    詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

25. ✅ **完了（2026-07-04）: カテゴリLPの公開URL・sitemap・canonical・robots・Search Console対応確認**（前項目24の仕上げ）
    前回新設した`/materials/toeic`・`/materials/business`が実際にSEOで拾われるよう、
    公開URL・クロール導線を確認・修正した。**発見した不足点**: `src/app/sitemap.ts`に
    両LPが含まれていなかった（既存教材の動的ルートのみ登録され、新規静的LPを追加漏れ）→
    修正済み。両LPのmetadataに`alternates.canonical`が未設定だった（`/materials/[id]`との
    競合可能性を無くすため明示）→ 追加済み。`robots.txt`は元々対象パスをブロックしておらず
    修正不要だった。JSON-LD（BreadcrumbList・ItemList）は各LPに1個ずつ正しく実装済みで
    パース不能な不正値も無いことを確認した。内部リンク（`/materials`⇄各LP・LP間相互リンク・
    `/dictionary`⇄`/materials`・関連教材・guide/grammar/faqからの導線）はすべて前回までに
    実装済みであることを再確認した。
    `scripts/testing/seo-lp-audit.mjs`（新規、`npm run verify:seo-lp-audit`、HTTPのみで
    ブラウザ不要）を新設し、本番の`/sitemap.xml`に主要ページ・両LPが含まれるか、
    `/robots.txt`が対象パスをブロックしていないか、両LPのcanonicalが自分自身を指すか、
    JSON-LDが妥当なJSONか、既存`/materials/[id]`への非影響を検証できるようにした
    （`verify:prod`と同様デフォルトで本番URLを対象とする）。
    `SEARCH_CONSOLE_SETUP.md`に、オーナーがURL検査ツールで個別にインデックス登録を
    リクエストすべきURL（`/materials/toeic`・`/materials/business`・`/materials`・
    `/dictionary`）を追記した。
    DBスキーマ変更・RLS変更・教材データ本体の変更・AdSense広告枠追加・新規LP作成なし。
    検証: `tsc --noEmit` / `build` / `test:smoke` / `test:internal-links`（回帰なし） /
    `test:category-lps`（回帰なし） / `test:e2e`（16フロー全PASS） / `verify:prod` /
    `verify:srs-global` / `verify:seo-lp-audit`（新規、全項目PASS）、全PASS。
    詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

26. ✅ **完了（2026-07-05）: ダッシュボードに習得率カード・苦手単語カードを追加**（収益化監査#4、優先度B-11）
    `/dashboard`に、学習中ユーザー（`hasWords=true`）向けの2枚の新規カードを追加した。
    **習得率カード**（`data-testid="mastery-card"`）: 習得済み/学習中/苦手の3区分（排他的・
    合計は総語数と一致）と全体習得率%を表示。習得済みは`mastery>=80`（`wordbooks/[id]`の
    既存基準を再利用）、苦手は`is_weak=true AND mastery<80`、学習中は残り。全体習得率は
    「習得済み÷総語数」で算出（`mastery`列の全件平均を取ると単語を全件フェッチする必要が
    あり「1回の表示で大量のwordsを取得しない」制約に反するため、カウントクエリのみで
    安全に算出できるこの定義を採用）。「単語帳別に見る」（`/wordbooks`）「復習する」
    （`/review?start=1&mode=flip`）の導線付き。
    **苦手単語カード**（`data-testid="weak-words-card"`）: `/weak`と同じ抽出条件
    （`is_weak.eq.true,wrong_count.gt.0`・`wrong_count desc`）で上位5件のみ表示（大量表示なし）、
    「すべて見る →」で`/weak`へ。非Premiumユーザーには苦手単語がある場合のみ控えめな
    「詳しい弱点分析はPremiumで確認 →」を表示（新規AI分析機能は実装せず、既存`/weak`の
    Premium導線パターンを踏襲）。
    データ取得は既存の`Promise.all`に3クエリ追加するのみ（`masteredCount`/`weakCount`は
    `count:"exact",head:true`のカウントのみ、`weakWords`は5件limit）で、新規RPCやDB
    スキーマ変更は行っていない。
    アクショングリッドに「🎯 苦手単語を復習」「🔍 単語を調べる」を追加し、下部「教材・その他」
    グリッドにあった重複の「苦手単語」タイルは削除して統合した（`/dictionary`は従来
    `BottomNav`/ヘッダーに導線が無かったため今回追加）。
    **検証で発見した既存バグ**（本タスクとは無関係の`/weak/page.tsx`の既存コード）:
    「🤖 AI解説」`Link`にServer Componentから直接`onClick={(e) => e.stopPropagation()}`を
    渡しており、苦手単語が1件以上ある状態で`/weak`を開くと"Event handlers cannot be passed
    to Client Component props"でサーバーレンダリングが必ずクラッシュしていた（今回の
    苦手単語カード「すべて見る →」導線のテストで発覚）。該当`onClick`は他に阻止すべき
    親要素のクリックハンドラが無く不要だったため削除し修正（動作変更なし）。
    新規E2E `scripts/testing/e2e/dashboard-insights.mjs`（`npm run test:dashboard-insights`、
    `test:e2e`のステップ17として追加）: 0語ユーザーでカード非表示・表示崩れ無し、
    通常ユーザーでの内訳表示・苦手単語表示・各リンク導線・Premium導線・重複タイル
    非存在、due単語20件以上でも既存のリカバリーヒント（`dashboard-recovery-hint`）が
    新カードと共存して壊れないこと、モバイル幅(375px)での横スクロール無し、を検証。
    DBスキーマ変更・RLS変更・SRS V2中核ロジック変更・teacher機能変更・教材データ変更・
    AdSense広告枠追加・学習中/復習中画面への広告追加・単語帳削除機能への変更なし。
    検証: `tsc --noEmit` / `build` / `test:smoke` / `test:dashboard-insights`（新規、
    全項目PASS） / `test:e2e`（17フロー全PASS、回帰なし） / `verify:prod` /
    `verify:srs-global`、全PASS。
    詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

27. ✅ **完了（2026-07-05）: 社会人向け教材3パックの追加（TOEIC頻出名詞100・経済/企業ニュース英単語100）**（収益化監査#1・#3の延長）
    社会人ユーザー獲得・TOEIC/ビジネス英語LPの拡充のため、「TOEIC 頻出名詞100」
    「経済ニュース英単語100」「企業ニュース英単語100」の3パック（計300語）を追加した。
    すべてオリジナル作成（市販教材・公式問題集・ニュース記事本文からの転載なし）。
    「TOEIC 頻出名詞100」は`examType: "TOEIC"`（「TOEIC 頻出動詞100」と対になる名詞版、
    優先度B項目9の残課題を解消）、経済/企業ニュース2パックは`examType: "ビジネス英語"`
    （既存の`/materials/business`フィルタ・`/materials`のTOEIC・ビジネス英語セクション・
    `/materials/[id]`の関連教材グルーピングがすべて`exam_type`ベースのため、コード変更なしで
    自動的に表示対象になる）とした。
    既存12パック・31教材（計1,032語のプリセット語彙）との重複を機械的にチェックし、
    ユーザー提案の例語（`acquisition`・`merger`・`workforce`・`subsidiary`・`interest rate`・
    `supply`等）が既存パックと重複していたため、`buyout`・`hostile takeover`・`headcount`・
    `parent company`・`interest rate hike/cut`・`supply chain`等の意味的に近い別語へ置き換えた。
    `ALLOWED_TAGS`に「経済ニュース」「企業ニュース」「ニュース英語」「学び直し」の4タグを
    追加（表示専用、DBスキーマ変更なし）。`/materials/toeic`・`/materials/business`の
    紹介文をそれぞれ1文だけ軽く調整（大きなSEO文追加・煽り文言は無し）。
    新規パックは`src/data/presets/*`（3ファイル）+ `index.ts`への登録に加え、
    `scripts/materials/{seed-preset-materials,validate-materials,test-materials}.mjs`の
    3スクリプトにも同じパターンでimport・配列登録した（既存4パック追加時と同じ設計）。
    DBスキーマ変更・RLS変更・SRS V2中核ロジック変更・teacher機能変更・既存46教材データ変更・
    AdSense広告枠追加なし。
    テスト: `scripts/testing/e2e/category-lps.mjs`の想定教材カード数を実態に合わせて更新
    （TOEIC 4→5件、ビジネス英語 2→4件）し、新3パックのタイトル表示チェックを追加。
    検証: `tsc --noEmit` / `build` / `validate:materials`（15パック・errors=0） /
    `test:materials`（40項目PASS、既存31教材への非破壊確認含む） /
    `test:materials:e2e`（25項目PASS、回帰なし） / `test:category-lps`（更新後、全項目PASS） /
    `verify:seo-lp-audit`（本番、17項目PASS） / `test:e2e`（17フロー全PASS、回帰なし） /
    `test:smoke` / `verify:prod` / `verify:srs-global`、全PASS。
    詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

28. ✅ **完了（2026-07-05）: ニュース英語向け公開LP（`/materials/news`）の新設**（収益化監査#1・#3の延長）
    経済ニュース・企業ニュースを英語で読みたい社会人・投資/ビジネス関心層を取り込むため、
    `/materials/toeic`・`/materials/business`に続く3本目のカテゴリLPとして`/materials/news`を
    新設した。主役は「経済ニュース英単語100」「企業ニュース英単語100」の2教材、関連教材として
    「ビジネス英語 基礎100」「TOEIC 頻出名詞100」「TOEIC 頻出動詞100」の3教材を別セクションで
    表示する（ニュース英語LPの主役が薄まらないよう、ItemList JSON-LDには主役2教材のみを含めた）。
    `/materials/[id]`という既存の動的ルートとの競合は`/toeic`・`/business`新設時と同じ理由
    （Next.js App Routerが同階層の静的セグメントを動的セグメントより優先して解決するため）で
    発生しないことを確認済み。
    `/materials`の「TOEIC・ビジネス英語」セクションの`landingPages`にニュース英語ページへの
    リンクを追加、`/materials/business`にも「📰 経済・企業ニュースの英単語も学ぶ」の内部リンクを
    追加した（`/materials/toeic`は変更せず、既存2LPの構造は無変更）。
    SEO対応は既存2LPと同品質: `metadata.title`/`description`/OGP/`alternates.canonical`、
    BreadcrumbList・ItemList JSON-LD、`src/app/sitemap.ts`への追加（priority 0.85）。
    robots.txtは元々`/materials`配下をブロックしておらず修正不要だった。
    新規教材データの追加は行っていない（既存の経済/企業ニュース英単語100をそのまま活用）。
    DBスキーマ変更・RLS変更・SRS V2中核ロジック変更・teacher機能変更・AdSense広告枠追加なし。
    テスト: `scripts/testing/e2e/category-lps.mjs`に新規セクション（9. `/materials/news`）を
    追加し、200表示・H1・主役教材カード2件・関連教材3件・`/dictionary`導線・
    `/materials/business`⇄`/materials/news`・`/materials`⇄`/materials/news`の相互導線・
    モバイル幅崩れなし・`/materials/[id]`とのルーティング非競合を検証。
    `scripts/testing/seo-lp-audit.mjs`・`scripts/testing/verify-prod.mjs`にも`/materials/news`を
    追加。
    検証: `tsc --noEmit` / `build` / `test:category-lps`（28項目、全PASS） /
    `test:internal-links`（回帰なし） / `verify:seo-lp-audit`（デプロイ後、全項目PASS） /
    `test:e2e`（17フロー全PASS、回帰なし） / `test:smoke` / `verify:prod`
    （デプロイ後、全項目PASS） / `verify:srs-global`、全PASS。
    詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

29. ✅ **完了（2026-07-05）: ゲーミフィケーション×リワードチケット連携「今日の達成チケット」の追加**（収益化監査#5）
    継続率向上のため、ダッシュボードに「🎟️ 今日の達成チケット」カードを新設した。
    今日の学習達成（`studied>=dailyGoal`）・復習10語達成（`studied>=10`）・苦手単語を復習
    （今日`study_results`でis_weak=trueの単語に解答した件数>=1）・7日連続達成
    （`streak>=7`）の4種を「チケット」風タイル（🎟️獲得済み/グレーアウト未達成）で表示し、
    未達成のうち最初の1件について「あと◯語/◯日で達成」の進捗ヒントを出す。既存の
    デイリーミッション（📋 今日5語・目標◯語・連続学習・100語登録の4チェックリスト）とは
    役割を分け、こちらは「今日集めたごほうび」を振り返る発表カードとして機能させる
    （今日の学習達成チケットは目標達成ミッションと同じ条件を再利用しているが、
    チェックリストと収集物という異なる文脈で示している）。
    判定ロジックは`src/lib/gamification/rewardTickets.ts`（新規）に純粋関数として切り出し、
    ダッシュボードのSSR描画からは`computeTodayTickets()`/`nextTodayTicket()`を呼ぶのみ。
    苦手単語の今日の復習件数は、`study_results`に`words!inner(is_weak)`の埋め込みJOINで
    `count:"exact",head:true`のカウントのみ取得（行データは取得しない）する新規クエリを
    既存の`Promise.all`に1件追加した。
    **リワードチケット連携について**: DBには既に`reward_tickets`テーブル（リワード広告視聴で
    付与、`src/lib/native/rewards.ts`）が存在するが、これはユーザーの明示的なクリック操作
    （広告視聴）をトリガーに1回だけ書き込む設計であり、今回のダッシュボードSSR描画時に
    同じテーブルへ書き込むと、ページを開くたびに再付与されてしまう（レンダーは冪等な
    読み取りであるべきで、副作用のある書き込みをSSR中に行うのはNext.jsのベストプラクティスに
    反する上、二重付与を防ぐ仕組み＝新しい重複防止用の列やテーブルが必要になり
    「DBスキーマ変更を避ける」という今回の制約と衝突する）。そのため今回はユーザー指示の
    通り「チケット風UI」「次の達成までの進捗表示」に留め、`reward_tickets`への実際の
    付与（消費型チケット機能）は行っていない。実際に付与する場合は、専用の「受け取る」
    ボタン＋サーバーアクション（1日1回のみ付与できるガード付き）として別タスクで設計する
    ことを提案する（下記「次に増やすべき教材候補」に類する形で本ドキュメント末尾に残課題
    として記載）。
    子ども向けギャンブル的表現・射幸性の強い演出（ガチャ・くじ引き風の抽選演出等）は使わず、
    「達成すればもらえる」という単純な条件明示に留めた。Premiumへの誘導は行っていない
    （既存のPremiumバナーが別途あるため、このカード内には追加しない）。
    DBスキーマ変更・RLS変更・SRS V2中核ロジック変更・teacher機能変更・教材データ変更・
    AdSense広告枠追加・学習中/復習中画面への広告追加なし。
    テスト: `scripts/testing/test-gamification-rewards.mjs`（新規、`npm run
    test:gamification-rewards`、19項目）で判定ロジックの単体テスト（0語ユーザー・各閾値の
    境界値・全達成時・次の達成ヒント選択）を検証し、`npm run test:smoke`にも自動組み込みした
    （`test-date-utils.mjs`と同じパターン）。`scripts/testing/e2e/dashboard-insights.mjs`に
    ブラウザ経由の検証を追加: 0語ユーザーで崩れないこと、通常ユーザーで実際の
    `daily_stats`と表示が整合していること、リカバリーヒント・習得率カード・苦手単語カードと
    共存すること、モバイル幅で崩れないこと。
    検証: `tsc --noEmit` / `build` / `test:smoke`（単体テスト19項目含む、全PASS） /
    `test:dashboard-insights`（新規チェック含め全項目PASS） / `test:e2e`（17フロー全PASS、
    回帰なし） / `verify:prod` / `verify:srs-global`、全PASS。
    詳細は[WORK_HISTORY.md](WORK_HISTORY.md)参照。

30. ✅ **完了（2026-07-05）: 「今日の達成チケット」の実付与（`reward_tickets`連携）を実装**（優先度A完了項目29の延長）
    前回チケット風UI表示のみに留めた「今日の達成チケット」を、安全性を調査した上で
    実際に`reward_tickets`へ1日1枚まで付与できるようにした。
    **調査結果**: `reward_tickets`のRLSは`for all using (auth.uid() = user_id)`という
    行所有者に対するフルアクセス許可のみで、達成条件そのものを検証する仕組みはDB側に
    存在しない。既存の広告視聴チケット付与（`watchRewardedAndGrant()`、
    `src/lib/native/rewards.ts`）はクライアント側から直接INSERTしており、Web版では
    実際の広告再生すら行わず600msの疑似待機のみで付与される（既存の緩い設計）。
    この現状を踏まえ、今回の達成チケットは既存よりも安全な設計（達成条件をサーバー側で
    毎回再検証、既存5種のkindとは別の新しいkind値を使用）を採用した。
    **実装内容**: `POST /api/gamification/claim-daily-ticket`（新規Route Handler）を
    ユーザー操作起点（「🎟️ 今日の達成チケットを受け取る」ボタン押下）でのみ呼び出す。
    ルート内で毎回サーバー側から`daily_stats`/`study_results`を再取得し、クライアントからの
    入力は一切信用せず達成条件（4条件のいずれか）を再判定してから、本日すでに
    `kind="daily_achievement"`で付与済みでないかを確認し、未付与かつ達成済みの場合のみ
    `reward_tickets`に`amount=1`で1行INSERTする。SSR描画（`/dashboard`ページ本体）からは
    一切書き込みを行わない。
    **1日1回制限**: DB側のユニーク制約は追加していない（後述の残課題参照）。
    アプリケーション側で「本日`granted_at`以降に同kindの行が存在するか」を直前に
    確認してからINSERTする方式（check-then-insert）。ごく短い競合ウィンドウ（同一ユーザーが
    同時に複数リクエストを送った場合の二重付与）は理論上残るが、クライアント側でも
    ボタンをクリック直後に即座に無効化し連打を防止している。
    **既存チケットとの区別**: `kind="daily_achievement"`という新しい値を導入した
    （`reward_tickets.kind`は自由入力のtext列のためスキーマ変更は不要）。既存5種
    （`ai_generation`/`pdf_export`/`extra_review`/`weak_word_test`/`analysis_ticket`）の
    消費経路はこの新しいkindを一切参照しないため、AI利用上限バイパス等の収益に関わる
    消費導線とは完全に独立している（無料配布のしすぎで収益化を壊す心配がない）。
    連続学習streak計算ロジックをダッシュボードとAPIルートで重複させないよう
    `src/lib/gamification/streak.ts`（新規）に共通化した。
    子ども向けギャンブル的表現・射幸性の強い演出は使わず、Premium訴求も追加していない。
    DBスキーマ変更・RLS変更・SRS V2中核ロジック変更・teacher機能変更・教材データ変更・
    AdSense広告枠追加なし。
    テスト: `scripts/testing/e2e/reward-ticket-claim.mjs`（新規、`npm run
    test:reward-ticket-claim`、`run-e2e.mjs`のステップ18として追加、18項目）で、未達成時に
    ボタンが押せない・API直接呼び出しも400 not_eligibleで拒否される・達成後は1枚だけ
    受け取れる・同日2回目は409 already_claimedで拒否され行数が増えない・リロードしても
    増えない・既存kind(ai_generation)のチケットと混ざらないこと・モバイル幅で崩れないこと、を
    検証。`test:smoke`/`verify:prod`のPOST専用APIチェックにも新ルートを追加。
    検証: `tsc --noEmit` / `build` / `test:smoke` / `test:reward-ticket-claim`（18項目、
    全PASS） / `test:e2e`（18フロー全PASS、回帰なし） / `verify:prod` /
    `verify:srs-global`、全PASS。
    **残課題（2026-07-05に解消済み）**: DB側のユニーク制約が無いことに起因する、
    アプリケーション層check-then-insertの短い競合ウィンドウ。詳細は完了項目31参照。

31. ✅ **完了（2026-07-05）: `daily_achievement`チケットの二重付与防止をDB側で完全化**
    （優先度A完了項目30の残課題を解消）
    項目30で残していた「同時多重リクエストによる二重付与の理論上の競合ウィンドウ」を、
    新しい列を追加せずに閉じた。
    **調査結果**: `reward_tickets`の既存インデックスは主キー(`id`)のみ。`granted_at`は
    `timestamptz`、`expires_at`はどのコードからも参照されない未使用列。本番データを
    調査した結果、`kind="daily_achievement"`は現在1件のみでユーザー×JST日の重複は
    0件、他に存在する`kind`は`extra_review`のみ（削除・移行が必要な既存重複データなし）。
    **採用した方式**: 新しい列を追加する案（`grant_date_jst`列＋部分ユニークインデックス）
    ではなく、`granted_at`から直接JST日付を算出する**部分ユニークインデックス**のみを
    追加（`migrations/014_daily_achievement_ticket_unique.sql`）。
    ```sql
    create unique index if not exists reward_tickets_daily_achievement_one_per_jst_day
      on public.reward_tickets (user_id, ((granted_at at time zone interval '9:00:00')::date))
      where kind = 'daily_achievement';
    ```
    新しい列やバックフィルが不要になる分スキーマ変更が小さく済むメリットがある。
    実装中に判明した注意点として、Postgresのインデックス式はIMMUTABLE関数のみ許可されるため、
    named timezone変換（`at time zone 'Asia/Tokyo'`、STABLE）や、timestamptzのままの
    `::date`キャスト（セッションのTimeZone設定に依存しSTABLE）はどちらもインデックス式に
    使えない（42P17エラー）。固定interval(`at time zone interval '9:00:00'`)でtimestamp
    (tzなし)に変換してから`::date`する形のみがIMMUTABLEでインデックスに使用可能。この
    固定+9時間オフセットは`src/lib/utils/date.ts`のJST_OFFSET_MS計算と同じ基準。
    `WHERE kind = 'daily_achievement'`の部分インデックスのため、`ai_generation`/
    `extra_review`等ほかのkindの付与・消費には一切影響しない。
    **アプリ層の防御的多重化**: DB制約に加え、`claim-daily-ticket`ルートのINSERTで
    一意制約違反(Postgresエラーコード`23505`)を検知した場合も、既存のcheck-then-insert
    パスと同じ`409 { claimed: false, reason: "already_claimed" }`を返すようにした
    (`src/app/api/gamification/claim-daily-ticket/route.ts`)。クライアント側
    (`ClaimDailyTicketButton.tsx`)は元々`already_claimed`を正常系として扱う実装だった
    ため、UI側の変更は一切不要だった。
    DBスキーマの列追加・RLS変更・SRS V2中核ロジック変更・teacher機能変更・教材データ変更・
    AdSense広告枠追加・既存チケットUIの変更なし。
    テスト: `scripts/testing/e2e/reward-ticket-claim.mjs`に同時8件POSTのシナリオ（7番目）を
    追加（`npm run test:reward-ticket-claim`、22項目に拡張）。8件同時POST中
    claimed:trueがちょうど1件・残り7件は409 already_claimedで穏当に拒否・DBの行数は1件のまま、
    を検証。
    検証: `tsc --noEmit` / `build` / `test:smoke` / `test:reward-ticket-claim`（22項目、
    全PASS） / `test:e2e`（18フロー全PASS、回帰なし） / `verify:prod` /
    `verify:srs-global`、全PASS。マイグレーション適用前後の状態は
    [WORK_HISTORY.md](WORK_HISTORY.md)参照。
    **残課題**: なし（DBユニーク制約により1日1枚が完全に保証される設計になった）。

32. ✅ **完了（2026-07-05）: リワードチケットの使い道・表示・消費導線を整理**
    （優先度A完了項目30・31の延長）
    `daily_achievement`を安全に付与・二重防止できるようになった一方、「受け取ったものが
    何に使えるのか」がユーザー視点で曖昧だった残課題に対応。
    **調査結果**: `reward_tickets.kind`は現在6種類定義されているが、実際に機能している
    のは`ai_generation`のみ。
    - `ai_generation`: 広告視聴（`watchRewardedAndGrant()`、Web版は600ms疑似待機）
      またはStripe購入（`api/stripe/webhook/route.ts`）で付与、`api/ai/route.ts`が
      非Premiumユーザーの1日5回のAI生成上限を超えた際に1枚消費して1回追加許可する
      実際の消費先を持つ。
    - `extra_review`: `FlipCardRunner.tsx`/`ChoiceTestRunner.tsx`の「もう一周/もう10問
      チャレンジ」ボタンから広告視聴で付与されるが、**消費コードが存在しない**
      （`used_amount`は常に0のまま。ボタンのコールバックは`reward_tickets`の残高を見ず
      直接`restart()`を呼ぶ設計で、DBの行は記録として溜まるだけ）。本番で9件蓄積している
      ことを確認。
    - `pdf_export`/`weak_word_test`/`analysis_ticket`: 付与コード・消費コードとも一切存在
      しない（型定義のみ）。
    - `daily_achievement`（2026-07-05実装）: 付与のみ実装済みで、消費先は無い。
    - ダッシュボード・設定画面のどこにも「保有チケット残高」を表示するUIは無かった
      （`useTicketBalance()`フックは定義されているが未使用）。
    **判断**: `daily_achievement`を安全に既存の消費先へ接続する案（案A）は見送った。
    理由は、実際に機能している消費先が`ai_generation`（AI利用上限バイパス）のみであり、
    無料付与された達成スタンプをそこに繋ぐと「無料でAI利用上限を回避する経路を増やす」
    ことになりPremiumの価値を薄める懸念があるため（ユーザー指示の
    「AI利用上限を無料で抜けすぎる形にしない」「Premium価値を壊さない」に反する）。
    `extra_review`は消費コード自体が存在しないため「既存の消費先に接続する」という
    前提が成立せず、新規に消費導線を設計することになり、それは今回のスコープ
    （まず整理する）を超えると判断した。
    **採用した方針（案B）**: `daily_achievement`は「交換可能なチケット」ではなく
    「達成の記録（スタンプ）」として扱う方向にUI文言を整理した。
    - `reward_tickets`テーブル・`kind='daily_achievement'`という値・DB制約は無変更
      （データの意味を変えるだけで、スキーマ・付与ロジック・二重防止ロジックは
      前回のまま）。
    - UI文言を「チケットを受け取る」→「達成を記録する」、「受け取り済み」→
      「記録済み」に変更（`TodayRewardTickets.tsx`/`ClaimDailyTicketButton.tsx`）。
      APIの`claimed`/`reason`等のフィールド名・data-testidは既存のまま変更していない
      （クライアント/サーバー間の契約・既存テストへの影響を避けるため）。
    - ダッシュボードに「通算◯日分を記録済み」という**累計スタンプ数**を追加表示
      （`reward_tickets`の`kind=daily_achievement`件数を軽量COUNTクエリで取得。
      交換可能な残高ではなく、達成の積み重ねを示す表示として位置づけている）。
    - `src/lib/gamification/rewardTickets.ts`のコメントに、消費先を意図的に接続して
      いない理由と、将来交換機能を追加する場合はオーナー承認の上で別タスクとして
      設計する旨を明記した。
    **AI利用上限・Premium導線への影響**: なし（`ai_generation`の付与・消費ロジックは
    一切変更していない）。
    **既存チケットへの影響**: なし。`extra_review`/`ai_generation`等のUI・付与・DBは
    無変更。
    テスト: `scripts/testing/e2e/reward-ticket-claim.mjs`のログ文言を新UI文言に追従させ、
    シナリオ4（リロード確認）に「通算スタンプ数の表示」アサーションを追加
    （22項目→23項目）。`dashboard-insights.mjs`のログ文言も追従（アサーション内容・
    data-testid・判定ロジックは無変更）。
    検証: `tsc --noEmit` / `build` / `test:smoke` / `test:reward-ticket-claim`
    （23項目、全PASS） / `test:e2e`（18フロー全PASS、回帰なし） / `verify:prod` /
    `verify:srs-global`、全PASS。
    **残課題（2026-07-05に解消済み）**: `extra_review`（もう一周/もう10問チャレンジ）は
    付与のみで消費コードが存在しないという別の未整理問題。詳細は完了項目33参照。

33. ✅ **完了（2026-07-05）: `extra_review`の消費コード未整備を解消**
    （優先度A完了項目32の残課題を解消）
    項目32で見つかった「`extra_review`は広告視聴で付与されるが消費先が存在せず、
    `used_amount`が永久に0のまま溜まり続ける」問題に対応した。
    **調査結果**:
    - 付与元は`FlipCardRunner.tsx`（復習完了画面の「広告を見てもう一周チャレンジ」）
      と`ChoiceTestRunner.tsx`（4択テスト完了画面の「広告を見てもう10問チャレンジ」）の
      2箇所（`pool.length >= 4`のときのみ表示）。
    - `AppRewardedAdButton`の`onReward`コールバックは、それぞれ`restart()`/
      `onRewardedExtra()`という**同期関数**で、広告視聴完了の直後にその場で
      復習/テストを再開するだけの実装だった。`reward_tickets`への`INSERT`は
      `watchRewardedAndGrant()`内で行われるが、その戻り値(`amount`/`used_amount`)を
      誰も参照しておらず、「後で使うために貯める」設計は最初から存在しなかった。
    - 決定的だったのは、両画面に**広告無しの「もう一度」ボタンが並んで既に存在し**、
      ほぼ同じ内容（`restart()`とほぼ同じ`buildQuestions()`呼び出し）を無料・無制限で
      提供していたこと。つまり広告視聴で得られる「延長」は、無料ボタンで既に得られる
      ものとほぼ同じであり、`extra_review`チケットは何かを実質的にゲートしていなかった。
    - Premium/無料での挙動差は無し（両ボタンともプラン判定を一切参照していない）。
    - 広告視聴なしで無料に追加復習ができてしまう箇所（＝「もう一度」ボタン）が
      既に存在することを確認したが、これは今回のスコープ（`extra_review`のDB
      記録の不整合を正す）とは別の設計判断（ボタンの出し分け・広告ゲートの強化）
      であり、勝手に変更すると収益化方針への影響が大きいため、今回は一切変更していない。
    **判断**: 案A（真に消費するチケットにする）は不自然と判断し見送った。理由は、
    `restart()`/`onRewardedExtra()`が広告視聴の直後に結果を即座に使い切る設計のため、
    「後で消費する」という時間差自体が存在せず、真の残高管理（ダッシュボードでの残高表示・
    後日の任意タイミングでの消費等）を作ると、既存の「その場で完結する」UXを不自然に
    崩してしまうため。案B（reward_ticketsへの永続化自体をやめる）を採用した。
    **実装内容**: `src/lib/native/rewards.ts`の`watchRewardedAndGrant()`に
    `INSTANT_USE_REWARD_KINDS`（現状`extra_review`のみ）を追加し、該当kindは
    広告視聴（またはWeb版の擬似待機）完了後、`reward_tickets`へのINSERTを行わず
    広告視聴の成否のみを返すようにした。呼び出し元(`AppRewardedAdButton`)・
    UI文言・広告視聴のフロー自体は一切変更していない（ボタンを押す→擬似広告→
    `onReward`コールバックが即座に復習/テストを再開、という体験は完全に同じ）。
    `ai_generation`等ほかのkindの付与・消費ロジックは無変更。
    **used_amountの扱い**: `extra_review`は今後INSERTされないため`used_amount`という
    概念自体が発生しない。既存の本番データ（`extra_review`が9件蓄積）は削除していない
    （過去の付与履歴として残置、新規の行が増えなくなるだけ）。
    DBスキーマ変更・RLS変更・SRS V2中核ロジック変更・teacher機能変更・教材データ変更・
    AdSense広告枠追加・学習中/復習中画面への広告追加なし。広告クリック誘導・
    AdSenseポリシー違反になる表現も使っていない（表示文言は無変更）。
    テスト: `scripts/testing/e2e/extra-review-ticket.mjs`（新規、
    `npm run test:extra-review-ticket`、`run-e2e.mjs`のステップ19として追加、
    12項目）で、広告視聴後に復習/4択テストが実際に再開されること・
    `reward_tickets(kind=extra_review)`に新規行が作られないこと・
    `ai_generation`/`daily_achievement`等ほかのkindの行数が一切変化しないこと・
    0語ユーザーでも`/review`が崩れないことを検証。
    検証: `tsc --noEmit` / `build` / `test:smoke` / `test:extra-review-ticket`
    （12項目、全PASS） / `test:e2e`（19フロー全PASS、回帰なし） / `verify:prod` /
    `verify:srs-global`、全PASS。
    **残課題（2026-07-05に解消済み）**: 「もう一度」（無料・広告無し）ボタンが
    広告ゲート版とほぼ同じ機能を無料で提供している点。詳細は完了項目34参照。

34. ✅ **完了（2026-07-05）: 無料再挑戦と広告再挑戦の役割分担を整理**
    （優先度A完了項目33の残課題を解消、「無料/広告再挑戦の役割分担」）
    項目33で見つかった「広告なしの『もう一度』ボタンが、広告ゲート版とほぼ同じ内容を
    無料・無制限に提供しており、広告視聴の価値が実質的に無い」問題に対応した。
    **調査結果**:
    - `FlipCardRunner.tsx`（復習フラッシュカード）: 従来の無料`もう一度`は
      `restart()`（idx=0に戻り元の全語を最初から出題）を呼ぶだけで、広告ボタンの
      `onReward={restart}`と**全く同一の関数**を呼んでいた。つまり広告を見ても
      見なくても結果は完全に同じだった。
    - `ChoiceTestRunner.tsx`（4択テスト）: 従来の無料`もう一度`は
      `buildQuestions(pool, mode, count, recentIdsRef.current)`で新しい問題を
      選び直しており、広告ボタンの`onRewardedExtra`（`buildQuestions(pool, mode,
      Math.min(10, pool.length), recentIdsRef.current)`）とほぼ同じ内容
      （`count`が10前後の設定なら実質同一）だった。
    - Premium/無料の挙動差は無し（前回調査時と同様、両ボタンともプラン判定を
      参照していない）。
    - 参考: `src/app/learn/LearnRunner.tsx`には元々
      「間違えた単語だけもう一度」（誤答のみに絞った無料再挑戦）というボタンが
      既に存在しており、今回採用した設計方針の社内前例として踏襲した。
    **採用した方針**: オーナー提案の「案A: 無料再挑戦と広告再挑戦の役割を分ける」を
    採用。
    - **FlipCardRunner**: 無料は「間違えた◯語だけもう一度」（このセッションで
      「まだ」と回答した語だけに絞って再確認、`wrongPool.length > 0`のときのみ表示）。
      広告は「広告を見てもう一周チャレンジ」（元の全語をもう一周、文言・関数とも
      無変更）。全問正答した場合は無料ボタンを表示せず（再確認すべき誤答が無いため）、
      広告ボタンのみを継続オプションとして残す。ただし広告ボタン自体が出ない
      4語未満のプールでは、代替手段が無くなってしまわないよう、全問正答時でも
      無料の全語再挑戦（従来の`もう一度`相当）を残す。
    - **ChoiceTestRunner**: 無料は「同じ問題をもう一度」（`buildQuestions()`を
      呼び直さず、直前と全く同じ問題セット`qs`をそのまま再演習）。広告は
      「広告を見て別の10問に挑戦」（`buildQuestions()`で新しい問題セットを選び直す、
      関数`onRewardedExtra`自体は無変更）。
    - 苦手単語・誤答だけの無料復習は「必要な学習機能を広告の後ろに置かない」という
      考え方に基づく（間違えた語の再確認は、そもそも収益化よりも学習効果を優先すべき
      機能と判断した）。
    **修正したUI文言**:
    - FlipCardRunner: 無料ボタン「もう一度」→ 条件付きで「間違えた{n}語だけもう一度」
      （誤答が無い場合は4語以上のプールでは非表示、4語未満では従来通り「もう一度」を
      維持）。広告ボタンの文言は無変更。
    - ChoiceTestRunner: 無料ボタン「もう一度」→「同じ問題をもう一度」。広告ボタン
      「広告を見てもう10問チャレンジ」→「広告を見て別の10問に挑戦」。
    **修正した挙動**:
    - `FlipCardRunner.tsx`: `sessionPool`という新しいstateを導入し、通常は`pool`
      (元の全語プロパティ)と同じだが、「間違えた語だけもう一度」を選んだ場合のみ
      誤答した語(`wrongPool`)に絞り込まれる。ヘッダーの進捗表示・進捗バー・完了判定は
      すべて`sessionPool`基準に変更。広告ボタン(`restart`)は`sessionPool`を`pool`
      （元の全語）にリセットする従来通りの動作。
    - `ChoiceTestRunner.tsx`: 無料ボタンの関数(`retrySameQuestions`)は`qs`を再構築せず
      idx/results/pickedのみリセットするよう変更（＝直前と全く同じ問題が再演習される）。
      広告ボタンの関数(`onRewardedExtra`)は無変更。
    **Premiumユーザーへの影響**: なし。今回もPremium判定は一切追加していない
    （無料/広告の役割分担であり、Premium/無料の差別化ではない）。
    **無料ユーザーへの影響**: 誤答した語だけを無料で再確認する権利は維持・明確化
    （むしろ「間違えた語だけ」という的を絞った復習は、全語をだらだら再演習するより
    学習効率が高い）。全問正答した場合や、同じ問題セットをもう一度解きたい場合に
    「まっさらな全語再挑戦」や「新しい問題セット」を無料で得ることはできなくなったが、
    4語未満のプールでは引き続き無料の全語再挑戦を提供しており、過度な制限感は
    出していないと判断。
    **extra_review保存停止の維持**: 変更なし。両ボタンとも`AppRewardedAdButton`
    経由で`watchRewardedAndGrant("extra_review")`を呼ぶ構造自体は無変更のため、
    `INSTANT_USE_REWARD_KINDS`による`reward_tickets`非永続化（完了項目33）は
    そのまま維持されている。
    DBスキーマ変更・RLS変更・SRS V2中核ロジック変更・teacher機能変更・教材データ変更・
    AdSense広告枠追加・学習中/復習中画面への広告追加なし。広告クリック誘導・
    AdSenseポリシー違反になる表現も使っていない（「広告を見て」の範囲に統一）。
    テスト: `scripts/testing/e2e/extra-review-ticket.mjs`を拡張（12項目→15項目）。
    FlipCardRunnerで1語だけ誤答した状態から、無料ボタンが「間違えた1語だけもう一度」
    に限定されること・クリックすると実際にセッションが1語に絞り込まれること
    （進捗表示`1/1`を確認）・全問正答後は無料ボタンが消えること・広告ボタンでは
    元の全4語が再出題されること（進捗表示`1/4`を確認）を検証。ChoiceTestRunnerで
    無料ボタンが「同じ問題をもう一度」に変わっていること・クリックすると
    `data-word-id`の順序が完全一致する同一問題が再出題されること・広告ボタンが
    「広告を見て別の10問に挑戦」に変わっていることを検証。いずれも
    `reward_tickets(kind=extra_review)`に新規行が作られないことを再確認。
    検証: `tsc --noEmit` / `build` / `test:smoke` / `test:extra-review-ticket`
    （15項目、全PASS） / `test:e2e`（19フロー全PASS、回帰なし） / `verify:prod` /
    `verify:srs-global`、全PASS。
    **残課題**: なし。無料・広告それぞれの役割が明確に分かれ、広告視聴に実質的な
    価値（新しい問題セット・全語の再周回）が生まれた。

35. ✅ **完了（2026-07-05）: AI弱点分析のMVP整理・強化（収益化・Premium転換の観点）**
    無料ユーザーには「苦手単語の確認」、Premiumユーザーには「詳しい弱点分析」という
    自然な価値差を作る目的で、`/weak`ページを整理・強化した。
    **調査結果**: `/weak`ページ（`src/app/weak/page.tsx`）・AI弱点分析API
    （`src/app/api/ai/weakness-analysis/route.ts`）・Premium判定
    （`profiles.is_premium`）は**いずれもすでに実装済み**だった（2026-07-03の
    Premium判定バグ修正時に整備されたもの、`scripts/testing/verify-premium-gating.mjs`
    で回帰確認済み）。AI分析は`words`の`word/meaning/wrong_count/correct_count/
    streak/pos`（上位30語）のみを送信する設計で、既存のAI利用上限
    （`DAILY_LIMIT`）・`reward_tickets(kind=ai_generation)`の消費は一切参照しない
    （AI生成とは独立した別ルートのため）。一方で、無料ユーザーが見られる情報が
    「単語・意味・正誤回数・正答率」のみで、`mastery`（習熟度）・`pos`（品詞）・
    `word_book_id`（単語帳）は取得すらしておらず、`/review`への復習導線も無かった。
    **実装内容**:
    - `/weak`ページの取得列に`mastery`/`pos`/`word_book_id`を追加し、`word_books`も
      軽量に取得（`id, title`のみ）。各単語行に品詞バッジ・単語帳名・習熟度%を追加表示。
    - 新設「傾向を確認」セクション（`data-testid="weak-trend-summary"`）: AIを一切
      使わず、取得済みの苦手単語リストをこの場で決定論的に集計するだけの軽量な
      追加ロジック（品詞別苦手数トップ5・単語帳別苦手数トップ5・習熟度が低い単語
      トップ5）。**無料・Premium問わず常時表示**し、無料ユーザーでも品詞・単語帳・
      習熟度の傾向が分かるようにした。追加のDBクエリは`word_books`の1件のみで、
      ページ表示速度への影響は無視できる程度。
    - 復習導線「🔁 今すぐ復習する」（`/review`へ）・「まず10語だけ復習する」
      （`/review?start=1&mode=recovery&limit=10`、既存のリカバリーモードをそのまま
      再利用）を新設。`/review`の既存due取得クエリは`next_review_at.lte.now OR
      is_weak.eq.true`のため、苦手単語は元々このプールに含まれる（SRS V2の
      中核ロジックは一切変更していない）。
    - Premium向けAI分析（`WeaknessAnalysis.tsx`）: 既存の分析ボタン・API呼び出し・
      レポート表示ロジックは無変更（すでに品詞別パターン・改善アドバイス・
      今日からできることを提示するMVPとして十分機能していたため）。AI呼び出しが
      失敗した場合のエラーメッセージに「（上の「傾向を確認」もあわせてご覧ください）」
      という一文を追加し、常時表示の決定論的セクションへ誘導することで、AI失敗時も
      ページが手詰まりに見えないようにした（決定論的セクションを複製する形の
      冗長な実装は避け、常時表示のセクションをフォールバックとして兼用する設計とした）。
    - 非Premium向けの案内（「🔬 AI弱点分析（Premium）」「間違いのパターンをAIが
      分析し改善策を提案」「プレミアムで解放する →」）は元々十分控えめだったため
      変更していない。
    **AIに送るデータ**: 既存のまま変更していない（上位30語の word/meaning/wrong_count/
    correct_count/pos のみ、集計統計を添えた1回のプロンプト、最大1024トークン）。
    単語帳別の分析はAIには送らず、決定論的な集計のみで対応することで、AI入力を
    増やさずに済ませた。
    DBスキーマ変更・RLS変更・SRS V2中核ロジック変更・teacher機能変更・教材データ変更・
    AdSense広告枠追加なし。`reward_tickets`の挙動・`ai_generation`チケットの消費仕様は
    一切変更していない（この分析ルート自体がそもそも参照しない設計のため）。
    テスト: `scripts/testing/e2e/weak-analysis.mjs`（新規、`npm run
    test:weak-analysis`、`run-e2e.mjs`のステップ20として追加、20項目）で、
    苦手単語ありユーザーでの一覧・品詞/単語帳/習熟度バッジ表示・「傾向を確認」の
    集計内容・復習導線からの実際の遷移、苦手単語なしユーザーでの非崩壊、
    非Premium時の控えめな案内、Premium時のAI分析実行結果（成功時のレポート表示を
    実際のAnthropic API呼び出しで確認）、`ai_generation`チケットへの非干渉、
    ダッシュボードの苦手単語カードからの遷移を検証。既存の
    `scripts/testing/verify-premium-gating.mjs`（`/weak`のPremium判定を含む）にも
    回帰なし。
    検証: `tsc --noEmit` / `build` / `test:smoke` / `test:weak-analysis`
    （20項目、全PASS） / `test:e2e`（20フロー全PASS、回帰なし） / `verify:prod` /
    `verify:srs-global`、全PASS。
    **残課題**: なし。将来的にAI分析へ単語帳別の弱点を含める場合は、AI入力の増加に
    見合う価値があるか慎重に判断すること（現状は決定論的な集計で十分と判断した）。

36. ✅ **完了（2026-07-05）: Premium導線とプランページの棚卸し・改善
    （収益化・Premium転換率の観点）**
    AI弱点分析・AI単語抽出・AI学習プラン・タイピング・リスニング・PDF拡張等、
    Premium価値になる機能が増えてきたため、導線・表示・Stripe連携が正しく
    ユーザーに伝わっているかを棚卸しした。
    **調査結果**: `/premium`ページ・`PremiumCheckout.tsx`・Stripe
    checkout/webhookルート・各Premium gatingページはすでに高品質に実装されており、
    大きな作り直しは不要と判断した。ただし以下2件の**実際の不具合**を発見した。
    - **ダッシュボードの広告がPremiumユーザーにも表示されていた**:
      `src/app/dashboard/page.tsx`の`<BannerAdPlaceholder />`が`isPremium`で
      ガードされておらず、`/premium`・`/settings`・`/dashboard`で謳っている
      「広告完全なし」「広告ゼロ」という訴求と実際の挙動が矛盾していた
      （AdSenseは現在`/dashboard`が唯一の表示箇所であるため、実質的にPremiumの
      「広告非表示」特典が機能していなかった）。`{!isPremium && (...)}`で
      ラップして修正した。
    - **`profiles.stripe_customer_id`/`premium_expires_at`カラムが本番に存在しな
      かった**（`migrations/003_stripe_premium.sql`が本番に一度も適用されていな
      かった、詳細は下記「重大発見」参照）。
    **重大発見（今回のタスク範囲外だが安全のため対応）**: `/premium`の
    Premium/非Premium表示が正しく切り替わるかをE2Eで検証する過程で、Premium状態を
    セットしたテストアカウントで`/premium`が非Premium表示のままになる不具合を発見。
    調査したところ、`src/app/premium/page.tsx`・checkout/webhookルートが参照する
    `profiles.stripe_customer_id`列が**本番データベースに実在しなかった**
    （`select("is_premium, stripe_customer_id")`が列不存在エラーで失敗し`profile`が
    常に`null`扱いになっていた）。ローカルの`supabase/migrations/003_stripe_premium.sql`
    は存在するが、本番のマイグレーション履歴（`list_migrations`で確認）に一度も
    含まれていなかった。
    これは実際のStripe決済フロー（`checkout.session.completed`のsubscription分岐
    が`is_premium`/`stripe_customer_id`/`premium_expires_at`を含む`profiles`更新を
    行う）にも影響しうる重大な問題だったため、オーナーに報告の上、承認を得て
    追加専用の安全なマイグレーション（`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
    2列＋インデックス1件、破壊的変更なし）を本番へ適用した。
    適用後、実際のStripe請求データ（`stripe.subscriptions.list()`、読み取り専用）を
    確認したところ、**本番には現在サブスクリプションが0件**（実ユーザーは4件・
    Premium 0件）で、この不具合による実害（課金済みなのにPremiumが有効にならない
    ユーザー）は発生していなかったことを確認した。
    - 適用前: `profiles`に`stripe_customer_id`/`premium_expires_at`列なし。
    - 適用後: 両列が追加され（`information_schema.columns`で確認）、
      `/premium`ページのPremium/非Premium表示切り替えが正しく動作することを
      E2Eで確認した。
    - 併せて、`POST /api/stripe/checkout`に「既にPremiumなら409
      already_premiumを返す」防御的ガードを追加した（既存の`stripe_customer_id`
      再利用ロジックの直前、Stripe API呼び出し前にリターンするため安全）。
      UI側では`/premium`ページが元々Premiumユーザーにはチェックアウトボタン
      自体を表示しない設計だったため通常は到達しないが、API単体の安全策として
      追加した。
    **Premium誘導CTA文言の統一**: `/weak`・`/extract`・`/plan`・`/settings`の
    Premium誘導CTAが「プレミアムにアップグレード →」「プレミアムで解放する →」
    「プレミアムを見る →」とバラバラだったため、`/test/typing`が既に採用していた
    価格明記の「月額 ¥480〜 プレミアムを見る →」に統一した（価格を明示すること
    でクリック後の「意外性」を減らす狙い）。見出し・機能説明文言は各機能の文脈に
    合わせて維持し、無理に画一化していない。ダッシュボードのカード型CTA
    （「月額 ¥480 〜 でアップグレード →」）は文脈が異なるため据え置いた。
    **`/plan`の内容確認**: 「AIパーソナル学習プランはプレミアムプランでご利用いた
    だけます」という文言・機能説明は現状の実装と一致しており、大きな変更は
    不要と判断（オーナー指示の「すでに十分実装済みなら大きく変えない」に対応）。
    **無料/Premium比較表の確認**: `/premium`の比較表（12行）・ランディングページの
    Free/Premiumカードは、いずれも実装済み機能とのズレが無いことを確認した
    （AI弱点分析・AI単語抽出・AI学習プラン・タイピング・リスニング・CSV一括
    インポート・統計データ書き出し・小テストPDF等、すべて実装確認済み）。「広告
    表示」の行も、上記のダッシュボード広告ガード修正により実態と一致するようになった。
    **AdSenseとの関係**: 広告非表示は今回の修正で実装済みとなったため、既存の
    訴求文言はそのまま維持した（未実装機能の訴求は無い）。AdSense自体は
    `/dashboard`のみに表示中で、Getting ready状態（変更なし）。
    **TOEIC/ビジネス教材・社会人向け教材**: `/materials/toeic`・`/materials/business`
    ・`/materials/news`はいずれもPremium限定ではなく無料で閲覧・学習可能であることを
    確認（教材データ自体は変更していない）。
    DBスキーマ変更（追加専用マイグレーション、オーナー承認済み）・SRS V2中核ロジック
    変更・teacher機能変更・教材データ変更・AdSense広告枠追加・reward_tickets仕様
    変更なし。既存のPremium判定`profiles.is_premium`はそのまま。
    テスト: `scripts/testing/e2e/premium-conversion.mjs`（新規、
    `npm run test:premium-conversion`、`run-e2e.mjs`のステップ21として追加、
    13項目）で、非Premium/Premiumの`/premium`表示切り替え・チェックアウトボタンの
    表示制御・409ガード・CTA文言統一・`/test/typing`/`/test/listening`の
    ペイウォール表示・モバイル崩れ・ダッシュボード広告ガードのソースコード確認を
    検証。既存の`scripts/testing/verify-premium-gating.mjs`は文言変更に伴い3箇所の
    アサーションを更新（動作自体は無変更、21項目全PASS）。
    検証: `tsc --noEmit` / `build` / `test:smoke` / `test:premium-gating`
    （21項目、全PASS） / `test:premium-conversion`（13項目、全PASS） /
    `test:e2e`（21フロー全PASS、回帰なし） / `verify:prod` / `verify:srs-global`、
    全PASS。
    **残課題**: `/premium`の「3,200+ 登録ユーザー」「4.8★ ユーザー評価」
    「42万語 学習済み単語」および3件の利用者の声は、実データではなくプレース
    ホルダーの可能性が高い（本番の実ユーザーは4件・Premium 0件で数字と大きく
    乖離している）。マーケティング方針に関わる判断のためオーナーに確認を依頼したが
    未回答のため、今回は変更せず残課題として記録するに留めた。対応する場合は
    実データに置き換えるか、具体的な数字を出さない訴求に変更することを検討。
    → **2026-07-05、下記項目37でオーナー承認を得て対応済み。**

---

37. ✅ **完了（2026-07-05）: 実データと乖離した社会的証明・マーケティング文言の
    棚卸しと修正（項目36の残課題への対応）**
    項目36で残課題として記録した`/premium`の実データと乖離した社会的証明について、
    オーナーから撤去承認を得たため対応した。「登録ユーザー数・利用者数・満足度・
    導入実績・口コミ・レビュー・No.1・大人気・選ばれています・3,200+・実績」等の
    キーワードで`/premium`・`/`・`/materials/*`・`/plan`・`/guide`・`/faq`・
    `/dictionary`・`README.md`を横断検索した結果、実際に修正が必要だったのは
    `/premium`とトップページ(`/`)の2ファイルのみだった（`AmazonBookSection`の
    第三者書籍説明・診断結果の個別フィードバック・一般的な学習法解説・「プレビュー」
    の誤検出等は、いずれもLoop Vocabulary自体の未実証な実績主張ではないため対象外
    と判断）。
    **`/premium`**: 「3,200+登録ユーザー」「4.8★ユーザー評価」「42万語学習済み単語」
    の統計カードを`🚫広告非表示`/`🤖AI利用無制限`/`📄PDF出力無制限`という実装済み
    機能カードに置換。3件の架空testimonials（利用者名・役職・「TOEIC 730点達成」等
    の具体的スコア）と「ユーザーの声」セクションを全削除。「一番人気」を「おすすめ」
    に変更。
    **トップページ(`/`)**: `getPublicStats()`から`daily_stats`集計による虚偽の
    下駄履き表示（`USER_FLOOR=3200`/`STUDIED_FLOOR=100万`で実データ不足時に固定値を
    出す実装）を撤去し、実教材冊数（`materials`テーブル集計）のみを返すよう簡素化。
    「数字で訴求」セクションを`¥0基本機能が無料`/`SRS忘却曲線で自動復習`/
    `AI語源・例文をその場で解説`/実教材冊数の機能ベース構成に置換。ヒーローバッジ
    「3,200人が学習中」を「登録無料・広告なしでも使える基本機能」に変更。
    schema.orgのJSON-LDに含まれていた未実証の`aggregateRating`
    （`ratingValue:4.8, ratingCount:312`）を削除（検索エンジンへの構造化データに
    架空レビュー評価を含めるのは通常の視覚コピー以上にGoogle側のリスクがあるため
    優先対応）。見出し「こんな人に選ばれています」を「こんな人におすすめ」に変更。
    6件の架空testimonialsと「英語が変わった人たちの声」セクションを全削除。
    **残した訴求の根拠**: 「収録コンテンツ」の教材冊数表示は「利用者数」ではなく
    「コンテンツ量」という別カテゴリの実データであり、「実ユーザー数を公開表示
    しない」という制約に抵触しないため維持。機能カード・比較表・FAQ等の既存の
    機能ベースセクションは実装内容と一致しており変更不要と判断。
    DBスキーマ変更・Stripe価格変更・Premium機能自体・AdSense広告枠・教材データ・
    SRS V2・teacher機能への変更なし（表示文言のみの変更）。
    テスト: `scripts/testing/e2e/premium-conversion.mjs`に2ステップ追加
    （`/premium`・トップページそれぞれで誇張文言の残存とJSON-LDの
    `aggregateRating`残存がないことを確認）。
    検証: `tsc --noEmit` / `build` / `test:premium-conversion`（新規2ステップ含め
    全PASS） / `test:premium-gating`（21項目PASS） / `test:smoke`（全PASS） /
    `test:e2e`（18スイート全PASS、回帰なし） / デプロイ前`verify:prod` /
    `verify:srs-global`（既存本番環境に対してベースライン確認、全PASS）。
    **残課題**: 実ユーザー数が増えた段階での動的な社会的証明の検討は本ラウンドの
    スコープ外として別タスクとした。

---

38. ✅ **完了（2026-07-06）: Stripe決済後のPremium反映フローのE2E/監視整備**
    項目36で修正した「`profiles.stripe_customer_id`/`premium_expires_at`列が本番に
    存在しなかった」重大不具合の再発を早期検知できるよう、checkout作成→webhook受信→
    Premium反映→機能解放→二重checkout防止までを安全に検証・監視できる状態にした。
    **調査で発見した重大な運用上の問題**: Stripe本番アカウントに`/api/stripe/webhook`
    へ向くWebhook endpointが2本重複登録されており、`checkout.session.completed`・
    `customer.subscription.deleted`が重複配信される設定になっていた（片方は
    `customer.subscription.updated`を購読していなかった）。さらに、両endpointが
    別々のsigning secretを持つため、Vercel Productionの`STRIPE_WEBHOOK_SECRET`と
    一致しない方のendpointからのイベントは署名検証エラー(400)で静かに失敗していた
    可能性があった。発覚時点で実サブスクリプションは0件のため実害はなかった。
    オーナー承認を得て、正しいイベント構成のendpoint（`we_1TiSuwIEd2EBa26eUb2n0pTB`）
    を残しsigning secretをroll（Stripeの公開APIにはroll操作が無くDashboard操作のみ
    可能なためオーナーが実施）、新secretをVercel Production環境変数に反映・
    redeployした（`verify:prod`/`verify:srs-global`で回帰なしを確認）。もう片方の
    endpoint（`we_1Tm4GYIEd2EBa26eIJSWfLUa`）は、誤って必要な方を削除するリスクを
    避けるため削除ではなくまず無効化した。無効化後、Vercel Runtime Logsで直近7日間の
    `/api/stripe/webhook`アクセスを確認し、記録されていた400は2件のみで、いずれも
    本ラウンドの`verify:prod`の意図的なテストと時刻が一致しており、実際の配信失敗
    ではないことを確認した（詳細はPRODUCTION_MONITORING.md §11-5参照。secret値は
    ログ・ドキュメントに一切記録していない）。本番live endpointへの疑似テスト
    イベント送信・本番小額決済・本番checkout sessionの作成は、安全に本番へ影響を
    与えない実施手段が確認できなかったため見送った。
    **テスト追加**: `scripts/testing/e2e/stripe-premium-webhook.mjs`（新規、
    `npm run test:stripe-premium-webhook`、`run-e2e.mjs`ステップ22として追加）。
    `Stripe.webhooks.generateTestHeaderString()`で署名付きテストイベントを生成し
    （純粋にローカルの暗号署名計算のみで実Stripe通信なし）、自分のdevサーバの
    `/api/stripe/webhook`に直接POSTすることで実際の署名検証を含めた実挙動を検証。
    使用する顧客ID・ユーザーIDはすべて架空の値で、実Stripe顧客・実メール送信には
    一切アクセスしない設計（checkout.session.completedの正常系は意図的に
    `metadata.supabase_user_id`を含めない形で送り、実メール送信という外部副作用を
    回避。「存在しないユーザーIDで壊れない」ことは別途、実在しないUUIDで検証）。
    ソースコード確認8項目＋実HTTP検証12項目の計20項目で、checkout/webhookの主要
    ガード・is_premium/premium_expires_at反映・Premium機能解放・二重checkout防止・
    未ログインcheckout拒否・subscription.updated/deletedの反映を検証。
    **verify:prod拡張**: `profiles.stripe_customer_id`/`premium_expires_at`列の
    存在確認（service roleでの1行select、DB変更なし）・`/api/stripe/checkout`/
    `/api/stripe/webhook`が404になっていないか（401/400が返るか）・ダッシュボード
    広告の`isPremium`ガードのソース確認・`/premium`の200表示を追加。
    **PRODUCTION_MONITORING.md**に「Stripe決済・Premium反映で見るべき異常」章を
    新設し、支払い済みなのにPremiumにならない・Webhookが失敗している・
    is_premium/premium_expires_atが更新されない・Premiumなのにcheckout/広告が
    出てしまう、の4つの障害シナリオごとの確認手順を記録した。
    DBスキーマ変更・Stripe価格変更・既存ユーザーのis_premium変更・RLS変更・
    AdSense広告枠追加・SRS V2・teacher機能・教材データへの変更なし。
    検証: `tsc --noEmit` / `build` / `test:stripe-premium-webhook`（新規20項目）/
    `test:premium-conversion` / `test:premium-gating`（21項目）/ `test:smoke` /
    `test:e2e`（19スイート）/ `verify:prod`（Stripe関連4セクション追加）/
    `verify:srs-global`、全PASS。
    **残課題**: 初回の実課金が発生した際に、Stripe Dashboardの配信ログと本番
    `profiles`の`is_premium`/`stripe_customer_id`/`premium_expires_at`が実際に
    正しく反映されるかを実データで確認すること。もう片方の重複endpoint
    （`we_1Tm4GYIEd2EBa26eIJSWfLUa`、現在は無効化のみ）の削除は、無効化後の様子を
    見てから後日判断する。

---

39. ✅ **完了（2026-07-06）: reward_tickets未実装kind（pdf_export/weak_word_test/
    analysis_ticket）の整理**
    項目67〜74で調査済みだった「`reward_tickets`のkind別実装状況」のうち、
    未実装のまま残っていた3種について、誤ってUIやPremium訴求に出てしまうリスクを
    今のうちに塞ぐため、オーナー承認のもと**案A（将来用として残すが、予約済み・
    非表示であることを明記）**で整理した。
    **調査結果**: 3種（`pdf_export`/`weak_word_test`/`analysis_ticket`）は
    `src/lib/native/rewards.ts`の`RewardKind`型定義にのみ存在し、付与コード・
    消費コードとも一切無い。`AppRewardedAdButton`/`useTicketBalance`（いずれも
    `kind: RewardKind`を受け取る汎用コンポーネント）の実際の呼び出し箇所を
    全文検索した結果、`kind="ai_generation"`（`/ai`）・`kind="extra_review"`
    （`FlipCardRunner`/`ChoiceTestRunner`）の2種のみが配線されており、3種は
    どこからも呼ばれていないことを確認（`useTicketBalance`自体も未使用の
    デッドコード）。本番`reward_tickets`にもこの3種の行は0件（既存行は
    `daily_achievement`2件・`extra_review`9件のみ）。README.md・WORK_HISTORY.md
    はすでに「未実装」と正確に記述済みで、誤解を招く記述は無かった。
    `pdf_export`という文字列自体は`PdfTestBuilder.tsx`（GA4イベント名）・
    `pdf_exports`テーブル（実際のPDF出力ログ、無関係の別物）にも出現するが、
    これは`reward_tickets.kind`とは無関係の同名の別概念であり、誤検知として除外。
    **対応**: `src/lib/native/rewards.ts`の`RewardKind`型に「実働中」と
    「予約済み・未実装 (reserved / not active)」の見出しコメントを追加し、
    実装するまでUI・Premium訴求に出してはならない旨を明記。`AppAds.tsx`の
    `useTicketBalance`（未使用）にも同様の注意コメントを追加。
    DBスキーマ変更・既存`reward_tickets`行の削除は行っていない
    （`ai_generation`/`daily_achievement`/`extra_review`の仕様・データは無変更）。
    **テスト追加**: `scripts/testing/e2e/reward-ticket-claim.mjs`にステップ0
    （新規）を追加。`src/app`・`src/components`配下を静的スキャンし、3種が
    `kind="..."`の形でどこにも配線されていないことを確認するとともに、
    ダッシュボード表示（実レンダリング）にも予約済みkindの残高・特典表示が
    出ていないことを確認。`scripts/testing/e2e/premium-conversion.mjs`の
    既存の誇張表現チェック（ステップ1b）にも、3種を特典として訴求する
    日本語フレーズ（「PDF出力チケット」等）を禁止文言として追加。
    検証: `tsc --noEmit` / `build` / `test:reward-ticket-claim`（新ステップ0含め
    全PASS）/ `test:premium-conversion` / `test:extra-review-ticket` /
    `test:smoke` / `test:e2e`（19スイート、回帰なし）/ `verify:prod` /
    `verify:srs-global`、全PASS。
    **残課題**: 将来これら3種を実装する場合は、消費先（AI利用上限バイパスに
    直結させない等）をオーナー承認の上で個別設計すること。

---

40. ✅ **完了（2026-07-06）: 信頼ページ・規約・決済説明まわりの棚卸しと改善**
    Premium課金導線を本格運用する前に、`/premium`・`/privacy`・`/terms`・`/faq`・
    `/contact`・`/settings`・`/account/delete`・footer導線・ログイン後リダイレクトを
    棚卸しし、実際の不具合と実装とのズレを発見・修正した。
    **発見した実際の不具合（2件）**:
    1. `PremiumCheckout.tsx`の未ログイン時「ログインして始める」が
       `/auth/login?next=/premium`という**存在しないルート**を指しており、本番で
       404になっていた（正しくは`/login`）。Premium課金導線の入口が壊れていた。
    2. `/login`ページが`?next=`クエリパラメータを一切読んでおらず、パスワード
       ログイン・マジックリンク・Googleログインのいずれも常に`/dashboard`へ
       固定リダイレクトしていた。これにより`/premium`だけでなく`/account/delete`
       等、他ページの`?next=`導線もすべて無効化されていた
       （`/auth/callback/route.ts`自体は`next`を正しく転送する実装だったが、
       `/login`側がその`next`を組み立てる際に常に`/dashboard`を埋め込んでいたため）。
       `useSearchParams()`で実際の`next`を読み取り、3方式すべてで尊重するよう修正
       （`useSearchParams`使用に伴い、`/login`を`LoginForm`+`Suspense`構成に分離）。
    **発見した実装とのズレ（ドキュメント・表記）**:
    - `/terms`「5. 広告・課金」が、実際には既に本番稼働しているStripe Web課金を
      「将来的に」導入予定の未実装機能であるかのように記載し続けており、価格・
      更新周期・解約方法・返金方針が一切書かれていなかった。実際の内容
      （月額¥480・年額¥3,800、Stripeカスタマーポータルでの解約、期間終了までは
      利用可、日割り返金なし）に全面更新し、Android/iOSアプリ版の将来のネイティブ
      課金（Play Billing/StoreKit）は別項目として維持した。
    - `/privacy`に、実際に利用している第三者サービス（決済のStripe、AI解説の
      Anthropic/Claude API）の記載が無かった。新設した「4. 決済・AI機能における
      外部サービスの利用」に追記し、以降のセクション番号を採番し直した。
    - アカウント削除は`account_deletion_requests`への登録のみを行う手動処理で、
      Stripeサブスクリプションを自動解約しない設計だが、その注意書きがどこにも
      無かった。`/privacy`・`/account/delete`・`/settings`（Premiumユーザー表示時
      のみ）に警告文を追加し、`PRODUCTION_MONITORING.md`の手動削除処理チェック
      リストにも同様の確認手順を追記した。
    - `/premium`の下部リンクにプライバシー・利用規約・ダッシュボードしか無く、
      決済ページとして問い合わせ導線が弱かったため「よくある質問」「お問い合わせ」
      を追加した。
    - フッター等で使われていた「広告非表示プラン」という狭いPremiumの呼び方を、
      実態（AI無制限・CSV一括インポート等も含む）に合わせて「プレミアムプラン」に
      統一した（`page.tsx`・`/contact`・`/settings`）。
    - `README.md`のロードマップに「Stripeによる Premium課金」「AI を
      OpenAI/Anthropicに実接続」「AdMob Web SDK/AdSense連携」が未実装`[ ]`のまま
      残っていたが、いずれも実装済みのため`[x]`に更新し、§14-9「将来の課金」も
      「現状は案内のみ」という誤った記述から、Web版は実装済み・ネイティブアプリ版は
      未実装、という正確な内容に書き換えた。
    **特定商取引法表記に相当する情報の不足**: 販売価格・支払方法・支払時期・
    キャンセル方法等は`/premium`・`/faq`・`/terms`に既に記載済みだが、
    販売事業者名・所在地・電話番号は未記載（コード内に既存の`TODO(運営者)`
    コメントあり、`HANDOFF.md`にも既知の未決事項として記録済み）。
    **個人情報を推測・捏造せず、今回もページは作成していない**。必要な項目の
    一覧と対応方針はWORK_HISTORY.mdに記録し、オーナー確認待ちとした。
    DBスキーマ変更・Stripe価格変更・Stripe env変更・Premium機能自体の変更・
    Webhook変更・AdSense広告枠追加・SRS V2・teacher機能・教材データへの変更なし。
    誇張表現の復活・未実装機能のPremium特典化はしていない。
    **テスト追加**: `scripts/testing/e2e/legal-trust-pages.mjs`（新規、
    `npm run test:legal-trust-pages`、`run-e2e.mjs`ステップ23として追加、16項目）。
    `/premium`・`/privacy`・`/terms`・`/faq`・`/contact`の200表示、ログイン前
    「ログインして始める」→`/login?next=/premium`への遷移（404にならない）→
    ログイン完了後に`/dashboard`ではなく`/premium`へ実際に戻ること（`next=`修正の
    回帰確認）、ランディングページfooter・`/premium`下部リンクの非404確認、
    `/privacy`のStripe/Anthropic記載、`/terms`の実際の価格・解約方法記載、
    モバイル幅での崩れ無し、誇張表現・未実装特典の非復活を検証。
    検証: `tsc --noEmit` / `build` / `test:legal-trust-pages`（新規16項目）/
    `test:premium-conversion` / `test:premium-gating`（21項目）/ `test:smoke` /
    `test:e2e`（20スイート）/ `verify:prod` / `verify:srs-global`、全PASS。
    **残課題**: 特定商取引法表記に相当する販売事業者名・所在地・電話番号は
    オーナーからの提供待ち。提供され次第、専用ページ（例:
    `/legal/commercial-transaction`）の新設をあらためて提案する。

---

41. ✅ **完了（2026-07-06）: 特定商取引法表記に相当する専用ページの準備
    （案A: 未公開ドラフト）**
    項目40の残課題への対応。オーナー承認のもと、`/legal/commercial-transaction`
    （タイトル「特定商取引法に基づく表記」）の雛形を作成した。
    **公開方針（案A採用）**: ページ自体は実装したが、footer・`/premium`・
    `/contact`・`/faq`・トップページ等、サイト内のどこからもリンクしていない
    （直接URLでのみ到達可能）。加えて`metadata.robots = { index: false, follow:
    false }`と`public/robots.txt`への`Disallow: /legal`追加の二重でクロールを
    防止し、`sitemap.ts`（手動キュレーション方式のため元々自動追加されない）にも
    含めていない。ページ上部に「準備中（社内確認用ドラフト）」であることを明記した
    警告バナーを設置し、運営者情報の確認が完了するまで正式な表記として案内しない
    よう明示した。
    **個人情報は一切推測・捏造していない**: 販売事業者名・運営責任者・所在地・
    電話番号はいずれも「オーナー確認待ち」のプレースホルダーのまま。
    **既存実装から引用した確定済み情報**: 販売価格（月額¥480・年額¥3,800）・
    支払方法（Stripe経由のクレジットカード等）・支払時期（登録時に初回課金、
    以降登録日基準で自動更新）・サービス提供時期（決済完了後、即時にプレミアム
    機能利用可能）・解約/返品特約（Stripeカスタマーポータルからいつでも解約、
    期間終了まで利用可、日割り返金なし）・メールアドレス（既存`SUPPORT_EMAIL`）・
    問い合わせ先（既存`/contact`）。いずれも`/terms`・`/faq`の既存記載と整合させた
    （実装と異なる内容は書いていない）。
    **オーナー確認が必要な項目**（下記「オーナー確認待ちリスト」参照）:
    販売事業者名・運営責任者名・所在地・電話番号・住所/電話番号の公開方針
    （個人事業主の場合、請求時開示の代替可否）・屋号併記の要否・
    footer公開のタイミング。
    DBスキーマ変更・Stripe価格変更・Stripe env変更・Premium機能自体の変更・
    Webhook変更・AdSense広告枠追加・SRS V2・teacher機能・教材データへの変更なし。
    誇張表現の追加・復活はしていない。
    **テスト追加**: `scripts/testing/e2e/legal-trust-pages.mjs`にステップ9を
    追加（6項目）。`/legal/commercial-transaction`の200表示・`/terms`との
    確定情報整合・プレースホルダー文言の表示確認・`noindex,nofollow`メタタグの
    出力確認・`robots.txt`の`Disallow: /legal`確認・`/premium`/`/contact`/`/faq`/
    トップページのいずれからもリンクされていないことを検証。
    検証: `tsc --noEmit` / `build`（`/legal/commercial-transaction`が静的
    プリレンダリングされることを確認）/ `test:legal-trust-pages`（新規6項目
    含め全21項目）/ `test:premium-conversion` / `test:premium-gating`
    （21項目）/ `test:smoke` / `test:e2e`（20スイート）/ `verify:prod` /
    `verify:srs-global`、全PASS。
    **残課題**: オーナーから運営者情報（販売事業者名・運営責任者名・所在地・
    電話番号）の提供を受け、内容を確認・承認した後に、footerへのリンク追加と
    本ページの正式公開を別途実施する。

    **オーナー確認待ちリスト（`/legal/commercial-transaction`公開に必要な項目）**:
    - [ ] 販売事業者名
    - [ ] 運営責任者名
    - [ ] 所在地
    - [ ] 電話番号
    - [ ] メールアドレス（現状は既存`SUPPORT_EMAIL`を暫定使用、変更の要否）
    - [ ] 所在地・電話番号の公開方針（個人事業主の場合、「請求があれば遅滞なく
      開示する」という代替表記にするか、実際の住所・電話番号を記載するか）
    - [ ] 個人名で出すか、屋号（サービス名以外の屋号があれば）を併記するか
    - [ ] 本ページをfooterに公開するタイミング（運営者情報確定後、即時 or
      オーナーの最終レビュー後）

---

42. ✅ **完了（2026-07-06）: AI利用コスト・濫用対策の棚卸しと改善**
    Premium本格運用前の安全対策として、全AIルート（`/api/ai`・
    `/api/ai/study-plan`・`/api/ai/lookup`・`/api/ai/extract-words`・
    `/api/ai/weakness-analysis`・`/api/wordbook/[id]/ai-suggest`）を
    横断的に棚卸しし、以下を修正した（詳細は
    [PRODUCTION_MONITORING.md](PRODUCTION_MONITORING.md) §13参照）。
    **最重要の修正**: `/api/ai/study-plan`にサーバー側のPremium判定が
    一切なく、`/plan`ページのUI側だけで`isPremium`分岐していたため、
    ログイン済みの非Premiumユーザーがフォームを経由せず直接APIを叩けば
    無制限にClaude APIを呼べる状態だった。他4つのPremium必須ルートと
    同じ`is_premium`403ガードを追加。
    **その他の修正**: (1) `/api/ai/lookup`（辞書AI補完）に日次上限が
    無かったため、メイン解説APIと同じ日次カウンター（無料5回/日+
    `ai_generation`チケット救済）を共有するよう修正。(2) `lookup`・
    `ai-suggest`でAnthropic呼び出し本体がtry/catch未保護だったため保護。
    (3) `/api/ai`・`/api/ai/study-plan`・`/api/ai/lookup`の自由入力
    （word/meaning/exam/currentLevel）に文字数上限（100〜200文字）を追加。
    (4) `study-plan`の`targetDate`未検証によるNaN daysLeftを防止。
    (5) `ai-suggest`にAPIキー未設定時の503フォールバックを統一。
    **Premium向けソフト上限を新設**: 「AI利用無制限」の文言・実装は
    変更していないが、`/faq`に既にあった「過度な自動化利用を除く」という
    留保を実装で裏付けるため、通常利用では絶対に到達しない上限
    （1日300回、全AIルート共通・既存`profiles.daily_ai_used`を流用、
    DBスキーマ変更なし）を`src/lib/ai/premiumDailyCap.ts`として新設し、
    Premium限定の全AIルートに適用した。無料ユーザーの5回/日・
    `ai_generation`チケット救済ロジックには一切手を入れていない。
    **文言変更は行っていない**: 実装（ソフト上限）と既存の`/premium`・
    `/faq`の文言（「AI利用無制限」＋「過度な自動化利用を除く」の留保）が
    既に整合していたため、マーケティング文言・規約の変更は不要と判断した。
    Stripe価格変更・Webhook変更・SRS V2・teacher機能・教材データ・
    AdSense広告枠への変更なし。既存Premium機能・`ai_generation`チケット
    消費仕様は壊していない。
    **テスト追加**: `scripts/testing/e2e/ai-usage-guards.mjs`を新規作成
    （24項目、`run-e2e.mjs`ステップ24として追加）。未ログイン401・
    無料上限とチケット救済・Premiumソフト上限・巨大/空入力の拒否・
    `study-plan`のPremium判定と入力バリデーション・`/weak`/`/extract`/
    `/plan`への回帰なしを検証。`verify-premium-gating.mjs`にも
    `study-plan`の非Premium403/Premium通過チェックを追加。
    検証: `tsc --noEmit` / `build` / `test:premium-gating`（23項目）/
    `test:weak-analysis`（20項目）/ `test:smoke` / `test:ai-usage-guards`
    （新規24項目）/ `test:e2e`（24スイート）/ `verify:prod` /
    `verify:srs-global`、全PASS。
    **残課題**: Premiumソフト上限(300回/日)は本ラウンドで初めて実運用に
    投入するため、実際に到達するユーザーが出た場合は誤検知でないか
    （複数AI機能を組み合わせた正当な集中利用等）個別確認すること。
    また、`/api/ai`のメイン日次カウンター更新はcheck-then-updateであり
    厳密なアトミック性はない（同時リクエストでの取りこぼしは軽微、
    無料5回/日の枠内では実害小さいと判断し今回は変更していない。
    アトミック化にはPostgres RPC関数の新設等DB側変更が必要になるため、
    必要であれば別途提案・承認を得てから実施する）。

---

43. ✅ **完了（2026-07-06）: AI日次カウンターのatomic化**
    項目42の残課題（`/api/ai`のメイン日次カウンター更新がcheck-then-update
    方式で厳密なアトミック性がない）への対応。DB側RPC関数
    `public.try_consume_ai_quota()`（`supabase/migrations/015_atomic_ai_quota.sql`、
    SECURITY DEFINER）を新設し、対象ユーザーの`profiles`行を`select ... for
    update`でロックしてから判定・更新する設計に置き換えた。同一ユーザーの
    同時リクエストはこの関数呼び出し単位で直列化されるため、上限を超えて
    通過することがなくなった。`ai_generation`チケットの消費も同一
    トランザクション内でチケット行をロックしてから行うため、二重消費も
    同時に解消した。
    無料5回/日・Premium300回/日の値、チケットの消費方法(`used_amount`+1)は
    完全に維持。`is_premium`はクライアントから受け取らず、RPC内部で
    `auth.uid()`経由のログインユーザー自身の行のみを対象にする
    （クライアントの権限主張を一切信用しない設計）。
    **DB変更**: 新しい列・テーブルは追加していない（関数のみ追加）。
    既存RLS（profiles/reward_ticketsとも「本人のみ」）は変更していない。
    本番Supabase（`befjjebsrnsfwhtmydiv`）へ適用済み。適用直後に
    `RETURNS TABLE`の出力列`is_premium`と`profiles.is_premium`列名が
    衝突し曖昧列参照エラー(42702)になる不具合を発見・即座に修正（列を
    テーブルエイリアスで修飾）し、修正版を再適用して解消した。
    **リファクタ**: `route.ts`(メイン解説)・`lookup`・`study-plan`・
    `extract-words`・`weakness-analysis`・`ai-suggest`の6ルート全てが
    JS側の重複した判定ロジックをやめ、`src/lib/ai/aiQuota.ts`の
    `consumeAiQuota()`経由でこの1つのRPCを呼ぶだけになった。旧
    `src/lib/ai/premiumDailyCap.ts`は削除。
    **副次的な正しさの改善**（意図的な仕様変更ではなく、共通化の過程で
    解消した既存の潜在バグ）: (1) 旧`ai_generation`チケット検索は
    `amount > 0`のみで絞り込んでおり「未消費分が残っているか」はJS側の
    後判定だったため、複数チケットが存在し先頭のものが使い切られている
    場合に後続の未消費チケットで救済されない可能性があった → SQLの
    絞り込み自体に`amount > used_amount`を含めて解消。(2) 旧
    `/api/ai`のPremiumユーザー向け`remaining`計算が無料上限(5)を基準に
    しており、Premium上限(300)に対して常に不正な値を返していた →
    RPCがPremium/無料それぞれの正しい上限を基準に計算するよう修正。
    **テスト追加**: `test:ai-usage-guards`に同時POSTシナリオ（残り2回の
    境界で10件を同時送信し、許可されたのがちょうど2件・DB上の
    `daily_ai_used`がちょうど5であることを検証）を追加（24→27項目）。
    検証: `tsc --noEmit` / `build` / `test:ai-usage-guards`（新規27項目）/
    `test:premium-gating`（23項目）/ `test:weak-analysis` / `test:smoke` /
    `test:e2e` / `verify:prod` / `verify:srs-global`、全PASS。
    **残課題**: Premiumソフト上限300回/日の運用状況は引き続き
    [PRODUCTION_MONITORING.md](PRODUCTION_MONITORING.md) §13-3の監視観点で
    確認すること。

---

44. ✅ **完了（2026-07-06）: AI利用状況の運用監視（`/admin/ai`新設）**
    項目43の残課題「実運用でAIコスト・濫用に気づけるようにする」への対応。
    既存の`/admin/srs`と同じ設計思想（`requireAdmin()`で保護・読み取り専用・
    個人情報や学習内容は非表示）を踏襲した管理者専用ページ
    `/admin/ai`（AI利用状況モニタリング）を新設した。
    **表示内容**: 本日(JST)AIを使ったユーザー数・利用回数合計・無料/Premium
    別の利用回数合計・無料上限(5回)に近いユーザー数(4回以上)・Premiumソフト
    上限(300回)に近いユーザー数(250回以上)・`ai_generation`チケット残高
    (`amount>used_amount`)があるユーザー数・本日のdaily_ai_used上位5件
    (順位と回数のみ、個人は特定不可)・異常利用の簡易警告(無料ユーザーが
    5回超/Premiumユーザーが300回超/チケットのused_amountがamountを超えている
    、のいずれもatomic RPC上は理論上あり得ない状態のみを検知)。
    **使用データ**: `profiles`(`daily_ai_used`/`daily_ai_reset_at`/
    `is_premium`/`is_test_account`)と`reward_tickets`(kind='ai_generation'
    の`amount`/`used_amount`)のみ。新しいログテーブルは作成していない。
    **個人情報・AI入力内容は非表示**: メールアドレス・display_name・単語/
    英文/AIへの入力内容は一切取得・表示しない。テストアカウント
    (`is_test_account=true`)は全ての集計から除外し、E2E実行のたびに監視数値が
    汚染されるのを防いでいる。
    **admin以外は拒否**: 既存の`requireAdmin()`パターンをそのまま使用
    （未ログイン→`/login`、非admin→`/dashboard`）。RLSの変更は無し。
    **書き込み一切なし**: ページ表示でPremium状態・`daily_ai_used`・
    チケット残高のいずれも変更しない。
    **DBスキーマ変更なし**: 既存カラムのみで実装。
    変更していないもの: 無料5回/日・Premium300回/日の値、`ai_generation`
    チケット消費仕様、AI quota RPC、Stripe/Webhook、特商法ページ、AdSense
    広告枠、SRS V2、teacher機能、教材データ。`/admin`配下は既存の
    `robots.txt`の`Disallow: /admin`で引き続きクロール対象外。
    **テスト追加**: `scripts/testing/e2e/admin-ai-usage.mjs`を新規作成
    （17項目、`run-e2e.mjs`ステップ25として追加）。admin権限での表示・
    非admin/未ログイン時のリダイレクト・集計項目の表示・個人情報/単語データ
    非開示・書き込み無し・テストアカウントが集計から正しく除外されること
    (daily_ai_usedを4→0に変えても「無料上限に近いユーザー」の値が変化しない
    ことで確認)を検証。
    検証: `tsc --noEmit` / `build` / `test:admin`(既存回帰、10項目) /
    `test:admin-ai-usage`(新規17項目) / `test:ai-usage-guards`(27項目) /
    `test:smoke` / `test:e2e`(22スイート) / `verify:prod` /
    `verify:srs-global`、全PASS。
    **残課題**: AI route別（`/api/ai`本体・`lookup`・`study-plan`・
    `extract-words`・`weakness-analysis`・`ai-suggest`）の詳細な利用内訳や
    日次を超えた過去トレンドが必要になった場合は、専用ログテーブルの新設を
    検討する（本ラウンドではDBスキーマ変更を避けるため見送り、提案のみ）。

---

## 💰 収益化・成長 監査（2026-07-04）

事業・収益・継続率・SEO流入の観点でコード・DB・教材・公開ページを監査した結果。
9つの観点それぞれについて、既に実装済み/未実装/バグの可能性ありを整理する。

### 監査サマリー（観点別）

| # | 観点 | 現状評価 | 収益/継続率インパクト | 実装難易度 |
|---|---|---|---|---|
| 1 | TOEIC/ビジネス教材 | 🟢 対応済み（2026-07-04、後述） | 高（社会人流入・Premium転換） | 低〜中（教材追加のみ） |
| 2 | 復習の雪だるま対策（リカバリー） | 🟢 対応済み（2026-07-04、後述） | 高（離脱防止） | 中 |
| 3 | 専門分野・ニュース語彙 | ❌ ほぼ無い | 中（差別化・社会人訴求） | 低〜中（教材追加のみ） |
| 4 | ダッシュボードの進捗可視化 | ✅ 想定よりかなり充実 | — | — |
| 5 | ゲーミフィケーション | ✅ 想定よりかなり充実 | — | — |
| 6 | AI復習最適化 | 🟢 対応済み（2026-07-05、後述） | 中（Premium訴求） | 中〜高 |
| 7 | SEO・内部リンク | 🟢 対応済み（2026-07-04、後述） | 中（SEO流入の底上げ） | 低 |
| 8 | 調べる→登録→復習→テスト導線 | ✅ 前回までにほぼ整備済み | — | — |
| 9 | 単語帳削除バグ | 🔴 本物のバグ（機能欠落） | — | 低（**本ラウンドで修正済み**、完了項目20参照） |

### 1. TOEIC/ビジネス教材（🟢 対応済み・2026-07-04）

監査時点では全39教材・32,692語のうち、**TOEIC教材はわずか2件（TOEIC頻出単語800=2,500語 /
600=263語、計2,763語）**、ビジネス英語専用の教材は**0件**だった。英検（11教材・7,759語）・
大学受験（9教材・9,083語）と比べてボリュームの差が大きく、社会人が初回訪問時に
「使えそう」と感じられる教材が量的に不足していた。

**2026-07-04対応**: 「TOEIC 基礎100」「TOEIC 頻出動詞100」「ビジネス英語 基礎100」
「会議・メール英語100」の4パック（計400語）を追加し、TOEIC教材2件→6件（計約3,163語）、
ビジネス英語専用教材0件→2件になった。詳細は優先度A完了項目21参照。
**2026-07-05追加対応**: 「TOEIC 頻出名詞100」「経済ニュース英単語100」「企業ニュース英単語100」
の3パック（計300語）を追加し、TOEIC教材は5件、ビジネス英語専用教材は4件に増加した。
詳細は優先度A完了項目27参照。
**2026-07-05さらに追加対応**: 経済/企業ニュースを英語で読みたい社会人・投資/ビジネス関心層を
取り込むため、`/materials/toeic`・`/materials/business`に続く3本目のカテゴリLP
`/materials/news`を新設した。詳細は優先度A完了項目28参照。

### 2. 復習の雪だるま問題（🟢 対応済み・2026-07-04）

監査時点ではSRSスケジューリング自体（V1固定間隔・V2動的SM-2ライク）は正常に機能していたが、
**「サボった後の救済導線」が一切存在しなかった**（`/review`の復習キューは`.limit(50)`の
ハード上限のみ、ダッシュボードの復習待ち件数は生の数字のまま表示、「まず10語だけ」ボタン等は
未実装）。優先順位付け自体（`next_review_at`昇順=最も遅延している単語から）は既に妥当な設計
だった。

**2026-07-04対応**: 復習待ちが20語以上溜まった時に「まず10語だけ」「20語だけ進める」ボタンを
表示するリカバリーモードを実装した。既存のdue取得ロジックを再利用し、SRS V2の採点/更新ロジック
は変更していない。完了後は「今日はここまででOK！」という前向きな表示に切り替わる。
詳細は優先度A完了項目22参照。

### 3. 専門分野・ニュース語彙（🟡 経済・企業ニュースは対応済み、テック/バイオ/医療は引き続き未対応）

監査時点では経済・金融・企業・決算・株式・テクノロジー・バイオ・医療をタイトルに含む教材を
検索したが、**「loop学びなおし英単語③【ニュース・教養】」（300語）の1件のみ**がヒットした
（一般教養寄りで、経済/金融/テック/医療に特化したものではない）。経済・金融・バイオ・医療の
専門語彙デッキは**0件**だった。

**2026-07-05対応**: 「経済ニュース英単語100」「企業ニュース英単語100」の2パック（計200語）を
追加し、経済・企業ニュースを読むための基礎語彙は整備した。詳細は優先度A完了項目27参照。
**残課題**: テクノロジー/IT・バイオ・医療の専門語彙デッキは引き続き0件のまま
（末尾「次に増やすべき教材候補」の「テクノロジー・IT業界ニュース英単語100」参照）。

### 4. ダッシュボードの進捗可視化（✅ 想定よりかなり充実）

調査の結果、`src/app/dashboard/page.tsx`には既に以下が実装済みだった: ストリークバッジ、
今日の目標進捗バー、学習数/正答率/復習待ちの3統計カード、状況に応じた次アクションCTA
（復習待ちがあれば復習ボタンを主導線に、無ければレッスンを主導線に切り替え）、
デイリーミッション4種、獲得バッジ表示、次のバッジまでの進捗、週間チャレンジ、
XP/レベルシステム、90日間の学習カレンダー、最近学習した単語、今日の単語。
~~唯一の欠落: `words.mastery`（習得率）はDBに保存・計算されているが、ダッシュボード上の
どこにも表示されていない。苦手単語もダッシュボードには件数カードが無く、`/weak`への
リンクのみ。~~ → **2026-07-05に対応済み**（優先度A完了項目26）。習得率カード・苦手単語
カードを追加した。詳細は完了項目26参照。

### 5. ゲーミフィケーション（🟢 リワードチケット連携も対応済み・2026-07-05）

ユーザーが「不足している」と想定していた要素の多くが**既に実装済み**だった:
連続学習ストリーク（ダッシュボードに表示）、バッジ6種（3日/7日/30日継続・100/500/1000語）、
次のバッジへの進捗バー、週間ランキング（`/ranking`、全ユーザー公開・上位50人）、
XP/レベルシステム、デイリーミッション、週間チャレンジ。
監査時点での唯一の欠落: ストリーク/バッジ達成とリワードチケット（広告視聴で貰えるチケット）
システムの連携が無い（別々の仕組みのまま）。

**2026-07-05対応**: ダッシュボードに「🎟️ 今日の達成チケット」カードを追加し、今日の学習達成・
復習10語達成・苦手単語を復習・7日連続達成の4種を「チケット」風に可視化した（優先度A完了
項目29）。同日中にさらに、安全性を調査した上で`reward_tickets`への実付与（1日1枚まで、
既存の広告視聴チケットとは別kind）まで実装した（優先度A完了項目30）。**残課題**: DB側の
ユニーク制約による二重付与防止の完全化は未実装（末尾「ゲーミフィケーション×リワード
チケットの次の一手」参照、DBスキーマ変更が必要なため提案のみ）。

### 6. AI復習最適化（🟢 2026-07-05対応済み、優先度A完了項目35）

SRS V2（動的SM-2ライク、`ease_factor`/`interval_days`/評価4段階）は本番でグローバル有効。
`is_weak`フラグ・正答/誤答回数（`correct_count`/`wrong_count`）は既に`words`テーブルに
保持され、復習キュー（`is_weak`常時混入）・4択/入力等の出題重み付けで活用済み
（前回までの優先度A完了項目9・10）。「品詞別弱点分析」「単語帳別弱点分析」
「間違え方に応じた復習提案」は、2026-07-03時点でPremium向けAI分析
（`/api/ai/weakness-analysis`、品詞別パターン・改善アドバイス）としてすでに実装
済みだったことが2026-07-05の調査で判明。今回、無料ユーザーにも品詞別・単語帳別・
習熟度別の傾向が分かる決定論的な集計セクション（AI不要）を`/weak`に追加し、
「無料=確認、Premium=詳しい分析」という価値差を整理した（完了項目35）。

### 7. SEO・メタ情報・内部リンク（🟢 対応済み・2026-07-04）

想定より土台が強かった: `/materials`・`/materials/[id]`（動的generateMetadata）・
`/dictionary`・`/guide`・`/grammar`・`/faq`はいずれもキーワードを含む具体的なtitle/
descriptionを持ち、構造化データ（BreadcrumbList・FAQPage・Article・ItemList）も8ファイルで
実装済み。sitemapも教材・guide・grammarの動的ルートを網羅している。実質的な弱点は
内部リンクの密度だった（関連教材リンク無し、辞書⇄教材の相互導線無し等）。

**2026-07-04対応**: `/materials/[id]`に関連教材セクション（同exam_typeグループ、最大6件）、
教材⇄辞書の相互CTA、`/materials`のカテゴリクイックジャンプ、`/grammar`・`/guide`・`/faq`から
`/materials`・`/dictionary`への相互リンクを追加。`/dictionary`にBreadcrumb構造化データも
追加した。詳細は優先度A完了項目23参照。

### 8. 調べる→登録→復習→テストの導線（✅ 前回までにほぼ整備済み）

優先度A完了項目13・14（単語帳詳細への7導線整理、教材インポート後の3ボタンCTA）で
主要な導線はすでに整備済み。今回の監査で見つかった残る小さな穴は上記7番の
「`/dictionary`から教材への導線が無い」点のみ。

### 9. 単語帳削除バグ（🔴 本物のバグ→本ラウンドで修正済み）

**確認の結果、本当にバグ（機能欠落）があった。** ユーザーが作成した単語帳にも、教材インポートで
作られた単語帳にも、削除する手段がUI上に一切存在せず、`/api/wordbook/[id]`にDELETE
ハンドラ自体が存在しなかった。RLS（`word_books owner all`ポリシー、`auth.uid()=user_id`）は
削除自体を禁止していなかったため、原因はRLSではなく**純粋なアプリ側の機能欠落**。
本ラウンドのPhase 1で最優先修正済み（完了項目20参照）。

---

## 🟢 優先度A: 今すぐ着手できる（低工数・高効果・外部依存少）

1. **Search Console初回結果確認**（2026-07-08頃目安）
   登録から約1週間後、「ページ」タブでインデックス状況（登録済み/除外の内訳）と
   検索パフォーマンス（クリック数・表示回数・平均掲載順位）の初回データを確認する。
   外部作業のみ・コード変更なし。SEO記事追加（優先度B）の判断材料にもなる。

2. ✅ **完了（2026-07-04）: 復習リカバリーモードの基本実装**（収益化監査#2、離脱防止・高インパクト）
   優先度A完了項目22で対応済み。`/review?mode=recovery&limit=10`（`&book=<id>`対応）で
   少量スタートができるようになり、完了後は前向きなメッセージに切り替わる。SRS V2の間隔計算
   ロジック（`ease_factor`/`interval_days`）や既存の`next_review_at`昇順ソートは無変更。
   詳細は完了項目22参照。**残課題**: 「リセット」「スケジュール再調整」は今回意図的に
   スコープ外とした（別タスク）。

3. ✅ **完了（2026-07-04）: 教材・辞書ページの内部リンク強化**（収益化監査#7、SEO流入・低コスト高効果）
   優先度A完了項目23で対応済み。教材詳細ページの関連教材セクション、教材⇄辞書の相互CTA、
   `/materials`のカテゴリクイックジャンプ、`/grammar`・`/guide`・`/faq`からの相互リンクを
   追加した。詳細は完了項目23参照。

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

2c. ✅ **完了（2026-07-04）: 既存教材へのプリセットメタデータ拡張**
   優先度A完了項目15で対応済み。既存31教材にも対象学年・目的・推奨期間・1日目安語数・
   カテゴリ・タグを付与した。詳細は完了項目15参照。

2d. **出題の「suspended」ラベル・直近出題履歴の永続化（優先度A完了項目9・10の延長）**
   `suspended`（特定単語の出題を一時停止）は対応するDBカラムが存在せず未実装。必要になった
   場合は`words`に`boolean`列を1つ追加するmigrationから設計する。また、直近出題履歴は
   現状ページ表示中のみ保持（タブを閉じる・再訪問でリセット）。セッションをまたいだ抑制が
   必要になった場合は`localStorage`または新規テーブルでの永続化を検討する。

2e. ✅ **完了（2026-07-03）: attackモードの単語帳スコープ対応**
   優先度A完了項目11で対応済み。`/test/attack?book=<id>`で単語帳指定、未指定時は
   全単語帳横断のまま。詳細は完了項目11参照。

2f. ✅ **完了（2026-07-04）: 教材インポート後導線の整理**
   優先度A完了項目14で対応済み。`ImportMaterialButton.tsx`の「テスト開始」
   （`/test/choice?book=`固定）を、メインCTA「📖 単語帳で学習モードを選ぶ」
   （`/wordbooks/<id>`）+サブCTA「🎯 4択で始める」「📄 PDFテストを作る」の
   3ボタン構成に整理した。詳細は完了項目14参照。attackへの直接導線は今回も
   追加していない（単語帳詳細ページ経由で到達可能なため）。

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

9. ✅ **完了（2026-07-04）: 教材パックの追加拡充 Part2**
   優先度A完了項目17で対応済み。「英検3級 基礎100」「高校英単語 基礎100 Part2」
   「大学受験 基礎名詞100」「日常英会話 超基礎50」の4パック(計350語)を追加した。
   詳細は完了項目17参照。次の候補は本ドキュメント末尾「次に増やすべき教材候補」参照。

10. ✅ **完了（2026-07-04）: TOEIC・ビジネス英語スターターパックの追加**（収益化監査#1、社会人・TOEICユーザー取込）
   優先度A完了項目21で対応済み。「TOEIC 基礎100」「TOEIC 頻出動詞100」「ビジネス英語 基礎100」
   「会議・メール英語100」の4パック(計400語)を追加した。詳細は完了項目21参照。
   TOEIC教材は2件→6件（計約3,163語）、ビジネス英語専用教材は0件→2件に増加。
   **残課題**: 「TOEIC頻出名詞100」は今回は見送った（動詞パックを優先）。
   → **2026-07-05に対応済み**（優先度A完了項目27）。経済/企業ニュース英単語パックと
   あわせて追加した。TOEIC教材は5件、ビジネス英語専用教材は4件に増加。詳細は完了項目27参照。

11. ✅ **完了（2026-07-05）: ダッシュボードに習得率カード・苦手単語カードを追加**（収益化監査#4）
   優先度A完了項目26で対応済み。習得率カード（習得済み/学習中/苦手の内訳・全体習得率・
   `/wordbooks`「単語帳別に見る」/`/review`「復習する」導線）と苦手単語カード（最大5件・
   `/weak`へ「すべて見る →」・控えめなPremium導線）を追加した。詳細は完了項目26参照。

12. ✅ **完了（2026-07-05）: ゲーミフィケーション×リワードチケット連携「今日の達成チケット」**（収益化監査#5）
   優先度A完了項目29で対応済み。今日の学習達成・復習10語達成・苦手単語を復習・7日連続達成
   の4種を「チケット」風に表示。詳細は完了項目29参照。
   **2026-07-05追加対応**: 安全性を調査した上で、実際に`reward_tickets`へ1日1枚まで
   付与できる`POST /api/gamification/claim-daily-ticket`を実装した（優先度A完了項目30）。
   既存の広告視聴チケットとは別kind(`daily_achievement`)のため収益に関わる消費導線とは
   独立している。詳細は完了項目30参照。

13. ✅ **完了（2026-07-05）: 社会人向け教材3パックの追加**（収益化監査#1・#3の延長）
   優先度A完了項目27で対応済み。「TOEIC 頻出名詞100」「経済ニュース英単語100」
   「企業ニュース英単語100」の3パック（計300語）を追加した。詳細は完了項目27参照。

14. ✅ **完了（2026-07-05）: ニュース英語向け公開LP（`/materials/news`）の新設**（収益化監査#1・#3の延長）
   優先度A完了項目28で対応済み。経済ニュース英単語100・企業ニュース英単語100を主役とした
   3本目のカテゴリLPを新設した。詳細は完了項目28参照。

## 🟠 優先度C: 条件が整ってから（外部要因・法務要因あり、または現時点で不要）

10. **`/admin/srs`のSQL集計RPC化**
    優先度A完了項目2の残課題。現在の全件JS集計は約1,000件では十分高速。
    総単語数が数万〜十万件規模まで増えてから着手すれば十分（今は不要）。

11. **AdSense承認後の広告枠拡大（オーナー承認済みの展開順序あり）**
    優先度A完了項目18・19で審査状況確認・広告ユニット1件の本番投入（`/dashboard`限定）まで
    完了済み。2026-07-04時点でAdSense管理画面のサイトステータスは`Getting ready`のため、
    **現時点では追加実装をせず審査完了待ち**とする方針でオーナー承認済み。
    `Ready / 準備完了`になった後は、以下の順で他ページへ再展開する（1ページ追加ごとに
    オーナー承認を得てから実装、一括追加はしない）: ①`/materials` → ②`/materials/[id]` →
    ③`/dictionary` → ④`/guide` → ⑤`/grammar` → ⑥`/faq`。いずれも未ログインでも閲覧できる
    公開・参照系ページ。学習中画面(`/learn`・`/test/*`)・復習中画面(`/review`実行中)・
    タイムアタック・入力フォーム周辺には当面追加しない方針。詳細は
    [ADSENSE_SETUP.md](ADSENSE_SETUP.md)§4-3・§4-4参照。

12. **保護者同意導線**
    先生機能に未成年の生徒が本格的に関わる場合に必要。現状は「本人同意のみ」でMVP化した設計
    （[PHASE2B_TEACHER_DESIGN.md](PHASE2B_TEACHER_DESIGN.md)参照）。
    実際に学校・塾での利用が具体化した段階で、法務観点も含めて設計から見直すべき。

13. **Teacher Planの課金設計**
    設計のみ先行可能（実装・本番課金導入はしない）。教師機能の実利用状況・要望を見てから
    プラン内容を固める方が手戻りが少ない。**課金の本番導入は明示的な承認があるまで行わない**。

14. ~~**AI弱点クラスタ分析（品詞別・単語帳別、Premium機能候補）**（収益化監査#6）~~
    **2026-07-05対応済み（優先度A完了項目35）**。Premium向けAI分析は2026-07-03時点で
    既に実装済みだったことが判明し、無料ユーザー向けの決定論的な品詞別・単語帳別・
    習熟度別集計を追加して「無料=確認、Premium=詳しい分析」の価値差を整理した。

15. **専門分野・ニュース語彙デッキの拡充（経済・金融・テック・医療）**（収益化監査#3）
    現状「ニュース・教養」教材が1件（300語）のみで、経済・金融・テック・医療の専門語彙は
    0件。「経済ニュース英単語100」「企業ニュース英単語100」「テクノロジーニュース英単語100」
    等が候補。**教材データの大量作成は別タスクとして着手する**（項目10のTOEIC/ビジネス系と
    合わせてまとめて計画するのが効率的）。

## ⚪ 保留・要判断（大きな設計変更を伴う）

- 上記以外の新機能全般は、まず優先度A・Bの安定運用が回り始めてから検討する

## ゲーミフィケーション×リワードチケットの次の一手（優先度A完了項目30〜34の延長・提案のみ）

「今日の達成スタンプ」（旧称「今日の達成チケット」）は2026-07-05に、
`kind="daily_achievement"`での実記録（`POST /api/gamification/claim-daily-ticket`、
1日1枚まで）、DB側の部分ユニークインデックスによる二重防止の完全化（完了項目31）、
そして「交換可能なチケットではなく達成の記録（スタンプ）」であることをUI文言で
明確化（完了項目32）まで実装済み。あわせて`extra_review`の消費コード未整備問題も
解消し、reward_ticketsに永続化しない「その場で完結する報酬」として整理した上
（完了項目33）、無料の「もう一度」ボタンと広告ゲート版の役割を分担し、広告視聴に
実質的な価値（新しい問題セット・全語の再周回）を持たせた（完了項目34）。
さらに発展させる場合の設計案（**いずれも実装はせず提案に留める**）:

- **daily_achievementの将来の交換機能**: 現状は消費先を持たない「達成履歴」だが、
  将来的に何らかの特典（例: 期間限定のPremium体験・限定バッジ）と交換できる導線を
  追加する余地はある。ただし完了項目32で判断した通り、既存の`ai_generation`（AI利用
  上限バイパス）に直結させるとPremium価値を薄めるため、接続先は慎重に選定し、
  実装前に必ずオーナー承認を得ること。
- **ChoiceTestRunnerの「別の10問」の質の向上**（完了項目34の延長）: 現状は
  `buildQuestions()`の既存ロジックそのままで「未出題語を優先」する程度の差別化だが、
  苦手単語(`is_weak`)を優先的に混ぜる等、広告視聴後の10問により高い学習価値を
  持たせる余地がある。優先度は低め（現状でも「新しい問題」という価値は成立している）。
- **付与条件の段階化**: 現状は4条件のうちどれか1つで1枚だが、達成数に応じて枚数を増やす
  （例: 2条件達成で2枚、全達成で3枚）等の段階化も可能。ただし過剰な無料配布を避けるため
  慎重に検討する。
- Premium訴求と絡める場合は、「無料ユーザーは1日1枚まで、Premiumは達成ごとに付与」等の
  差別化を検討できるが、今回は「過剰に煽らない」方針のため提案のみに留める

## 次に増やすべき教材候補（優先度Bの9番、教材パック拡充の延長）

2026-07-02の初回4パック（中学基礎100・高校基礎100・英検準2級基礎100・大学受験基礎動詞100）、
2026-07-04のPart2の4パック（英検3級基礎100・高校基礎100 Part2・大学受験基礎名詞100・
日常英会話超基礎50、計8パック・750語）、2026-07-04のTOEIC/ビジネス4パック（TOEIC基礎100・
TOEIC頻出動詞100・ビジネス英語基礎100・会議/メール英語100、計12パック・1,150語）、
2026-07-05の社会人向け3パック（TOEIC頻出名詞100・経済ニュース英単語100・
企業ニュース英単語100、計15パック・1,450語）を追加済み。
利用状況を見てから判断するのが基本方針だが、候補として以下を挙げておく。既存の大規模教材
（31件）とレベル帯が重複するため、あくまで「スターターパック」として小規模・高品質に絞って
追加する方針を継続する。

- **英検2級 基礎100**: 英検3級基礎100・英検準2級基礎100の次のステップとして自然な位置づけ
- **大学受験 基礎形容詞100**: 既存の「基礎動詞100」「基礎名詞100」と対になる形容詞版
- **日常英会話 超基礎50 Part2（旅行編）**: 今回のPart1（あいさつ・基本フレーズ）の続きとして、
  旅行・買い物場面の実用語彙
- **テクノロジー・IT業界ニュース英単語100**（収益化監査#3の延長）: 経済/企業ニュースに続き、
  IT・スタートアップ・AI関連ニュースを読むための語彙。社会人・エンジニア層の追加取り込みを狙う
- **就活・転職英語100**（社会人向け拡充の延長）: 職務経歴・面接・条件交渉で使う語彙。
  「TOEIC・ビジネス英語」セクションと親和性が高い
- **人事・労務ニュース英単語100**（企業ニュース英単語100の延長）: 採用・評価制度・働き方改革
  など、企業ニュース100で扱いきれなかった人事系語彙

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
