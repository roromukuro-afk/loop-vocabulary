# 指標定義辞書（Growth OS Phase 2）

すべての指標はJST（日本時間）の暦日/暦週を基準に計算する。`profiles.is_test_account = true` のアカウントは全指標から除外する。

## North Star Metric

**`weekly_activated_learners`（週間アクティベート学習者数）**

対象週（JST月曜始まり）に以下すべてを満たすユーザー数:
1. 累計で10語以上を単語帳に追加、または学習済み（`words`テーブルの当該ユーザー行数 >= 10）
2. 初回テスト完了（`first_test_completed`イベント、または`study_results`に該当ユーザーの行が存在）
3. 初回とは別セッションで復習完了（`first_review_completed`イベント、`study_session_started`のmode="review"が初回追加日の翌日以降に存在）
4. 対象週に何らかの学習アクティビティがある（`daily_stats`の当該週内`studied_count > 0`）

条件1〜3は「初めて満たした週」ではなく「その週の時点で満たしている」ことを見る累積条件、条件4のみ当該週限定。

## Activationの計算方法

`signup_completed` → `first_word_added` → `five_words_added` → `ten_words_added` → `first_test_completed` → `first_review_completed` → `activation_completed` の順で発火するイベントのタイムスタンプを`analytics_events`から取得し、登録から各イベントまでの経過時間・到達率を計算する。`activation_completed` = 上記North Star判定条件1〜3を満たした瞬間に1回だけ発火。

## Retentionの計算方法

登録日（`profiles.created_at`のJST日付）が属するJST週を「コホート週」とする。コホート週ごとに、コホート内ユーザーが登録日から D1/D3/D7/D14/D30 日後（JST日付基準）に `daily_stats.studied_count > 0` の行を持つかどうかで継続を判定する。`analytics_retention_cohorts`に `(cohort_week, day_offset)` 単位で `cohort_size`（そのコホートの総人数）と `retained_count`（該当日に活動があった人数）を保存し、継続率は `retained_count / cohort_size` として都度算出する（率そのものは保存しない。母数の変化を追えるようにするため）。

Week 1 / Week 4 retention は day_offset=7 / day_offset=28 として同じ仕組みで計算する。

## 収益指標

- **MRR**: `profiles.is_premium = true` のユーザーについて、月額契約は480円、年額契約は3800円/12ヶ月として月換算した合計。プラン種別はStripe webhookの`metadata.plan`をイベント記録時に保存し、`analytics_events`の`checkout_completed`/`subscription_started`イベントの`properties.plan`から日次集計時に算出する。
- **ARR**: MRR × 12。
- **新規契約数/解約数**: `subscription_started`/`subscription_cancelled`イベントのその日の件数（Stripe webhook発火分のみを正とする）。
- **解約率**: 当日解約数 / 当日時点のアクティブ契約数。
- **再開率**: `subscription_reactivated`件数 / 過去30日以内の解約数。
- **free→Premium率**: 当日`checkout_completed`ユーザー数 / 当日までの累計非Premiumアクティブユーザー数。
- **Premiumページ→checkout率**: 当日`checkout_started`件数 / 当日`premium_page_viewed`件数。
- **checkout→契約率**: 当日`checkout_completed`件数 / 当日`checkout_started`件数。
- **月額/年額の構成比**: `subscription_started`イベントの`properties.plan`集計。
- **1人当たりAIコスト**: `ai_usage_events`の`input_size`/`output_size`からトークン数を概算し、Claude APIの単価表（`AI_COST_ASSUMPTIONS.md`等、未整備の場合は概算値である旨を明記）で概算コストを算出。**実際の請求額と一致する保証はない試算値**。
- **1人当たり推定粗利益**: (プラン単価 − 1人当たりAIコスト概算) の月次平均。
- **LTVの暫定値**: 平均月次単価 × (1 / 月次解約率の逆数として求めた平均継続月数)。データが少ない間は「暫定値・参考値」であることを表示上も明示する。

## ファネル定義

`LP・記事・辞書到達 → ツール利用開始 → ツール完了 → 登録CTAクリック → 登録完了 → 最初の単語追加 → 初回テスト完了 → 初回復習完了 → 7日後継続 → Premium表示 → checkout → 契約`

各ステップはユーザー単位（ログイン後）または匿名セッション単位（登録前）でカウントし、`analytics_daily_funnels`に`funnel_key='main'`、`step_key`にステップ名、`step_order`に順序を保存する。

## AdSense関連指標（AdSense通過後のみ）

対象ページビュー・広告表示回数・page RPM・session RPMは、AdSense公式管理画面/APIから取得できる集計値をそのまま記録する。独自クリック追跡は行わない。
