# Improvement Issue スキーマ定義

`improvement_issues`テーブル(`supabase/migrations/019_improvement_system.sql`)の各フィールドの意味と、関連する`improvement_hypotheses` / `improvement_tasks` / `improvement_runs` / `improvement_reviews` / `improvement_memory`との関係を定義する。

## improvement_issues

| フィールド | 型 | 説明 |
|---|---|---|
| category | text (enum) | acquisition / activation / retention / revenue / seo / content / reliability / performance / privacy / legal / engineering / analytics |
| title | text | 一目で分かる短い題名 |
| problem | text | 何が起きているかの説明(人間が読む) |
| evidence | jsonb | 検出根拠となった生データ(クエリ結果・URL・エラーメッセージ等) |
| affected_users | integer | 影響を受けるユーザー数の推定(不明ならnull) |
| affected_urls | text[] | 影響を受けるURL一覧 |
| severity | text (enum) | low / medium / high / critical |
| confidence, reach, impact, effort, risk | numeric(0-1) | 優先度スコア算出の入力(下記) |
| priority_score | numeric | `src/lib/improvement/priorityScore.ts`の`computePriorityScore()`で算出 |
| source | text | 検出したanalyzer名(例: `seo_scanner`, `reliability_scanner`) |
| status | text (enum) | ライフサイクル。下記「statusの意味」参照 |
| proposed_solution | text | 改善案の要約(実装計画の詳細は`improvement_tasks`) |
| approval_required | boolean | 常にtrue運用(Level 4/5が無いため、実装着手には必ず人間承認が要る) |
| implementation_type | text (enum) | code_change / content_change / config_change / investigation_only / human_only |
| dedup_key | text | 重複排除キー。`category:source:正規化した対象識別子`の形式(例: `seo:duplicate_canonical:/materials/toeic`) |
| autonomy_level | smallint | このissueのカテゴリに対応する自律レベル(`AUTONOMY_LEVEL_POLICY.md`参照) |

### priority_score の算出式

```
priority_score = (reach * impact * confidence) / max(effort, 0.1) * (1 - risk * 0.5)
```

reach・impact・confidenceが高く、effortが低く、riskが低いほど優先度が上がる。riskは0.5掛けで「高リスクだが効果が大きい」ものを過度に減点しすぎないよう調整している(`src/lib/improvement/priorityScore.ts`)。severityが`critical`のissueは、このスコアに関わらず一覧の先頭に固定表示する(`/admin/improvements`側のソートロジック)。

### statusの意味

| status | 意味 | 次に人間がすること |
|---|---|---|
| detected | analyzerが検出した直後 | investigation承認 or reject |
| investigated | 原因仮説(hypotheses)まで作成済み | 実装提案の生成を待つ、または直接タスク化 |
| proposal_ready | improvement_tasksが'planned'で存在する | 実装承認 or reject or postpone or request more evidence |
| approved | 実装承認済み、engineering-agent起動待ち | (システム側の実行を待つ) |
| implementing | engineering-agent実行中 | 特になし(進捗はimprovement_runsで確認) |
| draft_pr | Draft PR作成済み | GitHubでレビュー |
| testing | PR上でCI実行中 | 結果待ち |
| ready_for_review | 品質ゲート通過、人間レビュー待ち | 承認 or changes_requested |
| deployed | merge・本番反映済み(人間が手動で"mark deployed") | 効果測定開始 |
| measuring | 効果測定期間中 | 十分なサンプルが溜まったらaccept result |
| successful / failed / rolled_back | 測定確定 | improvement_memoryに自動記録 |
| rejected | 却下 | (完了) |
| insufficient_data | データ不足で判断不能 | 追加データ収集を待つ |

## improvement_hypotheses

1つのissueに対し複数行作成してよい。`supporting_evidence`/`contradicting_evidence`は`[{ "source": "...", "detail": "..." }]`形式のjsonb配列。`confidence`が最も高い、かつ`contradicting_evidence`が無い仮説を優先して実装計画の起点にする。

## improvement_tasks

1つのissue(または1つのhypothesis)に対する具体的な実装計画。`required_tests`は`Phase 7`の品質ゲートロジック(`src/lib/improvement/qualityGate.ts`)がタスク種別から自動選択したテストコマンド名の配列。

## improvement_runs / improvement_reviews

`engineering-agent.mjs`の各ステップ(scan/investigate/implement/test/self_review/draft_pr/measure)の実行ログと、self_reviewステップの結果を構造化して保存する。

## improvement_memory

issue/taskが完了した後も残る長期記憶。`pattern_key`は`dedup_key`と同じ生成規則(`src/lib/improvement/dedupKey.ts`)を使い、将来同じパターンのissueが検出された際に「これは過去に`failure_reason`付きで失敗した施策と同じか」を照合する(`reattempt_allowed=false`なら新しいissueの`evidence`に警告として含める)。
