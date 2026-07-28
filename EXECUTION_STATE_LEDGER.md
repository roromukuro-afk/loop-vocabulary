# 実行状態台帳 (Execution State Ledger)

このファイルは、集客・SEO・AI検索・SXO包括改善プロジェクトの**再開用の正確な状態**を記録するもの。
次回セッションはこのファイルと`GROWTH_SEO_MASTER_CHECKLIST.md`から再開し、監査からやり直さないこと。

最終更新: 2026-07-28(本ラウンド開始時点)

## 現在進行中のブランチ・セッション

| ブランチ | 担当 | 内容 | 状態 |
|---|---|---|---|
| `feat/adsense-cmp-consent` | ユーザーが起動した別セッション(spawn_task由来) | CMP同意管理バナー実装 | 作業中(未コミット変更あり、ワークツリー`C:\Users\rorom\loop-vocabulary-cmp-consent`) |
| `feat/growth-events-wordbook-retention` | ユーザーが起動した別セッション(spawn_task由来) | `wordbook_created`/`first_test_started`/`return_next_day`/`return_day_7`等の成長イベント実装 | 作業中(未コミット変更あり、ワークツリー`C:\Users\rorom\loop-vocabulary-growth-events`) |
| `feat/ai-crawler-policy-llms-txt` | 本セッションのbackground agent | robots.txtへのOAI-SearchBot/GPTBot/ClaudeBot/Google-Extended/PerplexityBot個別セクション追加(推奨デフォルト付き)、`public/llms.txt`新規作成、`AI_SEARCH_AND_INDEXNOW_POLICY.md`更新 | 作業中(agent実行中、draft PR作成予定) |
| `feat/review-date-calculator-tool` | 本セッションのbackground agent | 復習日計算ツール(新規無料ツール)。アプリ実装のSRS固定間隔(1/3/7/14/30日)を使用 | 作業中(agent実行中、draft PR作成予定) |
| `feat/eitango-oboekata-pillar-breadcrumb` | 本セッションのbackground agent | 「英単語の覚え方」ピラーページ新設+サイト初の可視パンくずUIコンポーネント追加 | 作業中(agent実行中、draft PR作成予定) |
| `feat/indexnow-implementation` | 本セッションのbackground agent | IndexNowキーファイル・送信ユーティリティ・週次cron再送信ルート | 作業中(agent実行中、draft PR作成予定) |
| `docs/execution-state-ledger` | 本セッション | この台帳ファイル自体 | 作業中 |

**注意**: `feat/ai-crawler-policy-llms-txt`と`feat/review-date-calculator-tool`と`feat/eitango-oboekata-pillar-breadcrumb`はいずれも`src/app/sitemap.ts`を編集する可能性がある。マージ順によっては軽微なコンフリクトが発生しうるため、後発のマージはmain最新化後にリベース・手動解消すること。

## 完了済み(このプロジェクト全体を通じて、再実装不要)

- PR #23: robots.txtの`/road`誤ブロック修正(merge `4b8c51a`)
- PR #24: `/roadmap`のcanonical追加(merge `7ce8cc4`)
- wwwドメインの308転送・証明書発行確認
- Search Console: `/roadmap`インデックス登録、`eigo-listening-renshu`のValidate Fix開始
- PR #25: 認証保護38ページへのnoindex追加、`test:indexing-policy`拡張、本番反映確認済み(merge `f0e909f`)
- PR #26: マスターチェックリストのT-04ステータス更新(merge `c29d31a`)
- `GROWTH_SEO_MASTER_CHECKLIST.md`作成・運用中(リポジトリルート)

## 次に実行すべき正確なタスク(このセッションが中断した場合)

1. 上記5ブランチ(CMP・成長イベント・AIクローラー・復習日ツール・ピラーページ・IndexNow)の進捗を確認。各ブランチで`gh pr list --head <branch>`または`gh pr view <PR番号>`でdraft PRの有無を確認。
2. draft PRが存在する場合: 差分をレビュー(架空データ・誇張表現がないか、既存実装を壊していないか)→ `npm run typecheck && npm run lint && npm run build`をそのワークツリーで再確認 → 関連テスト実行 → 問題なければ`gh pr ready <番号>` → CI(`gate`/`protected-path-gate`/`quality-gate`)全パス確認 → `mergeStateStatus: CLEAN`確認 → `gh pr merge <番号> --squash --delete-branch=false` → Vercel本番デプロイの`readyState: READY`確認(`mcp__35d4d012-5df6-4517-8ed0-6a4193854018__get_deployment`) → 該当ページを本番URLで実際に確認。

   **`feat/ai-crawler-policy-llms-txt`固有の追加確認事項(必須、機械的にマージしないこと)**: このPRは`GROWTH_SEO_MASTER_CHECKLIST.md`のT-09/A-02で「オーナー判断待ち」として一度明示的に保留されていたrobots.txtのAIクローラー個別設定を変更する。2026-07-28のユーザー継続指示で「両方に切り替えられる設計を完成させ、推奨デフォルトを提示する」ことが明示的に許可されたためこの実装自体は指示に沿っているが、マージ前に必ず`public/robots.txt`の実際の差分を人間(またはこのタスクを引き継ぐセッション)が読み、(a) 各bot(OAI-SearchBot/GPTBot/ClaudeBot/Google-Extended/PerplexityBot)のデフォルトが1行コメントで明確に理由付けされているか、(b) `User-agent: *`の既存ブロックが変更されていないか、(c) `AI_SEARCH_AND_INDEXNOW_POLICY.md`が「保留」ではなく「実装済み+デフォルト理由+切替方法」に書き換わっているか、を確認すること。ここは他のブランチと違い「テストが通ったから即マージ」を避け、diffを実際に読むステップを飛ばさない。
3. マージ後、`GROWTH_SEO_MASTER_CHECKLIST.md`の該当行(T-09/A-02のAIクローラー行、T-12/A-03のllms.txt行、T-11のIndexNow行、D系の新規ツール行、C系のピラーページ・パンくず行、N-02のイベント表、AD-03のCMP行)を「作業中」→「完了」または「実装済み・○○待ち」に更新し、別途小さなdocs PRでmain反映。
4. まだ未着手のワークストリームへ進む(優先順):
   - ワークストリームB: 既存主要流入ページの改善(英単語の覚え方/中学生向け/高校・大学受験/英検2級/TOEIC/英会話/ビジネス英語/覚えられない/すぐ忘れる の8ページを特定し、title/meta description/直接回答/内部リンク/CTA/構造化データ/更新日を実施)。Search Console実データへのアクセス手段がない場合は、既存の`GUIDE_REWRITE_PRIORITY.md`の優先順位を代替根拠として使う。
   - ワークストリームD残り(語彙力チェック強化、CSV変換、小テスト作成、PDF作成、発音検索、類義語比較、不規則動詞、今日の単語)を1つずつ着手。**注意**: `src/app/tools/page.tsx`の`PLANNED_TOOLS`配列は本ラウンド時点で「試験日から逆算する学習計画メーカー」「英単語リスト整形・CSV変換ツール」の2件しか含んでおらず、8件全部の優先順位を示す権威あるソースではない。実装優先順位の正しい根拠は、2026-07-28のユーザー継続指示本文「3. 次に実行する作業 > ワークストリームD:無料ツール > 実装順」の10項目リスト(1.語彙力チェック強化〜10.今日覚える英単語)であり、コード配列とこの指示文が食い違う場合は指示文を優先する。着手時は`PLANNED_TOOLS`にも該当エントリを追加して両者を一致させること。
   - ワークストリームG: 主要テーマ10件のSNS素材(X投稿・Instagram構成・Shorts台本・TikTok台本・Pinterest・OGP・UTM・スケジュール)をコンテンツファイルとして作成(`MARKETING_X_*`の既存フォーマットに準拠)。外部投稿の実行はユーザー確認後。
   - ワークストリームH: プレスページ拡充・被リンク候補リスト・送付文面のドラフト作成(送信自体はユーザー許可後)。

## ブロッカー(外部認証・人間判断待ち、コードは進めた上で待機)

- Bing Webmaster Toolsへのサイト登録(人間の画面操作が必要)
- AdSense管理画面でのCMP設定・ads.txt Authorized状態確認
- 教育メディアへの被リンク送付の最終実行(文面・リストは準備、送信はユーザー承認後)
- AIクローラーのrobots.txt推奨デフォルトについて、オーナーが異なる判断を望む場合の最終確認(コードはtoggle可能な形で実装済みの想定、1行変更で切替可能)

## 再開用コマンド

```bash
# 各ブランチのdraft PR確認
gh pr list --state open

# 特定ブランチの状態確認例
cd /c/Users/rorom/loop-vocabulary-cmp-consent && git status --short && git log --oneline -3
```
