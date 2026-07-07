# LAUNCH READINESS CHECKLIST — Loop Vocabulary

> **対象読者**: このリポジトリの運用者（オーナー）専用のドキュメントです。ユーザー向け・
> 公開向けの文書ではありません。Premium・Stripe・AI・AdSense・法務・cron・監視の
> 現状を1箇所で確認し、「本番運用として問題ないか」を判断するためのチェックリストです。
>
> 各項目は既存ドキュメント（[PRODUCTION_MONITORING.md](PRODUCTION_MONITORING.md)・
> [ADSENSE_SETUP.md](ADSENSE_SETUP.md)・[SEARCH_CONSOLE_SETUP.md](SEARCH_CONSOLE_SETUP.md)）
> の該当セクションを参照する形にしており、詳細な調査結果・修正履歴はそちらが一次情報です。
> 本書は「今すぐ何を確認すべきか」の入口として使ってください。
>
> 最終更新: 2026-07-07（このドキュメント自体はコード変更を伴わない棚卸しです。
> 実装状況は本書作成時点のものであり、その後の変更で古くなる可能性があります。
> 定期的に本書とコード・ダッシュボードの実態を突き合わせてください）。

---

## 使い方

- [ ] チェックボックスは「本番運用前に確認済みかどうか」の状態を表します。運用開始前に
  一通り確認し、未チェックの項目があれば対応するか、意図的に保留する場合はその理由を
  記録してください。
- 各セクション末尾の「確認コマンド」は `npm run <script>` で実行できます。実行方法・
  検証の対象範囲は [PRODUCTION_MONITORING.md](PRODUCTION_MONITORING.md) 末尾の
  「自動検証コマンドの運用」表を参照してください。
- 太字の **⚠️ オーナー確認待ち** は、私（Claude）側では判断・実施できず、運用者の
  操作・確認・法的判断が必要な項目です。

---

## 1. Stripe / Premium

- [x] **Checkout route** (`POST /api/stripe/checkout`) 実装済み。未ログイン401・
  既にPremiumなら409 `already_premium`（二重課金防止）。新規顧客作成時に
  `stripe_customer_id` を `profiles` へ保存する。
- [x] **Webhook route** (`POST /api/stripe/webhook`) 実装済み。署名検証
  （`STRIPE_WEBHOOK_SECRET`）失敗時は400、`checkout.session.completed` /
  `customer.subscription.updated` / `customer.subscription.deleted` を処理し
  `is_premium` / `premium_expires_at` を更新する。未知のイベントタイプ・存在しない
  顧客/ユーザーIDでもクラッシュしない設計（`npm run test:stripe-premium-webhook`
  で検証済み）。
- [x] **Webhook endpointの重複解消**（2026-07-06対応）: Stripe Dashboard側に
  同一URLを指す重複endpointが2本登録されていた問題を解消済み。正しいイベント構成の
  endpoint（`customer.subscription.updated`を含む）を残し、signing secretをroll、
  Vercel Production `STRIPE_WEBHOOK_SECRET` に反映済み。もう片方は削除ではなく
  **無効化**のまま残っている。詳細: [PRODUCTION_MONITORING.md §11-5](PRODUCTION_MONITORING.md)。
  - [ ] **⚠️ オーナー確認待ち**: Stripe Dashboard → Developers → Webhooks で、
    有効なendpointが1本だけになっているか（無効化した方を誤って再有効化していないか）を
    定期的に確認する。
  - [x] **無効化済み重複endpointの削除要否（2026-07-07オーナー方針確定）**: 現時点では
    削除せず無効化のまま様子見する。正規endpointで初回実課金のWebhook delivery・
    Premium反映が確認できた後に、削除するかどうかを判断する。
- [x] **`STRIPE_WEBHOOK_SECRET`**: Vercel Production環境変数に設定済み（値はここには
  記載しない）。`npm run verify:prod` で `/api/stripe/webhook` が404になっていないこと
  （＝ルート自体は生きていること）のみHTTPレベルで確認できる。signing secretが
  Stripe側の値と一致しているかはStripe Dashboardの配信ログ（200 vs 400の比率）で確認する。
- [x] **`profiles.stripe_customer_id` / `premium_expires_at` / `is_premium`**:
  いずれも本番Supabaseに存在（2026-07-05に発覚した「列が本番未適用でStripe連携が
  壊れていた」不具合は修正済み）。`npm run verify:prod` の
  「Stripe/Premium schema columns」セクションで列の存在を毎回自動確認している。
- [x] **Customer Portal** (`POST /api/stripe/portal`): 実装済み。未ログイン401、
  `stripe_customer_id` が未設定なら404 `no_subscription`。`/settings` の
  「サブスクリプションを管理」ボタンから呼び出される（`stripe_customer_id` 未設定なら
  ボタン自体が非表示）。
- [x] **Premiumユーザーの二重checkout防止**: `POST /api/stripe/checkout` が
  Premiumユーザーからの呼び出しに409 `already_premium` を返す（Stripe API呼び出し前に
  ガード）。`npm run test:stripe-premium-webhook` / `npm run test:premium-conversion`
  で検証済み。
- [x] **アカウント削除とPremium解約の関係**: アカウント削除はStripeサブスクリプションを
  自動解約しない設計。`/privacy` ・ `/account/delete` ・ `/settings`（Premium表示時）に
  注意書きを追加済み。運用ルール: `account_deletion_requests` の処理（現状手動）前に、
  対象ユーザーの `is_premium` / `stripe_customer_id` を確認し、有効な購読があれば
  Stripe側で解約してからアカウントを削除すること（詳細:
  [PRODUCTION_MONITORING.md §12-3](PRODUCTION_MONITORING.md)）。

### ⚠️ 初回実課金時に確認すること（未実施・オーナー確認待ち）

これまでStripeの本番small額決済・本番checkout sessionの作成・本番live endpointへの
テストWebhook送信はいずれも実施していない（安全に本番へ影響を与えず実施する手段が
確認できなかったため）。**初めて実際の課金が発生したタイミングで**、以下を必ず確認する。

- [ ] Stripe Dashboard → Payments/Subscriptions で決済が実際に成功しているか
- [ ] Stripe Dashboard → Developers → Webhooks → 対象endpointの配信ログで
  `checkout.session.completed` が200で届いているか
- [ ] 本番 `profiles` の該当ユーザー行で `is_premium=true` / `stripe_customer_id` /
  `premium_expires_at` が正しく反映されているか
- [ ] `/premium` にログインし直し、実際にPremium表示・機能解放になっているか
- [ ] 何か異常があれば [PRODUCTION_MONITORING.md §11-1〜§11-4](PRODUCTION_MONITORING.md)
  の手順に従って調査する

**確認コマンド**: `npm run verify:prod` / `npm run test:stripe-premium-webhook` /
`npm run test:premium-conversion` / `npm run test:premium-gating`

---

## 2. AI利用・コスト対策

- [x] **無料ユーザー: 5回/日** + `ai_generation` チケットによる救済（広告視聴等で
  付与、消費してもその日の日次カウンターは増えない）。値・救済ロジックは
  ラウンドを跨いで変更していない。
- [x] **Premiumユーザー: 1日300回のソフト上限**（全AIルート共通）。通常の学習利用では
  到達しない値（目安: 1分に1回呼び続けても5時間分）。到達時は
  `429 premium_daily_limit_reached`。「AI利用無制限」という`/premium`表記との整合は
  [PRODUCTION_MONITORING.md §13-2](PRODUCTION_MONITORING.md) を参照。
- [x] **Atomic RPC** (`try_consume_ai_quota()`, `supabase/migrations/015_atomic_ai_quota.sql`):
  日次カウンター判定・チケット消費を1つのDB関数内で行毎ロック(`for update`)して行い、
  同時リクエストでの上限超過（lost update）を防止済み。`src/lib/ai/aiQuota.ts` が
  ラッパー。
- [x] **`ai_generation`チケット**: 広告視聴時に `reward_tickets` へ付与、AI利用上限
  バイパスとして消費。二重消費はatomic RPC内のロックで防止済み。
- [x] **route別ログ** (`ai_usage_events` テーブル): 全6AIルートの成功/quota拒否/
  認証拒否/Premium拒否/API失敗/入力検証エラーを記録。**AIへの入力本文・prompt・
  Claudeの応答本文・メールアドレスは一切保存しない**（保存用の列自体が存在しない）。
  RLS有効・ポリシー無しのためservice_role以外からは読み書き不可。詳細:
  [PRODUCTION_MONITORING.md §13-6](PRODUCTION_MONITORING.md)。
- [x] **`/admin/ai`**: admin専用の読み取り専用モニタリング画面。本日の利用状況・
  直近7日間のroute別/日別トレンド・簡易スパイク検知を表示。個人情報
  （メールアドレス・単語・AI入力内容）は一切表示しない。テストアカウント
  （`is_test_account=true`）は集計から自動除外。詳細:
  [PRODUCTION_MONITORING.md §13-3〜§13-6](PRODUCTION_MONITORING.md)。
- [x] **90日保持**: `ai_usage_events` の既定保持期間は90日。`ai_usage_events.user_id`
  は `on delete cascade` のため、アカウント削除時は保持期間を待たず即時削除される。
  詳細: [PRODUCTION_MONITORING.md §13-7](PRODUCTION_MONITORING.md)。
- [x] **cleanup cron**（月1回自動、2026-07-07導入）: `/api/admin/cleanup/ai-usage-events`
  を `vercel.json` の `crons`（`0 19 1 * *`、毎月1日19:00 UTC）から呼び出す。
  `CRON_SECRET` 保護、未設定時は503で拒否し絶対に実行しない設計。詳細:
  [PRODUCTION_MONITORING.md §13-8](PRODUCTION_MONITORING.md)。
  - [x] **オーナー確認済み（2026-07-07）**: Vercel Dashboard → Cron Jobsで
    `/api/admin/cleanup/ai-usage-events`の登録を確認。schedule `0 19 1 * *`
    （月1回）、既存2件（`daily-push` / `weekly-digest`）と合わせて合計3件、
    上限エラーなし、Production環境で有効、Cron Jobs機能トグルはEnabled。
- [x] **手動cleanupコマンド**: `npm run cleanup:ai-usage-events`（dry-run、既定）・
  `npm run cleanup:ai-usage-events:apply`（実削除、`CONFIRM_AI_USAGE_CLEANUP=yes`
  必須）。自動cronが失敗・スキップした場合のフォールバックとして引き続き利用可能。
- [x] **異常利用時の確認場所**:
  1. [`/admin/ai`](https://loop-vocabulary.app/admin/ai) で本日の利用状況・無料/
     Premium上限接近ユーザー数・異常検知を確認
  2. Vercel Functions Logsで `[AI route]` / `[AI lookup]` / `[ai-suggest]` の
     プレフィックスを検索し、Anthropic API障害（レート制限・タイムアウト等）を確認
  3. 緊急停止手順: Vercelの環境変数 `ANTHROPIC_API_KEY` を一時的に空/無効値にして
     再デプロイすると、AI機能はクラッシュせずモック応答/503フォールバックになり、
     AIコストのみ即座に止められる（他機能は継続稼働）
  詳細: [PRODUCTION_MONITORING.md §13-3](PRODUCTION_MONITORING.md)。

**確認コマンド**: `npm run test:ai-usage-guards` / `npm run test:admin-ai-usage` /
`npm run test:ai-usage-events` / `npm run test:ai-usage-retention` /
`npm run test:ai-usage-cleanup-cron`

---

## 3. AdSense / 広告

- [x] **AdSense審査ステータス（2026-07-07オーナー再確認、審査待ち継続）**:
  `loop-vocabulary.app`のステータスは引き続き`Getting ready`。ads.txt: Authorized、
  Policy Center: No current issues、Auto ads: ON、Auto optimize: ON。
  **現時点で追加対応は不要。Readyになるまでは広告増設もしない方針を継続する**。
  次回確認時に見るべき項目は [ADSENSE_SETUP.md §2](ADSENSE_SETUP.md) 参照。
- [x] **`ads.txt`**: `public/ads.txt` に `google.com, pub-5148247638505100, DIRECT,
  f08c47fec0942fa0` を公開済み。`layout.tsx` のPublisher IDと一致（矛盾なし）。
- [x] **dashboard手動広告**: `/dashboard` の1ページのみに広告ユニット
  「Loop Vocabulary Display Banner」を配置済み（2026-07-04投入）。他8ページ
  （`materials`/`materials/[id]`/`review`/`road`/`settings`/`stats`/`weak`/
  `wordbooks/[id]`/`learn`）は審査段階を考慮しあえて配置していない。拡大方針・
  順番は [ADSENSE_SETUP.md §4-3](ADSENSE_SETUP.md) 参照（各ページ追加ごとに
  オーナー承認を得てから実施する方針）。
- [x] **Premiumユーザー広告非表示**: `/dashboard` の `BannerAdPlaceholder` は
  `{!isPremium && (...)}` でラップ済み（2026-07-05修正、以前は`isPremium`ガード
  無しで表示されていたバグを解消）。`npm run verify:prod` の
  「Premium ad-hide guard (source check)」で毎回自動確認している。
- [x] **学習中画面に広告を入れない方針**: `/test/*` 各モード・`/review`実行中・
  タイムアタック・入力フォーム周辺には広告を配置していない（実装・方針とも維持）。
  今後他ページへ拡大する場合も、この方針（学習操作を妨げるページには追加しない）を
  継続する前提。
- [ ] **⚠️ AdSense Ready後に確認すること**（審査通過後、初回のみ）:
  - [ ] AdSense管理画面「広告」→「サマリー」で表示回数・クリック率・推定収益が
    出始めているか
  - [ ] Auto Ads（自動広告、ONのまま）が学習体験を妨げるページに勝手に挿入されて
    いないか（手動配置は`/dashboard`のみだが、Auto Ads自体はアプリ側から制御できない）
  - [ ] `/dashboard`以外への展開を進める場合は、[ADSENSE_SETUP.md §4-3](ADSENSE_SETUP.md)
    の順番・オーナー承認プロセスに従う（一括で全ページに追加しない）

**確認コマンド**: `npm run verify:prod`（広告関連はPremiumガードのソース確認のみ、
AdSense自体の審査状況はコマンドでは分からずAdSense管理画面での確認が必須）

---

## 4. 法務・信頼ページ

- [x] **`/terms`**: 実際のStripe課金内容（価格・解約方法・返金方針）を反映済み
  （2026-07-06、以前は「将来的に導入予定」という古い記載のままだった不具合を修正）。
- [x] **`/privacy`**: Stripe・Anthropicの第三者サービス利用、Web版AdSense
  （Cookie・オプトアウト手段）、AI利用状況メタデータの保存内容・90日保持・
  アカウント削除時の即時カスケード削除、アカウント削除がPremium解約を自動化しない
  旨の注意書きを記載済み。
- [x] **`/contact`**: 実装済み（お問い合わせフォーム・メールリンク）。
- [x] **`/faq`**: 実装済み。
- [x] **`/legal/commercial-transaction`（特定商取引法表記に相当するページ）**:
  **現状はドラフト・非公開**。以下の状態を維持している。
  - `metadata.robots = { index: false, follow: false }` によりnoindex
  - `public/robots.txt` に `Disallow: /legal`
  - ページ上部に「準備中（社内確認用ドラフト）」の警告バナーを表示
  - `/premium` ・ `/contact` ・ `/faq` ・トップページのfooterのいずれからも
    リンクしていない
  - 価格・支払方法・解約方法は `/terms` と整合する確定情報を記載済みだが、
    **販売事業者名・運営責任者名・所在地・電話番号はプレースホルダーのまま**
    （実在するような値には置き換えていない）
- [ ] **⚠️ オーナー情報待ち**: 上記の運営者情報（事業者名・所在地・電話番号）が
  無いと `/legal/commercial-transaction` を公開できない。個人情報を推測・捏造
  しない方針のため、情報提供を待っている状態。

### footer公開前に必要な作業（運営者情報が揃った後）

`/legal/commercial-transaction` を公開する際は、以下を順に実施する
（詳細手順: [PRODUCTION_MONITORING.md §12-5](PRODUCTION_MONITORING.md)）。

- [ ] プレースホルダーを実際の運営者情報に置き換える
- [ ] ページ上部の「準備中」警告バナーを削除する
- [ ] `metadata.robots` を通常の索引可能設定に戻す（または明示的に削除する）
- [ ] footerに `/legal/commercial-transaction` へのリンクを追加する
- [ ] `robots.txt` の `Disallow: /legal` を削除する
- [ ] `test:legal-trust-pages` のステップ9のアサーション（プレースホルダー存在・
  非リンク前提）を実態に合わせて更新する

> **注意（法律判断について）**: 特定商取引法上、どこまでの情報開示が必須か・
> 個人事業主の場合の代替開示（住所非公開等）が可能かどうかは、本ドキュメントでは
> 断定しません。実際の公開前に、必要であれば専門家（行政書士・弁護士等）に
> 確認することを推奨します。

**確認コマンド**: `npm run test:legal-trust-pages`

---

## 5. cron / scheduled jobs

現在 `vercel.json` に登録されているVercel Cronは以下の3件。

| path | schedule | 認証方式 | 用途 |
|---|---|---|---|
| `/api/cron/daily-push` | `0 0 * * *`（毎日 00:00 UTC） | `CRON_SECRET`（未設定時は無防備実行） | 復習due件数がある未読ユーザーへのWeb Push通知 |
| `/api/cron/weekly-digest` | `0 22 * * 0`（毎週日曜 22:00 UTC） | `CRON_SECRET`（未設定時は無防備実行） | 週次学習レポートメール送信（Resend経由） |
| `/api/admin/cleanup/ai-usage-events` | `0 19 1 * *`（毎月1日 19:00 UTC） | `CRON_SECRET`（**未設定時は503で拒否**、削除操作のため既存2件より厳格） | `ai_usage_events`の90日超過ログ削除（2026-07-07新設） |

- [x] `daily-push` / `weekly-digest` は既存のcron。認証は`CRON_SECRET`が設定されて
  いれば`Authorization: Bearer $CRON_SECRET`を検証、未設定なら検証をスキップして
  実行する設計（通知・メール送信という性質上、既存の挙動を維持）。
- [x] AIログcleanup cronは削除操作のため、上記2件より厳格に「`CRON_SECRET`が
  無ければ絶対に実行しない」設計にしている。
- [x] **オーナー確認済み（2026-07-07）**: Vercel Dashboard → プロジェクト →
  「Cron Jobs」設定で以下をすべて確認済み。
  - [x] `/api/admin/cleanup/ai-usage-events` がCron Jobsに登録されている
  - [x] 既存cronと合わせて合計3件、上限エラーは出ていない
  - [x] scheduleが月1回（`0 19 1 * *`）になっている
  - [x] 対象endpointがProduction環境で有効になっている（Cron Jobs機能トグルもEnabled）

### cron失敗時の手動対応

- **daily-push / weekly-digest が失敗した場合**: 通知・メールが送られないだけで
  データは壊れない。Vercel Functions Logsでエラー内容を確認し、必要なら手動で
  該当スクリプトのロジックを個別に叩いて原因を切り分ける（現状、手動再実行専用の
  npm scriptは無いため、ロジックの再現はコードを読んで判断する）。
- **AIログcleanup cronが失敗・スキップした場合**: `npm run cleanup:ai-usage-events`
  （dry-run）で現状を確認し、問題なければ
  `CONFIRM_AI_USAGE_CLEANUP=yes npm run cleanup:ai-usage-events:apply` で手動削除する。

**確認コマンド**: `npm run test:ai-usage-cleanup-cron`（cronエンドポイント自体の
認証・削除ロジックの検証。Vercel側の登録有無・上限はコマンドでは確認できず
Vercel Dashboardでの確認が必須）

---

## 6. 管理画面

- [x] **`/admin`**: 管理画面トップ。`/admin/stats`（統計ダッシュボード）・
  `/admin/srs`（SRS V2モニタリング）・`/admin/ai`（AI利用状況モニタリング）・
  `/admin/materials`（教材管理）・`/admin/import`（単語データインポート）・
  `/admin/seed-vocab`（大規模データ投入）への入口。
- [x] **`/admin/srs`**: SRS V2の`ease_factor`/`interval_days`分布・復習予定件数・
  異常値検知を読み取り専用で表示。詳細: [PRODUCTION_MONITORING.md §3](PRODUCTION_MONITORING.md)。
- [x] **`/admin/ai`**: AI利用状況モニタリング（本セクション2参照）。
- [x] **admin権限**: `requireAdmin()`（`profiles.is_admin`をサーバー側で確認）で
  全`/admin/*`配下を保護。非adminは`/dashboard`へ、未ログインは`/login`へ
  リダイレクト。`npm run test:admin` / `npm run test:admin-ai-usage` で検証済み。
- [x] **個人情報を出さない設計**: `/admin/srs` ・ `/admin/ai` とも、メールアドレス・
  display_name・個別の単語/AI入力内容は一切取得・表示しない（集計値のみ）。
  `test:admin-ai-usage` でメールアドレス様文字列(`@`)・`user_id`ラベルが
  ページ本文に含まれないことを自動検証している。
- [x] **test account除外**: `is_test_account=true`のプロフィールは`/admin/ai`の
  全集計から自動除外される（E2E実行によるダッシュボード数値の汚染を防止）。

**確認コマンド**: `npm run test:admin` / `npm run test:admin-ai-usage`

---

## 7. SEO / Search Console

- [x] **`/materials/toeic`** ・ **`/materials/business`** ・ **`/materials/news`**:
  いずれも実装・sitemap登録・canonical設定済み。3LPとも
  `npm run verify:seo-lp-audit`（sitemap包含・robots非ブロック・canonical・
  JSON-LDの妥当性）で本番デプロイ後に自動検証している。
- [x] **Search Console indexing request済み**: 3URLとも、オーナーがURL検査ツールで
  ライブURLテストを実施し、noindex・robots.txtブロック・canonicalの問題は無いことを
  確認済み。インデックス登録リクエストも実施済み（2026-07-05）。
  詳細: [SEARCH_CONSOLE_SETUP.md §0-1](SEARCH_CONSOLE_SETUP.md)。
- [x] **`/materials/toeic`: インデックス登録済み（2026-07-07オーナー確認）**。
  Page is indexed、最終クロール 7/5 10:17 AM、crawl allowed: Yes、
  indexing allowed: Yes、canonicalは自己参照で一致。検索パフォーマンスの
  表示回数・クリック数はまだ0件（今後の定点観測対象）。
- [ ] **⚠️ 1〜2週間ほど様子見: `/materials/business` ・ `/materials/news`**
  （2026-07-07オーナー確認、いずれも未検出）。両URLとも「URL is unknown to
  Google」でクロール未実施の状態だが、noindex・robots.txtブロック・canonical
  エラーは該当なし（技術的な問題は無い）。1〜2週間ほど様子見し、それでも
  未検出なら「ページ」タブ・URL検査ツールで再確認する。
- [x] **sitemap / robots / canonical**: 2026-07-01の登録前チェックで、認証必須ページの
  sitemap混入・robots.txtの不整合（`/test/`末尾スラッシュ問題等）を発見・修正済み。
  以降、新規ルート追加時は`verify:seo-lp-audit`・`test:legal-trust-pages`等で
  継続的にチェックしている。

**確認コマンド**: `npm run verify:seo-lp-audit`

---

## 8. 緊急時チェック

トラブルが発生したら、まずこの表で「見る場所」を確認してください。詳細な調査手順は
それぞれのリンク先を参照してください。

| トラブル | まず見る場所 | 詳細手順 |
|---|---|---|
| **支払い済みなのにPremiumにならない** | ① Stripe Dashboard → 該当顧客のPayments/Subscriptionsで決済成功を確認 ② Developers → Webhooksの配信ログで`checkout.session.completed`が200か確認 ③ Vercel Runtime Logs（`routes=/api/stripe/webhook`）でエラー確認 ④ `npm run verify:prod`でPremiumスキーマ列の存在を再確認 | [PRODUCTION_MONITORING.md §11-1](PRODUCTION_MONITORING.md) |
| **AIコストが急増した** | ① [`/admin/ai`](https://loop-vocabulary.app/admin/ai)で本日の利用回数・route別内訳・異常検知を確認 ② 緊急停止: Vercelの`ANTHROPIC_API_KEY`を一時的に空/無効値にして再デプロイ（AI機能はクラッシュせずフォールバックし、コストのみ即座に止まる） | [PRODUCTION_MONITORING.md §13-3](PRODUCTION_MONITORING.md) |
| **AdSenseで警告が出た** | AdSense管理画面「ポリシーセンター」で警告文言を確認し、該当箇所を調査（[ADSENSE_SETUP.md §2-3](ADSENSE_SETUP.md)の見るべき項目に沿って切り分け） | [ADSENSE_SETUP.md §2](ADSENSE_SETUP.md) |
| **cronが失敗した** | Vercel Dashboard → Deployments → Functions（または`get_runtime_errors`相当）で該当cron pathのエラーログを確認。AIログcleanup cronなら`npm run cleanup:ai-usage-events`で状況を手動確認し、必要なら`:apply`で手動削除 | 本書「5. cron / scheduled jobs」 |
| **AIログcleanupが動いていない** | `npm run cleanup:ai-usage-events`（dry-run）で現在の総行数・削除対象件数を確認。90日超過分が溜まっていれば`CONFIRM_AI_USAGE_CLEANUP=yes npm run cleanup:ai-usage-events:apply`で手動削除。Vercel Cronの登録状況もあわせて確認 | [PRODUCTION_MONITORING.md §13-7〜§13-8](PRODUCTION_MONITORING.md) |
| **Premiumユーザーなのに広告が出る** | `npm run verify:prod`で`dashboard/page.tsx`の`BannerAdPlaceholder`が`isPremium`ガードされているかソース確認。ガードが外れていたら緊急修正が必要（過去に一度、実際にこの不具合が発生し修正済み） | [PRODUCTION_MONITORING.md §11-4](PRODUCTION_MONITORING.md) |
| **Webhook署名エラーが出る** | Stripe Dashboard → Developers → Webhooksの配信ログで400が続いていないか確認。続く場合は、そのendpointのsigning secretとVercel Productionの`STRIPE_WEBHOOK_SECRET`が一致していない可能性が高い（過去に重複endpoint問題で発生した原因と同種）。有効なendpointが1本だけかも確認 | [PRODUCTION_MONITORING.md §11-2・§11-5](PRODUCTION_MONITORING.md) |
| **特商法ページ公開前に問い合わせが来た** | `/legal/commercial-transaction`は現状noindex・非公開ドラフトのため、通常の導線からは到達できないはず。問い合わせ内容が特商法表記そのものを求めるものであれば、`/terms`・`/faq`に記載済みの価格・解約方法・返金方針を案内し、運営者情報（事業者名・所在地・電話番号）については社内確認中である旨を案内する（個人情報を推測・仮の値で回答しない） | 本書「4. 法務・信頼ページ」 |

---

## まとめ: ⚠️ オーナー確認待ちの項目一覧

**2026-07-07更新**: Vercel Cron・AdSense審査状況・Search Consoleの3項目はオーナーが
確認済み（完了、または「審査待ち継続」として現状追加対応不要と判明）。以下は
引き続き残っている項目。

- [x] ~~Vercel Cron Jobs設定で3件目（AIログcleanup）が正しく登録され上限エラーが
  出ていないか~~ → **2026-07-07確認済み、完了**（登録あり・schedule月1回・合計3件・
  上限エラーなし・Production有効）
- [x] ~~AdSense審査ステータスの最新値確認~~ → **2026-07-07確認済み**。`Getting ready`の
  まま審査待ち継続。現時点で追加対応不要、Readyになるまで広告増設もしない
- [x] ~~Search Consoleでの3カテゴリLPインデックス登録状況~~ →
  **2026-07-07確認済み**。`/materials/toeic`はインデックス登録済み。
  `/materials/business`・`/materials/news`は未検出のため、以下に持ち越し
- [ ] Stripe Webhook endpointが1本だけ有効になっているかの定期確認
- [ ] 初回実課金時の実データ確認（Stripe Dashboard・`profiles`・`/premium`表示）
- [ ] 無効化済みStripe重複Webhook endpointの削除要否判断（方針は確定済み:
  当面は削除せず様子見、正規endpointでの初回実課金確認後に判断）
- [ ] `/legal/commercial-transaction`公開に必要な運営者情報（販売事業者名・
  運営責任者名・所在地・電話番号・メールアドレス・住所/電話番号の公開方針・
  footer公開タイミング）の提供、および公開時の法律要件確認（専門家判断が必要な場合）
- [ ] `/materials/business`・`/materials/news`のインデックス状況を1〜2週間後に再確認
  （2026-07-07時点で未検出、技術的エラーは該当なし）
- [ ] AdSense Ready後の初回確認（広告配信・Auto Adsの挙動。審査待ち継続中は該当なし）

---

## 関連ドキュメント

- [PRODUCTION_MONITORING.md](PRODUCTION_MONITORING.md) — 日次/週次監視・異常時の
  詳細な調査手順・自動検証コマンド一覧
- [ADSENSE_SETUP.md](ADSENSE_SETUP.md) — AdSense審査状況・広告実装の詳細
- [SEARCH_CONSOLE_SETUP.md](SEARCH_CONSOLE_SETUP.md) — Search Console登録・週次の見方
- [NEXT_IMPROVEMENTS.md](NEXT_IMPROVEMENTS.md) — 優先順位付きの次の改善候補・残課題
- [WORK_HISTORY.md](WORK_HISTORY.md) — 時系列の作業ログ
