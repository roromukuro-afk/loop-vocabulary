# WORK_HISTORY — Loop Vocabulary

> 作業の時系列ログ。新しいものを上に追記する。
> 最終更新: 2026-07-02

---

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
