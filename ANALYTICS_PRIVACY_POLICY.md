# Growth OS プライバシー方針（内部向け）

`src/lib/analytics/eventSchema.ts`が技術的な強制力を持つ実装。本書はその設計方針の説明。

## GA4に送らないもの

ユーザーUUID、メールアドレス、氏名、単語帳名、ユーザーが入力した自由記述、検索履歴の生データ、学校名、生徒名。既存の`src/lib/analytics/events.ts`のGA4イベントもこの方針を維持しており、今回のGrowth OS実装で変更していない。

## Supabase内部分析での扱い

認証ユーザーUUID(`user_id`)は`analytics_events`に保存してよいが、管理者(`profiles.is_admin=true`)以外はRLSにより一切読めない（`analytics_events_admin_select`ポリシー、サービスロール書き込みのみ）。

## 辞書検索語の保存ルール

`dictionary_search`イベントの`query_normalized`プロパティに保存してよいのは:
- 正規化（小文字化・前後空白除去）された英単語のみ
- 最大200文字（`MAX_STRING_PROPERTY_LENGTH`で強制）

保存前に以下を破棄する（`normalizeSearchQuery()`を使用箇所で必ず通すこと）:
- メールアドレス形式（`@`を含む文字列）
- URL形式（`http`/`www.`で始まる、または`.`を複数含みTLDらしき形式）
- 日本語文字（ひらがな・カタカナ・漢字）を含む文字列（個人の自由記述である可能性が高いため）
- 20文字を超える単語（英単語としては非現実的に長く、自由記述の可能性が高い）

## Cookie

`lv_aid`（匿名セッションID、1年、SameSite=Lax、非httpOnly）を新設。ランダムなUUIDのみでPIIを含まない。既存の`/privacy`ページのCookie説明（アクセス解析目的）の範囲内。

## データ保持期間

`analytics_events`（生イベント）は90日を目安とする。日次集計テーブル（`analytics_daily_*`等）は個人を特定できる情報を含まないため長期保存可。実際の自動削除バッチは本ラウンドでは実装していない（次回以降、既存の`ai_usage_events`向け削除cron[`/api/admin/cleanup/ai-usage-events`]と同様のパターンで追加することを推奨）。
