# 自律障害対応 ポリシー

重大な障害を検知した場合の自動対応範囲(Phase 10)。**自動本番修正は禁止**。

## 監視対象例

- `/api/ai`系ルートの500急増(2026-07-14の別セッションで実際に発見された既知の未解決issue)
- analytics_events取り込み停止(2026-07-14に実際に発生していた既知の障害パターン。再発検知の仕組みとしてもこのanalyzerを使う)
- Cron失敗(`growth-rollup`/`growth-insights`/`growth-weekly-report`/将来の`improvement-scan`自身も対象)
- sitemap.xmlの500
- ads.txtの消失・内容変化
- canonicalのvercel.app系ドメイン再発(2026-07-15に対応した問題の再発検知)
- Stripe同期不整合(`profiles.is_premium`とStripe実態の乖離 — 読み取り専用チェックのみ、修正は人間)
- Supabase migration未適用(リポジトリの`supabase/migrations/*.sql`とDB実態の差分)
- ログイン不能
- PDF生成不能

## 検知時に自動実行すること

1. `improvement_issues`作成(category='reliability', severity='critical'または'high')
2. 影響範囲調査(該当エンドポイントのVercel Runtime Logs/Errors APIから直近のエラー件数・影響URLを収集)
3. ログ収集(`improvement_issues.evidence`に構造化して保存。個人情報を含むログ本文はそのまま保存せず、件数・reason・pathレベルに要約する)
4. 再現テストの要否・方針の記録(`improvement_tasks.required_tests`。実際のテストファイル作成はコード修正と同じく人間/Claude Codeまたは`patch-agent.mjs`が担う。無人スクリプトが新規テストコードを生成することはない)
5. 修正案作成(`improvement_tasks`。まだコードではなく、target_files/change_summary等の計画)
6. autonomy_level=3かつ変更範囲が禁止パスに触れず、**コード修正済みのbranchが既に用意されている場合のみ**、その先の検証〜Draft PR作成まで無人で進む(コード修正自体の自動化はここに含まれない。AUTONOMY_LEVEL_POLICY.md「現在の自動化範囲の内訳」参照)
7. rollback推奨(直近のREADY状態のデプロイIDを`improvement_issues.evidence`に記載し、人間が`vercel rollback`しやすいようにする)
8. `/admin/improvements`の"Critical issues"に常時表示

## 自動実行禁止

- 本番デプロイのロールバック実行そのもの(推奨をIssueに書くのみ。実行は人間がVercelダッシュボード/CLIで行う)
- DB migrationの本番適用
- Stripeの同期修正(Webhookの再送・手動データ修正)
- ユーザーへの通知送信
