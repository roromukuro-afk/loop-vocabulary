# Loop Autonomous Improvement System — アーキテクチャ

Loop Vocabulary全体(集客・Activation・Retention・SEO・AEO・コンテンツ・課金・AI原価・エラー・UX・コード品質・テスト・デプロイ前検証)を一つの改善ループとして扱うための基盤。**Growth OS(2026-07-13構築)を土台として利用し、その上に「コード修正・PR・テスト実行」の層を追加する**。

## 基本ループ

```
観測 → 課題発見 → 原因分析 → 改善仮説 → 実装計画 → 自動コード修正 → 自動テスト
→ Draft PR → 人間承認 → 本番反映 → 効果測定 → 学習
```

このシステムは**「Draft PRまで自律、人間承認後に本番反映」**を実装する。mainへの直接push・本番への自動デプロイは、このシステムのどのコンポーネントからも実行できない(コードレベルで保証、後述)。

## 9つのサブシステムとその実体

| サブシステム | 実体 |
|---|---|
| 1. Growth Intelligence | 既存Growth OS(`src/lib/analytics/rollup.ts`, `analytics_*`テーブル)をそのまま利用 |
| 2. Product Quality Intelligence | `src/lib/improvement/analyzers/engineering.ts`(failing tests/TS error/dead code等の検出) |
| 3. SEO / Content Intelligence | `src/lib/improvement/analyzers/seo.ts` + `content.ts` |
| 4. Reliability Intelligence | `src/lib/improvement/analyzers/reliability.ts`(Vercel Runtime Logs/Errors API・Cron失敗・analytics ingestion失敗) |
| 5. Monetization Intelligence | `src/lib/improvement/analyzers/revenue.ts`(既存`analytics_revenue_daily`等を読むのみ。課金ロジックには一切触れない) |
| 6. Autonomous Engineering Agent | `scripts/improvement/engineering-agent.mjs` + `.github/workflows/improvement-agent.yml` |
| 7. Experimentation System | 既存Growth OSの実験基盤(`experiments`等)を効果測定フェーズで再利用 |
| 8. Improvement Memory | `improvement_memory`テーブル + `src/lib/improvement/memory.ts` |
| 9. Human Approval Gateway | `/admin/improvements`管理画面 |

## データフロー

```
[Vercel Cron: /api/cron/improvement-scan]
   ↓ 検出(analyzers/*.ts) — analytics_*, ai_usage_events, サイト自体へのHTTPチェック等を読む
[improvement_issues に検出結果をUPSERT(dedup_keyで重複排除)]
   ↓ 原因分析(検出と同じcron内、または別途investigate系analyzer)
[improvement_hypotheses に原因候補を複数保存]
   ↓ 人間が /admin/improvements で承認(investigation → implementation)
[improvement_tasks: 実装計画をAIが作成、status='planned']
   ↓ 人間が implementation を承認 → status='approved'
[人間 or GitHub Actions(workflow_dispatch)が engineering-agent.mjs を起動]
   ↓ branch作成 → コード調査 → 修正 → migration作成(あれば) → テスト追加 →
     lint/typecheck/build → E2E実行 → 自己レビュー(improvement_reviews)
   ↓ 全て通過したら gh pr create --draft
[improvement_tasks.status='draft_pr', pr_url保存]
   ↓ 人間がGitHub上でPRをレビュー・修正依頼・merge
[merge後、人間が /admin/improvements で「mark deployed」→「start measurement」]
   ↓ 効果測定(Growth OSの既存指標を比較)
[improvement_memory に結果を記録(成功/失敗/副作用/次回推奨)]
```

## なぜ「Autonomous Engineering Agent」はVercelの常駐デーモンではないか

Vercelのcron/serverless関数には実行時間制限があり、git clone・npm install・`npm run build`・Playwright E2E実行のようなフルの開発ループを1回のHTTPリクエストの中で完結させることは現実的ではない(本アプリの`npm run build`だけで数十秒〜1分規模)。また、mainブランチへの書き込み権限をVercelの実行環境(本番Webアプリと同じ環境)に持たせることは、Webアプリの脆弱性がリポジトリ書き込み権限に直結するという重大なセキュリティリスクを生む。

そのため、**Autonomous Engineering Agent(`scripts/improvement/engineering-agent.mjs`)はGitHubリポジトリ側で、`gh`コマンドの実行権限を持つ環境からのみ起動される設計**にした。具体的には以下のいずれか:

1. 人間が手元で `npm run improvement:implement -- --task=<taskId>` を実行する
2. Claude Code(このエージェント自身)が `/admin/improvements` で承認されたタスクを見て、このスクリプトを呼び出す形で実装を進める
3. `.github/workflows/improvement-agent.yml` を `workflow_dispatch` で手動起動する(GitHub Actions runnerはgit/npm/buildのフル環境を持つ)

**いずれの経路でも、起点は必ず人間の明示的な操作**(コマンド実行、承認クリック、workflow_dispatch起動)であり、スケジュール実行による無人自動起動は設定していない(Level 4/5を実装しないという方針と一致)。

## 変更禁止領域(コードレベルで保証)

`AUTONOMOUS_ENGINEERING_POLICY.md`の「変更禁止パス一覧」を`scripts/improvement/engineering-agent.mjs`内にハードコードし、生成した差分がこれらのパスを含む場合は自己レビュー段階で強制的に`changes_requested`にしてDraft PR化を止める(`test:no-autonomous-deploy`, `test:quality-gates`で検証)。
