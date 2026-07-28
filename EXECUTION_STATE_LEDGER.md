# 実行状態台帳 (Execution State Ledger)

このファイルは、集客・SEO・AI検索・SXO包括改善プロジェクトの**再開用の正確な状態**を記録するもの。
次回セッションはこのファイルと`GROWTH_SEO_MASTER_CHECKLIST.md`から再開し、監査からやり直さないこと。

最終更新: 2026-07-28

## 🚨 今すぐユーザーの操作が必要な項目(最優先)

1. **PR #31 (`feat/ai-crawler-policy-llms-txt`)** — `protected-path-gate`が実際にブロック中。
   `scripts/improvement/pr-ci-checks.mjs`(CI自己防御システムの一部)を変更したため。
   コード内容は検証済み・正しい実装(下記「マージ済み・検証済み」節参照)。
   承認するには、GitHubでこのPRにコメント:
   ```
   /approve-protected-paths cbdc9ff390d4a14d9b089b6f02c1e03739b34997
   ```
   (このコマンドはリポジトリOWNERのコメントとしてのみ有効。承認後、`gate`が再実行されて
   通れば`gh pr merge 31 --squash --delete-branch=false`でマージ可能)

2. **PR #32 (`feat/indexnow-implementation`)** — `protected-path-gate`が実際にブロック中。
   `vercel.json`(cron設定)を変更したため。コード内容は検証済み・正しい実装。
   承認するには、GitHubでこのPRにコメント:
   ```
   /approve-protected-paths 7b1dfdf0db7bb4bef12634a1e82f53e220b70da7
   ```
   マージ後、Vercelの環境変数(Production)に以下を追加設定する必要がある:
   ```
   INDEXNOW_KEY=724d6efdf17808d5069e6c8d78fa98bc9cd413ab302de6c35be0e113338da741
   ```
   (`public/724d6ef...da741.txt`のファイル名と一致させること。これは秘密情報ではなく、
   IndexNowの仕組み上ドメイン所有権証明のため公開される値)

3. Bing Webmaster Tools (https://www.bing.com/webmasters/) へのサイト登録状況の確認(未確認)
4. AdSense管理画面でのCMP設定・ads.txt Authorized状態確認(PR #29マージ後)

**注意**: 上記のPR番号のSHAはこのファイル更新時点のもの。ブランチにさらにコミットが積まれた
場合は`gh pr view <番号> --json headRefOid -q .headRefOid`で最新SHAを再確認してから承認コメントを打つこと。

## 現在進行中・レビュー待ちのブランチ・セッション

| # | ブランチ | PR | 内容 | 状態 |
|---|---|---|---|---|
| A-1 | `feat/adsense-cmp-consent` | #29 | CMP同意管理バナー実装(Google Funding Choices) | ユーザーの別セッションで作業中(draft) |
| A-2 | `feat/growth-events-wordbook-retention` | #27 | `wordbook_created`/`first_test_started`/`return_next_day`/`return_day_7`等 | ユーザーの別セッションで作業中(draft) |
| E/F | `feat/ai-crawler-policy-llms-txt` | #31 | robots.txt個別ボット指定+llms.txt | 実装・テスト・Codexレビュー対応済み。**owner承認待ち(上記参照)** |
| D-2 | `feat/review-date-calculator-tool` | #33 | 復習日計算ツール | 実装・テスト・Codexレビュー対応済み。CI通過待ち→問題なければ即マージ可 |
| C | `feat/eitango-oboekata-pillar-breadcrumb` | #34 | ピラーページ+可視パンくずUI | 実装・テスト完了。CI通過待ち→問題なければ即マージ可 |
| F | `feat/indexnow-implementation` | #32 | IndexNowキー・送信ユーティリティ・週次cron | 実装・テスト完了。**owner承認待ち(上記参照)** |
| G | `content/sns-10themes-kit` | #30 | 主要10テーマのSNS素材(X/Instagram/Shorts/TikTok/Pinterest) | マージ済み(CI通過確認後、自動マージされていなければ手動マージ) |

**既知の注意点**:
- 複数ブランチが`src/app/sitemap.ts`・`src/app/tools/page.tsx`・`.eslintrc.json`を編集している。
  マージ順によっては軽微なコンフリクトが発生しうるため、後発のマージはmain最新化(`git merge origin/main`)
  →コンフリクト解消→pushの手順を踏むこと(このラウンドで#31/#33/#34全てで実際に発生し、
  その都度解消済み)。
- `.eslintrc.json`に`"root": true`を追加する変更が複数ブランチで独立に発生している
  (ネストしたgit worktree構成で`next lint`が誤ったworkspace rootを推測し、
  複数の`package-lock.json`を検出して`@next/next`プラグインが競合するバグの対処)。
  マージ後は1つに収束するはず。
- **テスト実行時のポート競合に注意**: 複数worktreeで`npm run test:*`を連続実行すると、
  TEST_PORT=3799の使い回しにより別worktreeのビルド成果物を誤って検証してしまうことがある
  (`startedByUs=false`のログが出たら要注意)。`netstat -ano | grep 3799`でPIDを特定し
  `taskkill //F //PID <PID>`してから再実行すること。

## Codexレビュー(chatgpt-codex-connector)について

このリポジトリはPRに対して自動レビューbotが付き、`required_conversation_resolution`が
有効なためマージ前に全スレッドの解決が必要。今ラウンドで実際に指摘され、修正・解決済みの例:
- PR #28: owner承認ゲートの明記漏れ、ツールバックログの参照先誤り
- PR #31: テストが「何らかのルールがある」しか見ておらず反転を検知できない → 各ボットの
  期待ポリシーを厳密assertするよう強化、`pr-ci-checks.mjs`/`run-e2e.mjs`への未接続を修正、
  マスターチェックリストの記載が古いままだった点を修正
- PR #33: 「アプリの実際に稼働しているSRS式」という表現がSRS V2ユーザーには不正確だった点を
  修正、`tool_completed`が`tool_started`より多く発火しうるファネル不整合を修正

**再開時の教訓**: このbotのコメントは実際に有用な指摘であることが多い。マージ前に
`gh api graphql`でreviewThreadsを確認し、内容を精査してから対応すること(機械的に
resolveするのではなく、指摘が正しいか検証してから修正・resolve)。

## 完了済み(このプロジェクト全体を通じて、再実装不要)

- PR #23: robots.txtの`/road`誤ブロック修正(merge `4b8c51a`)
- PR #24: `/roadmap`のcanonical追加(merge `7ce8cc4`)
- wwwドメインの308転送・証明書発行確認
- Search Console: `/roadmap`インデックス登録、`eigo-listening-renshu`のValidate Fix開始
- PR #25: 認証保護38ページへのnoindex追加、`test:indexing-policy`拡張、本番反映確認済み(merge `f0e909f`)
- PR #26: マスターチェックリストのT-04ステータス更新(merge `c29d31a`)
- PR #28: 本台帳ファイル自体の追加(merge `db7be49`)
- `GROWTH_SEO_MASTER_CHECKLIST.md`作成・運用中(リポジトリルート)

## 次に実行すべき正確なタスク(このセッションが中断した場合)

1. 上記「🚨今すぐユーザーの操作が必要な項目」を最優先で確認・実行。
2. PR #33・#34のCI状況を`gh pr checks <番号>`で確認。`gate`が`cancelled`表示の場合は
   `gh run rerun <run-id>`で再実行(GitHub Actions concurrency-groupによる良性キャンセルの
   ことが多い。`gh run view <run-id> --json conclusion`で`cancelled`かどうか確認してから判断)。
   `mergeStateStatus`が`BEHIND`の場合は該当worktreeで`git fetch origin main && git merge origin/main --no-edit && git push origin HEAD:<branch>`。
   全チェックが`pass`かつ`mergeStateStatus: CLEAN`になったら`gh pr merge <番号> --squash --delete-branch=false`。
3. マージ後、Vercel本番デプロイの`readyState: READY`を確認(`mcp__35d4d012-5df6-4517-8ed0-6a4193854018__get_deployment`)。
4. マージ後、`GROWTH_SEO_MASTER_CHECKLIST.md`の該当行(N-02のイベント表、AD-03のCMP行、
   D系の新規ツール行、C系のピラーページ・パンくず行)を実際の状態に更新し、小さなdocs PRでmain反映。
5. まだ未着手のワークストリームへ進む(優先順):
   - ワークストリームB: 既存主要流入ページの改善(英単語の覚え方/中学生向け/高校・大学受験/英検2級/TOEIC/英会話/ビジネス英語/覚えられない/すぐ忘れる の8ページを特定し、title/meta description/直接回答/内部リンク/CTA/構造化データ/更新日を実施)。Search Console実データへのアクセス手段がない場合は、既存の`GUIDE_REWRITE_PRIORITY.md`の優先順位を代替根拠として使う。
   - ワークストリームD残り(語彙力チェック強化、CSV変換、小テスト作成、PDF作成、発音検索、類義語比較、不規則動詞、今日の単語)を1つずつ着手。**注意**: `src/app/tools/page.tsx`の`PLANNED_TOOLS`配列はこのラウンド開始時点で2件しか含んでおらず権威あるソースではない。実装優先順位の正しい根拠は、2026-07-28のユーザー継続指示本文「3. 次に実行する作業 > ワークストリームD:無料ツール > 実装順」の10項目リストであり、コード配列とこの指示文が食い違う場合は指示文を優先する。着手時は`PLANNED_TOOLS`にも該当エントリを追加して両者を一致させること(review-date-calculatorは`LIVE_TOOLS`に追加済みなので同様の扱いにする)。
   - ワークストリームH: プレスページ拡充・被リンク候補リスト・送付文面のドラフト作成(送信自体はユーザー許可後)。

## ブロッカー(外部認証・人間判断待ち、コードは進めた上で待機)

- Bing Webmaster Toolsへのサイト登録(人間の画面操作が必要)
- AdSense管理画面でのCMP設定・ads.txt Authorized状態確認
- 教育メディアへの被リンク送付の最終実行(文面・リストは準備、送信はユーザー承認後)
- PR #31・#32の`/approve-protected-paths`承認(上記「🚨」節に正確なコマンドあり)
- IndexNowの`INDEXNOW_KEY`環境変数設定(PR #32マージ後、上記「🚨」節に値あり)

## 再開用コマンド

```bash
# 各ブランチのPR確認
gh pr list --state open

# 特定ブランチの状態確認例
cd /c/Users/rorom/loop-vocabulary-cmp-consent && git status --short && git log --oneline -3

# ポート競合の解消
netstat -ano | grep ":3799"
taskkill //F //PID <PID>
```
