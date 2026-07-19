# Autonomous Engineering Agent ポリシー

`scripts/improvement/engineering-agent.mjs`が承認済み`improvement_tasks`を実装する際に必ず守る安全制約。このドキュメントに書かれたルールは、対応するコード(`engineering-agent.mjs`の`FORBIDDEN_PATHS`/`FORBIDDEN_ACTIONS`)とテスト(`test:no-direct-main-push`, `test:no-autonomous-deploy`, `test:quality-gates`)の両方で二重に強制する。**ドキュメントだけのルールにしない。**

## 自動実行してよいこと

- リポジトリ調査(Read/Grep/Glob相当)
- 関連コード特定
- `git checkout -b improvement/<taskId>-<slug>` でのbranch作成(**mainからは絶対に直接作業しない**)
- コード修正(Edit/Write)
- migration作成(`supabase/migrations/*.sql`の新規ファイル追加のみ。**`apply_migration`は呼ばない** — 本番DBへの適用は人間がPRレビュー後に別途行う)
- テスト追加
- `npx tsc --noEmit` / `npm run build` / `npm run lint`
- 対象範囲のE2Eテスト実行
- 差分の自己レビュー(`improvement_reviews`への記録)
- `git push origin improvement/<taskId>-<slug>`(**mainブランチへのpushではない**)
- `gh pr create --draft`
- PR本文作成(変更内容・rollback手順・テスト結果を含む)
- rollback手順のドキュメント化

## 自動実行禁止(コードレベルで強制)

以下のいずれかに該当する変更が差分に含まれる場合、`engineering-agent.mjs`は**Draft PRを作成せず、`improvement_tasks.status`を`changes_requested`にして停止する**:

- `main`ブランチへの直接push(`git push origin main`に相当する操作はスクリプト内に一切存在しない)
- 本番デプロイ(Vercel CLI/API呼び出し、`vercel --prod`相当の操作は一切実装しない)
- Stripe価格変更(`src/app/api/stripe/**`, `src/lib/growth/revenueSnapshot.ts`の価格定数, `src/app/premium/**`の価格表示)
- checkout変更(`src/app/api/stripe/checkout/**`)
- Premium権限変更(`profiles.is_premium`を書き換えるコード、`src/lib/premium/**`相当)
- AdSense設定変更(`NEXT_PUBLIC_ADSENSE_CLIENT`, `public/ads.txt`, `src/lib/ads/**`)
- 広告配置変更(`src/components/ads/**`, `adRoutePolicy.ts`)
- 特商法変更(`src/app/legal/commercial-transaction/**`)
- 個人情報処理変更(`src/lib/analytics/eventSchema.ts`のPII関連バリデーション, `ANALYTICS_PRIVACY_POLICY.md`に反する変更, プライバシーポリシー本文)
- 市販教材公開(`materials.is_public`を書き換えるスクリプト・migration)
- SRSアルゴリズム変更(`src/lib/srs/**`)
- ユーザー削除(`DELETE FROM profiles`相当、ユーザーデータ削除API)
- DB破壊的migration(`DROP TABLE` / `DROP COLUMN` / データを失う`ALTER`を含むmigration)
- `src/app/api/stripe/webhook/route.ts`の編集・import(このファイルは既存の全ラウンドを通じて一貫して編集禁止対象)

これらのパスに対する変更が必要だと判断した場合、`engineering-agent.mjs`は**コードを書かずに**、`improvement_tasks.status='rejected'`とし、`improvement_issues.implementation_type='human_only'`に更新し、`/admin/improvements`に「人間対応が必要」として表示する。

## 実装フロー

```
improvement_tasks.status = 'approved' (人間が承認)
  ↓
1. branch作成: improvement/<taskId>-<slug>
2. コード調査(対象ファイルの現状確認)
3. 修正(target_filesの範囲を基本とし、大幅に逸脱する場合は自己中断してタスクを分割提案)
4. テスト追加(required_testsに基づく)
5. npx tsc --noEmit / npm run build / npm run lint
6. 対象範囲のE2E実行
7. 自己レビュー(improvement_reviewsに記録。禁止パス抵触チェックはここで最終確認)
8. 全て通過 → git push + gh pr create --draft
   いずれか失敗 → improvement_tasks.status='changes_requested'、失敗理由をimprovement_runsに記録して停止
```

## 実装範囲の分割

`target_files`が5ファイルを超える、または`db_migration_required`かつ`api_change_required`かつ`ui_change_required`が同時にtrueになるような大きな計画は、実装着手前に`improvement_tasks`を複数の小さいタスクに分割する(`change_summary`に分割理由を明記)。1つのタスク・1つのDraft PRが1つの検証可能な変更単位になることを優先する。

## GitHub Actions連携

`.github/workflows/improvement-agent.yml`は`workflow_dispatch`トリガーのみを持つ(`schedule`トリガーは意図的に設定しない)。実行には`task_id`の入力を必須とし、人間が明示的にどのタスクを実行するか指定した場合にのみ動く。ワークフロー自体もmainブランチへの書き込み権限は`contents: write`を最小スコープで持つのみで、`pull-requests: write`はDraft PR作成のためだけに使う。mainブランチへのforce-pushやbranch protectionの変更権限は付与しない。
