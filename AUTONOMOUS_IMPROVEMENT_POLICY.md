# 自律改善の安全ルール（Growth OS Phase 10）

Growth OSが自律的に実行してよい範囲と、必ず人間の承認を要する範囲、および絶対に自動実行してはいけない範囲を明示する。すべてのGrowth OS関連コード（cron job・管理画面・改善案生成ロジック）はこのポリシーに従うこと。

## 自動実行してよいもの

- `analytics_events`の集計（日次/週次rollup cron）
- ルールベースの異常検知（`growth_alerts` / `growth_insights`への書き込み）
- 週次レポート作成（`growth_weekly_reports`への書き込み）
- 改善案の作成（`growth_recommendations`への書き込み、ステータスは常に`proposed`から開始）
- 実験の**draft**作成（`experiments`テーブルへのINSERT、ステータスは常に`draft`）
- 統計的な勝敗判定の**計算**（結果を`experiments.winner_variant_id`等に記録することは可。ただし本番反映は別）
- 実験の停止推奨・ロールバック推奨（推奨をレコードとして残すことは可。実際の停止操作の実行は人間承認後）

## 人間の承認が必要なもの

- A/Bテストの開始（`experiments.status`を`draft`→`approved`→`running`に変更する操作。`approved_by`/`approved_at`を必ず記録する）
- 勝者バリアントの本番反映（コード・コンテンツの変更）
- UI変更全般
- オンボーディングフローの変更
- 通知の追加
- SEOページの公開
- noindex設定の変更
- 広告配置の変更

## 自動実行を禁止するもの（例外なし）

- Stripe価格の変更
- Premium機能の削減
- 課金処理ロジックの変更
- AdSense広告位置の変更
- ユーザーの削除
- 個人情報の外部送信・利用
- メールの自動送信
- 大量SEOページの公開
- 学習アルゴリズム（SRS）の無断変更
- 実験データ不足時の勝者決定（最低サンプル数・最低実施期間を満たさない状態での「採用」判定）

## 実装上の担保

- `growth_insights` / `growth_recommendations`は`human_approved boolean default false`を持ち、UIで管理者が明示的にチェックするまでfalseのまま。
- `experiments.status`は`draft`→`approved`（`approved_by`必須）→`running`という遷移をアプリケーションコード側で強制し、`draft`から直接`running`にはできない。
- 統計判定ロジックは、`experiments.min_sample_per_variant`（既定200）と`min_duration_days`（既定7日）を満たさない実験に対しては勝者を返さず、常に「判定保留」を返す。
- `GROWTH_INSIGHTS_AI_ENABLED`環境変数は既定`false`。AI要約機能はこのフラグがtrueかつ管理者向け画面でのみ動作し、送信するのは集計値のみ（個人情報を一切含まない）。AIを使わなくても`growth_insights`/`growth_recommendations`はルールベースで生成できる設計とする。
- Stripe価格・`public/ads.txt`・AdSense publisher ID・学習画面への広告追加・特商法ページは、Growth OS関連のコードから一切変更しない（このラウンドでも変更していない）。
