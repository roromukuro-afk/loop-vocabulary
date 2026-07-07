# LAUNCH STATUS — Loop Vocabulary

> **対象読者**: 運用者専用の内部ドキュメントです（ユーザー向け公開ページではありません）。
> [LAUNCH_READINESS_CHECKLIST.md](LAUNCH_READINESS_CHECKLIST.md) の内容をもとに、
> 「今、本番運用に進める状態なのか」を一目で確認できるようにまとめたものです。
> 各項目の詳細な調査結果・修正履歴は [LAUNCH_READINESS_CHECKLIST.md](LAUNCH_READINESS_CHECKLIST.md)・
> [PRODUCTION_MONITORING.md](PRODUCTION_MONITORING.md) を一次情報としてください。
>
> 最終更新: 2026-07-07（コード変更を伴わない棚卸しの時点のものです。実装状況は
> その後の変更で古くなる可能性があるため、判断に使う前に実態と突き合わせてください）。

---

## 1. 総合ステータス

**Status: Ready with owner-side confirmations pending**

**総合判定: コード・本番環境は概ね運用可能な状態にある。ただし、Vercel Cronの登録状況・
AdSense審査ステータス・特定商取引法ページの運営者情報など、オーナー側の確認・判断待ちの
項目が複数残っている。**

- 現時点で **🔴 ブロック中（今すぐ止めるべき技術的な問題）に該当する項目は無い**。
  ただし「問題が無い」ことを積極的に断定するのではなく、「本ドキュメント作成時点で
  確認した範囲では見つかっていない」という慎重な表現にとどめる。
- 課金導線（Stripe checkout/webhook）・AI濫用対策・AIログの保持/削除・広告のPremium
  非表示・管理画面の権限分離など、**技術的な安全対策自体は実装・自動テストで検証済み**。
- 一方で、**実際の初回課金・Vercel Cron・AdSense審査・特商法表記の公開**など、
  「実運用で実際に起きた時にしか確認できない項目」「オーナーの操作・判断が要る項目」は
  未確認のまま残っている。これらが確認・完了するまでは、「完全にリリース準備完了」
  と言い切ることは避ける。

---

## 2. カテゴリ別ステータス表

ステータス凡例: ✅ 完了 / ⚠️ 要確認 / 🟡 オーナー対応待ち / 🔴 ブロック中 / 🕒 後日確認

### Stripe / Premium

| 項目 | 現在の状態 | ステータス | 次に必要な対応 | 担当者 |
|---|---|---|---|---|
| checkout / webhook route実装 | 実装済み。二重課金防止(409)・署名検証・各種イベント処理を`test:stripe-premium-webhook`で検証済み | ✅ 完了 | 継続監視のみ | Claude（自動テスト） |
| Premiumスキーマ列（`stripe_customer_id`/`premium_expires_at`/`is_premium`） | 本番Supabaseに存在。`verify:prod`で毎回自動確認 | ✅ 完了 | 継続監視のみ | Claude（自動） |
| Customer Portal (`/api/stripe/portal`) | 実装済み | ✅ 完了 | — | — |
| Webhook endpoint重複の解消 | 有効1本＋無効化1本の状態（2026-07-06対応、削除ではなく無効化のまま） | ⚠️ 要確認 | 有効なendpointが1本だけかの定期確認 | オーナー（Stripe Dashboard） |
| 初回実課金時の実データ確認 | 未実施（安全に本番へ影響を与えず実施する手段が無かったため） | 🕒 後日確認 | 初めて実課金が発生したタイミングで確認 | オーナー＋Claude |

### AI利用・コスト対策

| 項目 | 現在の状態 | ステータス | 次に必要な対応 | 担当者 |
|---|---|---|---|---|
| 無料5回/日・Premium300回/日ソフト上限 | 実装済み | ✅ 完了 | — | — |
| atomic RPC (`try_consume_ai_quota`) | 実装済み。同時実行シナリオを`test:ai-usage-guards`で検証済み | ✅ 完了 | — | — |
| `ai_generation`チケット救済 | 実装済み | ✅ 完了 | — | — |
| `/admin/ai`モニタリング画面 | 実装済み。テストアカウント除外済み | ✅ 完了 | 週次目視確認 | オーナー／Claude |
| 異常検知・緊急停止手順 | 文書化済み（`ANTHROPIC_API_KEY`無効化による緊急停止含む） | ✅ 完了 | 実インシデント発生時に実行 | オーナー＋Claude |

### AIログ保持・削除

| 項目 | 現在の状態 | ステータス | 次に必要な対応 | 担当者 |
|---|---|---|---|---|
| 90日保持ポリシー・アカウント削除時カスケード削除 | 実装・`test:ai-usage-retention`で検証済み | ✅ 完了 | — | — |
| 手動cleanupコマンド（dry-run/apply） | 実装済み | ✅ 完了 | — | — |
| 自動cleanup cron（月1回、`/api/admin/cleanup/ai-usage-events`） | コード実装・`vercel.json`登録・`test:ai-usage-cleanup-cron`で検証済み | 🟡 オーナー対応待ち | Vercel Dashboard「Cron Jobs」で実際に登録され、上限エラーが出ていないか確認（オーナー確認中） | オーナー |

### AdSense / 広告

| 項目 | 現在の状態 | ステータス | 次に必要な対応 | 担当者 |
|---|---|---|---|---|
| `ads.txt` / Publisher ID | 公開済み・`layout.tsx`と一致確認済み | ✅ 完了 | — | — |
| dashboard限定の広告配置 | 実装済み（`/dashboard`の1ページのみ） | ✅ 完了 | — | — |
| Premiumユーザー広告非表示 | 実装済み。`verify:prod`で毎回自動確認 | ✅ 完了 | 継続監視のみ | Claude（自動） |
| AdSense審査ステータス | 本書作成時点で把握している最新値は「`Getting ready`」（2026-07-04確認、以降変化している可能性が高い） | 🟡 オーナー対応待ち | AdSense管理画面で最新ステータスを確認 | オーナー |
| 審査通過後の他ページ展開 | 未着手（審査待ちのため意図的に保留） | 🕒 後日確認 | 審査通過後、ページ追加ごとにオーナー承認を得てから実施 | オーナー＋Claude |

### 法務・信頼ページ

| 項目 | 現在の状態 | ステータス | 次に必要な対応 | 担当者 |
|---|---|---|---|---|
| `/terms` `/privacy` `/contact` `/faq` | 実装済み・実際の課金内容/第三者サービスと整合済み | ✅ 完了 | — | — |
| `/legal/commercial-transaction`（特商法表記に相当） | ドラフト・noindex・footer未リンクの状態を維持中 | 🟡 オーナー対応待ち | 運営者情報（事業者名・所在地・電話番号）の提供 | オーナー |
| 公開時の法律要件確認 | 未実施（本ドキュメントでは法律判断を行わない） | 🕒 後日確認 | 公開前に必要であれば専門家（行政書士・弁護士等）に確認 | オーナー |

### cron / scheduled jobs

| 項目 | 現在の状態 | ステータス | 次に必要な対応 | 担当者 |
|---|---|---|---|---|
| `daily-push` / `weekly-digest`（既存） | 稼働中 | ✅ 完了 | 継続監視のみ | オーナー／Claude |
| AIログcleanup cron（新規、月1回） | 上記「AIログ保持・削除」参照 | 🟡 オーナー対応待ち | Vercel Dashboardで登録確認 | オーナー |
| cron失敗時の手動対応手順 | 文書化済み | ✅ 完了 | 実失敗時に手順を実行 | オーナー＋Claude |

### 管理画面

| 項目 | 現在の状態 | ステータス | 次に必要な対応 | 担当者 |
|---|---|---|---|---|
| `/admin` `/admin/srs` `/admin/ai` `/admin/stats` | 実装済み・`requireAdmin()`で保護 | ✅ 完了 | — | — |
| 個人情報非表示・test account除外 | 実装・`test:admin`/`test:admin-ai-usage`で検証済み | ✅ 完了 | — | — |

### SEO / Search Console

| 項目 | 現在の状態 | ステータス | 次に必要な対応 | 担当者 |
|---|---|---|---|---|
| `/materials/toeic` `/materials/business` `/materials/news`（sitemap/robots/canonical） | 実装・`verify:seo-lp-audit`で自動検証済み | ✅ 完了 | — | — |
| Search Consoleインデックス登録リクエスト | 3URLとも実施済み（2026-07-05、結果待ち） | 🕒 後日確認 | リクエストから1〜2週間後にインデックス状況を再確認 | オーナー |

### 緊急時対応

| 項目 | 現在の状態 | ステータス | 次に必要な対応 | 担当者 |
|---|---|---|---|---|
| 8シナリオの対応手順（支払い/AIコスト/AdSense/cron/広告誤表示/署名エラー等） | [LAUNCH_READINESS_CHECKLIST.md §8](LAUNCH_READINESS_CHECKLIST.md)に文書化済み | ✅ 完了 | 実インシデント発生時に参照・実行 | オーナー＋Claude |
| 緊急停止手順の実効性 | 手順は文書化済みだが、実インシデントでの実行実績は無い | ⚠️ 要確認 | 実際に発動する場面があれば手順どおり機能するか確認しながら実施 | オーナー＋Claude |

---

## 3. オーナー対応待ち一覧

以下は、私（Claude）側では完結できず、運用者の操作・確認・判断が必要な項目です。

1. **Vercel Cron Jobsで`/api/admin/cleanup/ai-usage-events`が登録されているか確認**
   （既存2件と合わせて上限エラーが出ていないか、scheduleが月1回になっているか、
   Production環境で有効かの4点。**現在オーナーが確認作業中**、結果共有待ち）
2. **AdSense審査ステータスの最新確認**（`Getting ready`から変化しているか。変化していれば
   広告展開の判断材料になる）
3. **Search Consoleで`/materials/toeic`・`/materials/business`・`/materials/news`の
   インデックス状況を1〜2週間後に確認**（2026-07-05にリクエスト済み、結果待ち）
4. **特商法ページ正式公開に必要な運営者情報の提供**（販売事業者名・所在地・電話番号。
   個人情報を推測・捏造しない方針のため、提供があるまでドラフト非公開のまま）
5. **Stripe初回実課金時のWebhook deliveryとPremium反映確認**（Stripe Dashboardの
   配信ログ・本番`profiles`の`is_premium`等・`/premium`表示の3点を突き合わせる）
6. **無効化済みStripe重複Webhook endpointを将来削除するか判断**（2026-07-06に
   signing secret不一致の重複endpointを「削除ではなく無効化」で対処済み。実害は
   無く緊急性は無いが、無効化されたまま放置し続けるか、確認の上で削除するかは
   運用ポリシーとしてオーナーが判断する事項）

---

## 4. 今すぐ実装しない項目

以下は「未実装だが、現時点では実装を急ぐ理由が無い」と整理した項目です。実装しない
という決定ではなく、優先度を下げて保留している状態です。

- **AIログの長期トレンド用日次集計テーブル**: 現状の`ai_usage_events`は90日保持の
  生ログのみ。90日を超える長期トレンド分析が必要になった時点で、別途集計テーブルの
  設計を検討する（[PRODUCTION_MONITORING.md §13-7](PRODUCTION_MONITORING.md)）。
- **特商法ページ（`/legal/commercial-transaction`）の正式公開**: 運営者情報が
  揃うまでは意図的にドラフト・非公開のまま維持する方針。情報提供があり次第、
  [LAUNCH_READINESS_CHECKLIST.md §4](LAUNCH_READINESS_CHECKLIST.md)の手順で公開する。
- **実ユーザー数に基づく社会的証明の動的表示**: 2026-07-05に架空の統計・testimonials
  を削除して以降、実データに基づく動的な社会的証明の再導入は行っていない。実ユーザー数が
  マーケティング上意味のある規模になった際に、改めて実データのみで検討する。
- **未実装`reward_tickets` kind（`pdf_export`/`weak_word_test`/`analysis_ticket`）の実装**:
  型定義のみで消費コードが無いことを確認済み。将来の機能追加の余地として型は残しているが、
  現時点で実装する具体的な計画は無い。
- **`daily_achievement`スタンプの将来交換機能**: 現状は「達成の記録（スタンプ）」として
  UI上に表示するのみで、他の特典への交換機能は実装していない（Premium価値を薄める懸念が
  あるため意図的に見送った経緯あり）。

---

## 5. 次にやるべき優先順位

1. **オーナーがVercel Cron登録状況を確認する**（既に確認作業中。最も早く結果が出せる
   項目で、他の判断への影響もないため最優先）
2. **オーナーがAdSense審査ステータスを確認する**（広告展開の判断に直結する）
3. **オーナーが特商法表記に必要な運営者情報を決める・提供する**（対応に時間がかかる
   可能性があるため早めに着手するとよい。ただし公開を急ぐ必要は無い）
4. **Search Consoleのインデックス状況を期日後（1〜2週間後）に確認する**（すでに
   リクエスト済みで手待ち状態のため、日付が来たら確認するだけでよい）
5. **実課金が発生した際にStripeの配信ログとPremium反映を確認する**（発生タイミングは
   コントロールできないため、実際に発生したら都度対応する）
6. **無効化済みStripe重複Webhook endpointの取り扱いを判断する**（緊急性は低いため、
   上記1〜5がひと段落してからで問題ない）

---

## 関連ドキュメント

- [LAUNCH_READINESS_CHECKLIST.md](LAUNCH_READINESS_CHECKLIST.md) — 各項目の詳細チェックリスト
- [PRODUCTION_MONITORING.md](PRODUCTION_MONITORING.md) — 日次/週次監視・異常時の詳細な調査手順
- [ADSENSE_SETUP.md](ADSENSE_SETUP.md) — AdSense審査状況・広告実装の詳細
- [SEARCH_CONSOLE_SETUP.md](SEARCH_CONSOLE_SETUP.md) — Search Console登録・週次の見方
- [NEXT_IMPROVEMENTS.md](NEXT_IMPROVEMENTS.md) — 優先順位付きの次の改善候補・残課題
