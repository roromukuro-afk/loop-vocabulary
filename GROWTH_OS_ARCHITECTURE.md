# Growth OS アーキテクチャ（Phase 0: 既存基盤の棚卸し）

作成日: 2026-07-12。目的: 計測→集計→分析→改善案→A/Bテスト→効果判定のサイクルを回すための基盤設計。

## 1. 既存の分析・課金基盤（棚卸し結果）

| 領域 | 現状 |
|---|---|
| GA4 | `src/app/layout.tsx`で`NEXT_PUBLIC_GA_ID`設定時のみ`gtag.js`を読み込み。`src/lib/analytics/events.ts`に約45個の`track*()`関数（vocab-check・dictionary・guide・PDF・課金意図等）。**クライアント発火のみ、サーバー側に永続化されない**。 |
| Microsoft Clarity | `NEXT_PUBLIC_CLARITY_ID`設定時のみ読み込み。セッション録画・ヒートマップ。API取得不可（管理画面のみ）。 |
| `daily_stats` | 既存テーブル(`user_id, day, studied_count, correct_count, wrong_count`)。26行。`/admin/stats`が参照。**ユーザー単位の日次学習量のみ**、ファネル・集客・課金は含まない。 |
| `study_sessions` / `study_results` | `study_sessions`(0行、未使用の可能性)、`study_results`(1031行、`session_id, user_id, word_id, is_correct, answered_at`の正誤ログ)。 |
| `ai_usage_events` | 585行。route別のメタデータのみ(`user_id, route, is_premium, status, quota_source, error_type, input_size, output_size, duration_ms`)。**プロンプト本文・レスポンスは保存しない設計が既に徹底されている**（コメント欄に明記）。service_role専用、RLS有効・ポリシー無し。 |
| `ai_usage_logs` | 118行。`user_id, kind, prompt, result, used_at`。**こちらは旧テーブルでプロンプト本文を保存する設計**（`ai_usage_events`より前に作られた形跡）。Growth OSでは**この表は使わない**（個人の入力内容を含むため）。 |
| `pdf_exports` | 4行。`user_id, word_book_id, material_id, config(jsonb), created_at`。PDF生成ログとして既存。 |
| Stripe webhook | `src/app/api/stripe/webhook/route.ts`。`checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted` / `invoice.payment_failed`を処理し`profiles.is_premium` / `stripe_customer_id` / `premium_expires_at`を更新。**課金状態の正はStripe webhook経由のDB更新であり、これは変更しない**。 |
| Premium契約状態 | `profiles.is_premium`(boolean) / `profiles.premium_expires_at`。プラン種別(月額/年額)は`profiles`に列がなく、Stripeのsubscription/price側にのみ存在（webhookのmetadata経由でしか分からない）。**Growth OS収益指標はStripe webhookイベントを正として集計する**。 |
| AI利用ログ | 上記`ai_usage_events`。`profiles.daily_ai_used` / `daily_ai_reset_at`で日次クォータを管理。 |
| SRS学習履歴 | `words.mastery` / `words.is_weak`（現状値）、`study_results`（時系列の正誤）。 |
| 辞書検索履歴 | 永続化なし。GA4イベント(`dictionary_search_executed`等)のみ、検索語自体はGA4にも送っていない（既存実装を確認済み）。 |
| Vercel Cron | `vercel.json`に3件登録済み: `daily-push`(毎日0時UTC)・`weekly-digest`(毎週日22時UTC)・`admin/cleanup/ai-usage-events`(毎月1日19時UTC)。Growth OS用crontを追加する余地あり。 |
| 管理者権限 | `src/lib/supabase/requireUser.ts`の`requireAdmin()`。`profiles.is_admin`をチェックし、非管理者は`/dashboard`へリダイレクト。既存の`/admin/*`配下すべてがこれを使用。**Growth OSもこの既存関数をそのまま再利用する**。 |
| 既存admin画面 | `/admin`(トップ)・`/admin/stats`(現状の簡易ダッシュボード。DAU・学習量・アクティベーションファネルの一部を既に表示)・`/admin/ai`・`/admin/materials`・`/admin/import`・`/admin/srs`・`/admin/seed*`。 |
| `profiles.is_test_account` | 既存列。**Growth OSの集計は原則この列がtrueのアカウントを除外する**（既存の`test:setup`用シードアカウントが指標を汚染しないようにするため）。 |

## 2. 現在取得できているデータ

- ユーザー単位の日次学習量・正誤数(`daily_stats`)
- 個別の正誤ログ(`study_results`)
- AI利用のメタデータ(`ai_usage_events`)
- PDF生成ログ(`pdf_exports`)
- Premium契約状態の現在値(`profiles.is_premium`等)
- GA4上のクライアントサイドイベント（ただしSupabase側には永続化されない、ユーザー単位の継続率分析に使えない）

## 3. 現在取得できていないデータ（Growth OSで新設する）

- ファーストパーティ（サーバー永続化）のユーザー行動イベント全般
- 匿名セッション単位のトラフィック源（organic/social/AI検索/PDF QR等）
- コンテンツ単位（guide/material/dictionary/tool）のビュー→コンバージョン
- 登録日基準のコホート継続率
- 日次MRR・解約率などの収益系時系列
- A/Bテストの割り当て・露出・コンバージョン
- ルールベースの異常検知結果・改善案

## 4. GA4で測るもの（変更なし・継続利用）

匿名・集計的なトラフィック分析、ページビュー、既存の`track*()`イベント群。**個人を特定できる情報は送らない方針を継続**。

## 5. Supabaseで測るもの（新設）

Phase 1〜9で新設する`analytics_events`ほか15テーブル（詳細は本ラウンドの各Phaseドキュメント参照）。ユーザー単位の継続率・ファネル・実験など、GA4だけでは困難な分析はすべてこちら。

## 6. Stripeから取得するもの

Webhookイベント(`checkout.session.completed`等)をトリガーに、`analytics_events`へ`checkout_completed` / `subscription_started`等のサーバー確定イベントを記録する。**ブラウザ側の`checkout_started`はUI操作の記録として補助的に使うが、実際に契約が成立したかどうかはWebhook側を正とする**。

## 7. AdSense通過後に取得するもの

AdSense公式管理画面・APIから取得できる集計値（ページビュー・表示回数・page RPM等）のみ。**広告クリックの独自追跡は行わない**（Phase 8で詳述）。

## 8. 個人情報として保存しないもの

メールアドレス・氏名・単語帳名・ユーザーの自由記述・検索語の生データ・学校名・生徒名・IPアドレス・AIへの入力/出力本文。詳細は`ANALYTICS_PRIVACY_POLICY.md`参照。

## 9. データ保持期間

- `analytics_events`（生イベント）: 90日を目安（Phase 3で詳述、実削除は次回以降の運用判断）
- `analytics_daily_*`（日次集計）: 長期保存（個人を特定できる情報を含まないため）
- `ai_usage_logs`（旧・プロンプト本文保存テーブル）: Growth OSの対象外。既存の保持期間ポリシーをそのまま維持

## 10. 管理者だけが閲覧できる情報

`analytics_events`の生データ、`/admin/growth`配下の全画面、`growth_insights` / `growth_alerts` / `growth_recommendations` / `experiments`系テーブル、`growth_weekly_reports`。いずれも`requireAdmin()`によるページ保護 + RLSによるDB層保護の二重防御とする。
