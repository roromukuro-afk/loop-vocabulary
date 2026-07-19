# 自律レベルポリシー

各機能領域(`improvement_issues.category` / `improvement_tasks.autonomy_level`)は0〜5のレベルを持つ。**Level 4・5は今回のシステムでは実装しない**(`improvement_tasks`テーブルの`improvement_tasks_autonomy_ceiling` CHECK制約で`autonomy_level <= 3`を強制しており、DBレベルでもLevel 4/5のタスクは作成できない)。

| Level | 意味 | このシステムでの動作 |
|---|---|---|
| 0 | 監視のみ | analyzerはデータを読むが、issueすら作らない |
| 1 | 課題検出・レポート | `improvement_issues`は作るが`approval_required=true`かつ`implementation_type='investigation_only'`、実装計画は作らない |
| 2 | 改善案・Issue作成 | `improvement_issues` + `improvement_hypotheses` + `improvement_tasks`(status='planned')まで作る。実装は人間承認を待つ |
| 3 | ブランチ・コード修正・Draft PR | 人間が`improvement_tasks.status='approved'`にした後、`engineering-agent.mjs`がbranch作成〜Draft PR作成まで実行する。**mergeはしない** |
| 4 | 承認後の自動merge/deploy | **未実装。実装禁止。** |
| 5 | 完全自動 | **未実装。実装禁止。** |

## カテゴリ別初期値

| カテゴリ | 初期autonomy_level |
|---|---|
| analytics | 2 |
| seo(監査・検出) | 2 |
| reliability | 3 |
| engineering(軽微なUI修正相当) | 3 |
| content(改稿提案) | 2 |
| revenue(価格変更を除く分析・訴求文言の提案まで) | 2 |
| acquisition | 2 |
| activation | 2 |
| retention | 2 |
| performance | 2 |
| privacy | 0 |
| legal | 0 |
| SRS関連(engineeringカテゴリだが対象ファイルで判定) | 1 |

`revenue`カテゴリは「Premium利用例・年額説明・AI/PDF価値説明・無料版との比較・onboarding改善・paywall表示タイミング」等の**訴求文言・UI提案まではLevel 2**で改善案作成まで進めるが、価格変更・機能削減・Stripe/checkout/Premium権限に触れる変更は`implementation_type='human_only'`に固定し、`autonomy_level`を問わず実装フェーズに進めない(`AUTONOMOUS_ENGINEERING_POLICY.md`の変更禁止パスに含まれるため、コード上も止まる)。

## レベル引き上げの手順(将来)

あるカテゴリのLevel 3の実績が一定数(目安: Draft PR作成→人間承認→mergeが5件以上、`changes_requested`率が20%未満)蓄積した場合にのみ、人間が`improvement_tasks`のデフォルト値を見直すことを検討してよい。**このシステム自体がレベルを自動で引き上げることはしない**(`autonomy_level`のUPDATEはadmin UIからの人間操作のみを許可するRLSポリシーに従う)。

## 自律レベルとstatusの対応

`improvement_issues.status`の`detected`〜`insufficient_data`という遷移そのものはLevelを問わず全カテゴリで発生する。Levelが効くのは「どこまで**人間の承認なしに次のstatusへ進めてよいか**」であり、以下の境界は常に人間承認を要求する(コードレベルでゲート):

- `proposal_ready` → `approved`(実装着手の承認): 必ず人間
- `draft_pr`のPRを実際に`merge`すること: 必ず人間(GitHub側の操作、このシステムからはできない)
- `measuring` → `successful`/`failed`の確定判定: 必ず人間(`accept result`操作)
