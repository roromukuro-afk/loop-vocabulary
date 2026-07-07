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

**総合判定: コード・本番環境は概ね運用可能な状態にある。Vercel Cronの登録状況は
オーナー確認済み（完了）。特商法ページも運営者情報（実名・所在地/電話番号の請求時
開示方針）を反映済みだが、正式公開（footerリンク追加・noindex解除）は最終承認待ち。
AdSense審査（審査待ち継続中）・初回実課金確認など、オーナー側の確認・判断待ちの
項目も引き続き残っている。**

- 現時点で **🔴 ブロック中（今すぐ止めるべき技術的な問題）に該当する項目は無い**。
  ただし「問題が無い」ことを積極的に断定するのではなく、「本ドキュメント作成時点で
  確認した範囲では見つかっていない」という慎重な表現にとどめる。
- 課金導線（Stripe checkout/webhook）・AI濫用対策・AIログの保持/削除・広告のPremium
  非表示・管理画面の権限分離など、**技術的な安全対策自体は実装・自動テストで検証済み**。
- **Vercel Cron Jobsの登録状況は2026-07-07にオーナーが確認済み**（完了。詳細は
  §2「AIログ保持・削除」参照）。
- **AdSense審査は「Getting ready」で審査待ち継続**（2026-07-07にオーナーが最新状況を
  再確認、ads.txt Authorized・Policy Center問題なし。Readyになるまで広告増設はしない
  方針を維持）。
- **Search Consoleでは`/materials/toeic`がインデックス登録済み**であることを確認。
  `/materials/business`・`/materials/news`はまだGoogleに未検出のため、1〜2週間ほど
  様子見する。
- **特商法ページ（`/legal/commercial-transaction`）は2026-07-07に運営者情報を反映**
  （販売事業者名・運営責任者は実名、所在地・電話番号は「請求があった場合、法令に
  基づき遅滞なく開示する」旨と`/contact`導線を表示）。ただし公開方針
  （noindex・robots.txt Disallow・footer未リンク）自体は変更しておらず、
  引き続き未公開ドラフトのまま。正式公開はオーナーの最終承認後、事前提案のうえで実施する。
- 一方で、**特商法ページの正式公開判断・初回実課金の実データ確認・無効化済み重複
  Webhook endpointの削除要否判断**は、実運用で実際に起きた時・オーナーの判断が
  無いと確認できない項目として引き続き残っている。これらが揃うまでは、
  「完全にリリース準備完了」と言い切ることは避ける。

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
| 無効化済み重複endpointの削除要否判断 | 2026-07-07にオーナーが方針確定: 現時点では削除せず無効化のまま様子見 | 🕒 後日確認 | 正規endpointで初回実課金のWebhook delivery・Premium反映を確認した後に削除するか判断 | オーナー |
| 初回実課金時の実データ確認 | 未実施（安全に本番へ影響を与えず実施する手段が無かったため。2026-07-07時点でも初回課金者なし） | 🕒 後日確認 | 初めて実課金が発生したタイミングで、Stripe決済成功・Webhook delivery成功・`is_premium=true`・`stripe_customer_id`/`premium_expires_at`保存・Premium機能解放・Premium広告非表示の7点を確認 | オーナー＋Claude |

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
| 自動cleanup cron（月1回、`/api/admin/cleanup/ai-usage-events`） | 2026-07-07にオーナーがVercel Dashboardで確認済み: 登録あり・schedule`0 19 1 * *`（月1回）・既存2件（`daily-push`/`weekly-digest`）と合わせて合計3件・上限エラーなし・Production環境で有効・Cron Jobs機能トグルEnabled | ✅ 完了 | 継続監視のみ | オーナー／Claude |

### AdSense / 広告

| 項目 | 現在の状態 | ステータス | 次に必要な対応 | 担当者 |
|---|---|---|---|---|
| `ads.txt` / Publisher ID | 公開済み・`layout.tsx`と一致確認済み | ✅ 完了 | — | — |
| dashboard限定の広告配置 | 実装済み（`/dashboard`の1ページのみ） | ✅ 完了 | — | — |
| Premiumユーザー広告非表示 | 実装済み。`verify:prod`で毎回自動確認 | ✅ 完了 | 継続監視のみ | Claude（自動） |
| AdSense審査ステータス | 2026-07-07にオーナーが最新確認: `loop-vocabulary.app`のステータスは`Getting ready`（審査待ち継続）。ads.txt: Authorized、Policy Center: No current issues、Auto ads: ON、Auto optimize: ON | 🕒 後日確認 | 現時点で追加対応不要。審査ステータスが変化するまで定期確認を継続 | オーナー |
| 審査通過後の他ページ展開 | 未着手（審査待ちのため意図的に保留。Readyになるまで広告増設もしない方針） | 🕒 後日確認 | 審査通過後、ページ追加ごとにオーナー承認を得てから実施 | オーナー＋Claude |

### 法務・信頼ページ

| 項目 | 現在の状態 | ステータス | 次に必要な対応 | 担当者 |
|---|---|---|---|---|
| `/terms` `/privacy` `/contact` `/faq` | 実装済み・実際の課金内容/第三者サービスと整合済み | ✅ 完了 | — | — |
| `/legal/commercial-transaction`（特商法表記に相当） | 2026-07-07にオーナーから運営者情報の提供を受け内容を更新: 販売事業者名・運営責任者は実名（佐藤 慶音）を記載、所在地・電話番号は常時公開せず「請求があった場合、法令に基づき遅滞なく開示する」旨と`/contact`への導線を表示。noindex・robots.txt Disallow・footer未リンクの公開方針は変更していない（引き続き未公開ドラフト） | 🕒 後日確認 | 正式公開（footerリンク追加・noindex解除・robots.txt解除）はオーナーの最終承認後に実施。実施前に提案する | オーナー＋Claude |
| 公開時の法律要件確認 | 未実施（本ドキュメントでは法律判断を行わない。所在地・電話番号の請求時開示方式が特定商取引法上どこまで認められるかも断定していない） | 🕒 後日確認 | 公開前に必要であれば専門家（行政書士・弁護士等）に確認 | オーナー |

### cron / scheduled jobs

| 項目 | 現在の状態 | ステータス | 次に必要な対応 | 担当者 |
|---|---|---|---|---|
| `daily-push` / `weekly-digest`（既存） | 稼働中 | ✅ 完了 | 継続監視のみ | オーナー／Claude |
| AIログcleanup cron（新規、月1回） | 2026-07-07にオーナーが登録・稼働を確認済み（上記「AIログ保持・削除」参照）。cron合計3件、上限エラーなし | ✅ 完了 | 継続監視のみ | オーナー／Claude |
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
| `/materials/toeic`のインデックス状況 | 2026-07-07にオーナー確認: **インデックス登録済み**（Page is indexed、最終クロール7/5 10:17 AM、crawl/indexing allowed: Yes、canonicalは自己参照で一致）。表示回数・クリック数はまだ0件 | ✅ 完了 | 検索パフォーマンスの表示回数・クリック数の推移を定点観測 | オーナー |
| `/materials/business`のインデックス状況 | 2026-07-07にオーナー確認: **未検出**（URL is unknown to Google、クロール未実施。noindex/robots/canonicalのエラーは該当なし） | 🕒 後日確認 | 1〜2週間ほど様子見し、それでも未検出なら再確認 | オーナー |
| `/materials/news`のインデックス状況 | 2026-07-07にオーナー確認: **未検出**（`/materials/business`と同様、技術的エラーは該当なし） | 🕒 後日確認 | 1〜2週間ほど様子見し、それでも未検出なら再確認 | オーナー |

### 緊急時対応

| 項目 | 現在の状態 | ステータス | 次に必要な対応 | 担当者 |
|---|---|---|---|---|
| 8シナリオの対応手順（支払い/AIコスト/AdSense/cron/広告誤表示/署名エラー等） | [LAUNCH_READINESS_CHECKLIST.md §8](LAUNCH_READINESS_CHECKLIST.md)に文書化済み | ✅ 完了 | 実インシデント発生時に参照・実行 | オーナー＋Claude |
| 緊急停止手順の実効性 | 手順は文書化済みだが、実インシデントでの実行実績は無い | ⚠️ 要確認 | 実際に発動する場面があれば手順どおり機能するか確認しながら実施 | オーナー＋Claude |

---

## 3. オーナー対応待ち一覧

**2026-07-07更新**: Vercel Cron・AdSense・Search Consoleの3項目はオーナーが確認済み
（結果は上記カテゴリ別ステータス表・下記に反映済み）。残るオーナー対応待ちは以下のとおり、
「要アクション（オーナーが何かをする必要がある）」と「後日確認予定（現時点では追加対応
不要・監視継続のみ）」に分けて整理する。

### 3-1. 対応が必要な項目（要アクション）

1. **特商法ページ正式公開の最終承認**（2026-07-07更新: 販売事業者名・運営責任者名は
   提供済みで反映済み。所在地・電話番号は常時公開せず「請求があった場合、法令に
   基づき遅滞なく開示する」旨と`/contact`導線を表示する形で決着済み。
   **ページ内容は更新したが、noindex・robots.txt Disallow・footer未リンクの
   公開方針は変更していない（引き続き未公開ドラフト）**。正式公開に進める場合は
   footerリンク追加・noindex解除・robots.txt解除が必要になるため、実施前に
   必ず提案する）

### 3-2. 後日確認予定の項目（現時点で追加対応不要、監視継続のみ）

2. **AdSense審査ステータスの定点観測**（2026-07-07確認時点で`Getting ready`のまま。
   ads.txt Authorized・Policy Center問題なし・Auto ads/Auto optimizeともON。
   **現時点で追加対応は不要。Readyになるまでは広告増設もしない方針**）
3. **Search Consoleで`/materials/business`・`/materials/news`のインデックス状況を
   1〜2週間後に再確認**（`/materials/toeic`は2026-07-07にインデックス登録済みを確認。
   残り2URLは「Googleに未検出」の状態で、noindex/robots/canonical等の技術的エラーは
   無いことを確認済み。1〜2週間様子見し、それでも未検出なら再確認する）
4. **Stripe初回実課金時のWebhook deliveryとPremium反映確認**（2026-07-07時点でも
   初回課金者なし。発生したらStripe決済成功・Webhook delivery成功・`is_premium=true`・
   `stripe_customer_id`/`premium_expires_at`保存・Premium機能解放・Premium広告非表示の
   7点を確認する）
5. **無効化済みStripe重複Webhook endpointの取り扱い**（2026-07-07にオーナーが方針を
   確定: 現時点では削除せず無効化のまま様子見。正規endpointで初回実課金のWebhook
   deliveryとPremium反映が確認できた後に、削除するかどうかを判断する）

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

**2026-07-07更新**: Vercel Cron・AdSense・Search Consoleの確認、および特商法ページの
運営者情報反映が完了したため、残るのは以下の項目。

1. **特商法ページの正式公開可否をオーナーが最終判断する**（唯一の「要アクション」
   項目。ページ内容自体は更新済みのため、あとは正式公開に進めるか・このまま
   非公開ドラフトを維持するかの判断待ち。正式公開に進める場合はfooterリンク
   追加・noindex解除・robots.txt解除が必要になるため、実施前に必ず提案する）
2. **Search Consoleで`/materials/business`・`/materials/news`のインデックス状況を
   1〜2週間後に再確認する**（すでに様子見中のため、日付が来たら確認するだけでよい）
3. **AdSense審査ステータスを引き続き定点観測する**（`Getting ready`から変化するまでは
   追加対応不要。Readyになるまで広告増設もしない）
4. **実課金が発生した際にStripeの配信ログとPremium反映を確認する**（発生タイミングは
   コントロールできないため、実際に発生したら都度対応する）
5. **無効化済みStripe重複Webhook endpointの取り扱いを判断する**（正規endpointでの
   初回実課金確認が前提のため、上記4の後で問題ない）

---

## 関連ドキュメント

- [LAUNCH_READINESS_CHECKLIST.md](LAUNCH_READINESS_CHECKLIST.md) — 各項目の詳細チェックリスト
- [PRODUCTION_MONITORING.md](PRODUCTION_MONITORING.md) — 日次/週次監視・異常時の詳細な調査手順
- [ADSENSE_SETUP.md](ADSENSE_SETUP.md) — AdSense審査状況・広告実装の詳細
- [SEARCH_CONSOLE_SETUP.md](SEARCH_CONSOLE_SETUP.md) — Search Console登録・週次の見方
- [NEXT_IMPROVEMENTS.md](NEXT_IMPROVEMENTS.md) — 優先順位付きの次の改善候補・残課題
