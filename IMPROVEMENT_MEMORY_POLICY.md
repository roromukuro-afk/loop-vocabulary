# Improvement Memory ポリシー

`improvement_memory`テーブル(Phase 12)は、完了した改善案件(`improvement_issues.status`が`successful`/`failed`/`rolled_back`になった時点)の記録を、個々のissue/taskのライフサイクルを超えて長期保持する。

## 保存内容

problem_summary / hypothesis_summary / change_summary / pr_url / deployed_at / metric_before / metric_after / sample_size / result / side_effects / success_reason / failure_reason / reattempt_allowed / next_recommendation / pattern_key

## 「同じ失敗施策を繰り返し提案しない」仕組み

新しいissueを検出する際(`src/lib/improvement/analyzers/*.ts`共通のヘルパー`checkMemory()`)、生成しようとしている`dedup_key`と同じ`pattern_key`を持つ`improvement_memory`行を検索する。該当する行があり、かつ`result='failure'`かつ`reattempt_allowed=false`の場合:

- issue自体は作成する(問題そのものは依然として実在するため観測は止めない)が、
- `evidence`に過去の失敗記録(いつ・何を試して・なぜ失敗したか)を含め、
- `implementation_type`を自動的に`investigation_only`に格下げし、
- `proposed_solution`は「前回と同じ方向性の案は自動生成しない。過去の失敗理由: {failure_reason}」という注記を含める。

`reattempt_allowed=true`の場合(例: 前回はサンプル不足で`inconclusive`だっただけ)は通常どおり提案を作ってよい。

## サンプルサイズ不足時の扱い

`result='inconclusive'`は「失敗」として扱わない。`next_recommendation`に「あとN件のサンプルが必要」等を記録し、将来同じ施策が再提案された際にその文脈を引き継げるようにする。

## 効果測定の確定は人間操作

`measuring` → `successful`/`failed`/`rolled_back`の確定(`improvement_memory`への書き込みトリガー)は、`/admin/improvements`の「accept result」操作からのみ行う。自動的に統計的有意差だけで確定させない(既存Growth OSの`AUTONOMOUS_IMPROVEMENT_POLICY.md`が定める「最低サンプル数・最低実施期間を満たさない状態での採用判定は例外なく自動実行禁止」という原則を、この改善ループでも踏襲する)。
