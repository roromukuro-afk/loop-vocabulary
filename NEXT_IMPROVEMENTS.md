# NEXT_IMPROVEMENTS — 次の改善候補（優先順位付き）

> 安定運用フェーズの方針: 新機能実装より先に「今すぐやるべき軽い作業」を優先し、
> 大きめの機能追加は実際の利用状況を見てから判断する。
> 各項目は着手前に個別のご確認をいただく（本ドキュメントは提案のみ・実装はまだしない）。
>
> **2026-07-04時点: 優先度A（下記19項目）はすべて完了。現在は次の優先度整理フェーズ。**
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

## ⚪ 保留・要判断（大きな設計変更を伴う）

- 上記以外の新機能全般は、まず優先度A・Bの安定運用が回り始めてから検討する

## 次に増やすべき教材候補（優先度Bの9番、教材パック拡充の延長）

2026-07-02の初回4パック（中学基礎100・高校基礎100・英検準2級基礎100・大学受験基礎動詞100）と
2026-07-04のPart2の4パック（英検3級基礎100・高校基礎100 Part2・大学受験基礎名詞100・
日常英会話超基礎50、計8パック・750語）を追加済み。利用状況を見てから判断するのが基本方針だが、
候補として以下を挙げておく。既存の大規模教材（31件）とレベル帯が重複するため、あくまで
「スターターパック」として小規模・高品質に絞って追加する方針を継続する。

- **英検2級 基礎100**: 英検3級基礎100・英検準2級基礎100の次のステップとして自然な位置づけ
- **TOEIC 基礎100**: 既存のTOEIC教材(800語・600語)はいずれも大規模で、スターターパック
  規模の入門版がまだ無い
- **大学受験 基礎形容詞100**: 既存の「基礎動詞100」「基礎名詞100」と対になる形容詞版
- **日常英会話 超基礎50 Part2（旅行編）**: 今回のPart1（あいさつ・基本フレーズ）の続きとして、
  旅行・買い物場面の実用語彙

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
