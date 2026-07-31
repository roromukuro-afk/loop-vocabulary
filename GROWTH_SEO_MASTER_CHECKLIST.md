# Growth / SEO / AEO / GEO / LLMO / SXO 統合マスターチェックリスト

作成日: 2026-07-28。作成の背景: 集客・SEO・AI検索・SXO全体の包括的改善指示への対応として、
既存実装の監査結果と実行計画をまとめたもの。

**重要な前提**: この監査で判明した最大の事実は、**要求された施策の大部分がすでに実装・運用されている**
ということ。既存の `HANDOFF.md` / `WORK_HISTORY.md` / `GROWTH_OS_ARCHITECTURE.md` / `GROWTH_90_DAY_ROADMAP.md` /
`SEO_INDEXING_POLICY.md` / `AI_SEARCH_AND_INDEXNOW_POLICY.md` / `TOOLS_SEO_ROADMAP.md` /
`MARKETING_X_*` 一式 / `ADSENSE_*` 一式 / `PRIVACY_CMP_ADSENSE_AUDIT.md` 等、既に30本以上の
専用ポリシー・ロードマップ文書と、対応する `scripts/testing/e2e/*.mjs`（74本）+
`scripts/testing/*.mjs`（54本）の自動テスト群が存在する。本チェックリストは、これらを
**重複して作り直すのではなく統合・棚卸しし、実際に手を付けた項目と残タスクを明確にする**もの。

凡例: `完了` `実装済み・計測待ち` `外部認証待ち` `データ蓄積待ち` `実行中` `未着手（根拠あり）`

---

## TECHNICAL_SEO

| ID | 施策 | 対象URL | 現状 | ステータス | 実装コミット/根拠 |
|---|---|---|---|---|---|
| T-01 | robots.txt `/road`が`/roadmap`まで誤ブロック | `/road`, `/roadmap` | 修正済み(`Disallow: /road` + `Allow: /roadmap`、Google最長一致で解決) | **完了** | PR #23 (merge `4b8c51a`), PR修正版 `454f5cf` |
| T-02 | `/roadmap` にcanonicalタグが存在しない | `/roadmap` | `alternates.canonical`追加済み | **完了** | PR #24 (merge `7ce8cc4`) |
| T-03 | `www.loop-vocabulary.app` 証明書未発行・アクセス不可 | `www.loop-vocabulary.app` | Vercelにdomain追加、308でapexへ、証明書発行確認済み | **完了** | Vercel dashboard操作(このセッション)、証明書warning解消を実測確認 |
| T-04 | `requireUser()`/`requireAdmin()`保護下15ページ以上にnoindexメタ未設定 | dashboard/settings/admin/*/test/*等38ページ | 全ページに`robots:{index:false,follow:true}`追加、本番反映済み | **完了** | PR #25 (merge `f0e909f`, 本番デプロイ`dpl_Cbwbtao6...`READY確認済み) — `SEO_INDEXING_POLICY.md`のTODO解消 |
| T-05 | `loop-vocabulary.vercel.app`→custom domain redirect | 全ページ | `next.config.js`の`hostRedirects`で既に308実装済み、実測確認済み | **完了(既存)** | 既存実装、`test:canonical-domain-redirect`で継続監視 |
| T-06 | canonical自己参照の網羅チェック | 全indexページ | `test:canonical-integrity`で継続監視、本ラウンドでも全PASS | **完了(既存)** | 既存テスト |
| T-07 | sitemap分割(`/sitemap-static.xml`等) | sitemap.ts | 現状167件・上限5万件に遠く及ばないため分割不要と判断済み | **未着手（根拠あり）** | `SEO_INDEXING_POLICY.md`に判断根拠記載済み。辞書語ページ等が数千件規模に増えた時点で再検討 |
| T-08 | HTTPS統一 | 全ページ | http→https、www→apex、vercel.app→apexいずれも実装・実測確認済み | **完了(既存+本ラウンド)** | next.config.js + Vercel domain設定 |
| T-09 | robots.txtでAIクローラー個別指定(GPTBot/OAI-SearchBot等) | robots.txt | **本番マージ・反映済み**(PR #31、merge `0dc94d1`)。OAI-SearchBot/PerplexityBotは`User-agent: *`と同一許可、GPTBot/ClaudeBot/Google-Extendedは全面ブロックがデフォルト(理由はrobots.txt内コメント+`AI_SEARCH_AND_INDEXNOW_POLICY.md`に記載、1行変更で可逆)。本番`/robots.txt`で全ボットの設定を直接確認済み | **完了** | PR #31。回帰テスト`test:ai-crawler-llms-policy`(各ボットの意図した挙動を厳密assert)を`pr-ci-checks.mjs`/`run-e2e.mjs`双方に接続済み |
| T-10 | Bing Webmaster Tools登録確認 | サイト全体 | コードからは確認不可、Bing管理画面での登録要 | **外部認証待ち** | https://www.bing.com/webmasters/ でのサイト登録要確認 |
| T-11 | IndexNow実装 | 更新系全般 | **完了(本番初回送信確認済み)**(PR #32、merge `8c6fbc0`)。キーファイル・`submitUrlsToIndexNow()`・週次cron(`/api/cron/indexnow-sitemap-sync`)を実装。本番でキーファイル(`/724d6efdf17808d5069e6c8d78fa98bc9cd413ab302de6c35be0e113338da741.txt`)が200・プレーンテキスト・内容が鍵の値と完全一致することを確認済み。cronの認証(`CRON_SECRET` Bearer)が本番で正しく401を返す(未認証・誤った値)ことも確認済み。`INDEXNOW_KEY`をVercel Productionへ設定・再デプロイ済み(2026-07-29、`dpl_EzSjoxnvdLX7ScSGZtEt18xa3JDD`)。**本番初回手動送信結果(2026-07-29、`/admin/indexnow`)**: 管理API HTTPステータス200、内部結果`ok=true`、`totalUrls=170`、`submittedCount=170`、`skippedCount=0`、error無し。`submitUrlsToIndexNow()`は`res.ok`(2xx)の場合のみ`ok:true`を返す実装(ソースコードで確認済み)であり、UIの✅表示も`result.ok`の場合のみ描画されるため、IndexNow外部APIが2xxで正常受理したことを確認できる。**ただし外部APIの正確なステータス番号(200か202か)は管理画面の表示に含まれておらず未確認のまま**(「2xx成功」として記録、200/202を推測しない)。週次cronによる全URL再送信に加え、**教材(materials)のページ個別即時通知が完了**(PR #52、merge `fc78c7c`、`/api/admin/materials`・`/api/admin/materials/[id]`・`/api/admin/materials/[id]/words`新設、実際の公開可否(`is_public`かつ`license_status`承認済み)の遷移時に`after()`経由でその1URLだけを即時送信。可視性反転はデデュープをバイパスし取りこぼさない設計。本番デプロイ・本番での実際の発火(作成→公開→削除の一連の操作を本番APIへ実行し200・DB遷移・ページ反映を確認)まで確認済み。ただし外部IndexNow API側の2xx受理はVercelランタイムログから観測できず未確認のまま記録。詳細は`AI_SEARCH_AND_INDEXNOW_POLICY.md`「ページ個別の即時通知」参照)。**教材以外(ガイド記事・辞書語ページ・無料ツール・URLリダイレクト)のページ個別即時通知も実装・マージ・本番デプロイ・push発火まで完了**(PR #54、merge `cd347f6`、`.github/workflows/indexnow-static-content-notify.yml`新設。これらは静的な配列・設定で定義されgit+Vercelビルド時にのみ更新される性質のため、mainへのpush前後のコミット間で実際に生成される公開URL集合を比較する方式で実現。マージ後の実push(`96a563f`→`cd347f6`)でworkflowが実際に起動し成功したことを確認済みだが、この回は検出対象0件(スクリプト・テストのみの変更のため想定どおり)。**`autonomous-improvement` Environmentへ`INDEXNOW_KEY`が追加されたことを`gh secret list`で確認済み(2026-07-31)だが、追加後まだガイド記事等を変更するpushが発生していないため外部API送信自体は未検証**。詳細は完了項目サマリ19番参照)。残タスクは(1)実際にガイド記事等を変更する次のpushでの外部API実送信確認(GitHub Actionsログで`ok`・HTTPステータスを直接確認可能)、(2)Bing Webmaster Tools登録・送信状況監視、(3)IndexNow経由のインデックス・流入成果測定 | **完了(コード実装・本番マージ・`INDEXNOW_KEY`設定・本番初回送信すべて確認済み)。教材のページ個別即時通知は実発火まで確認済み。教材以外はマージ・本番デプロイ・push発火・`INDEXNOW_KEY`設定まで確認済みだが、外部API実送信は次のコンテンツ変更pushで確認予定** | PR #32。`test:indexnow-submit`・`test:indexnow-sitemap-sync-cron`で検証。教材の即時通知は`test:materials-visibility`・`test:admin-materials-api`・`test:admin-materials-words-import-api`・`test:admin-materials-words-import-notify-invariant`で検証(PR #52)。教材以外は`test:indexnow-static-content-diff-extraction`・`test:indexnow-static-content-diff-integration`で検証(PR #54) |
| T-12 | llms.txt | サイト全体 | **本番マージ・反映済み**(PR #31、merge `0dc94d1`)。`public/llms.txt`が本番で200・`Content-Type: text/plain; charset=utf-8`で配信されていること、記載された全11 URLが本番で200を返すことを直接確認済み。実在ルートへのリンクのみ、架空の数値・実績は記載なし。SEO効果は誇張せず案内・引用補助としてのみ位置づけ | **完了** | PR #31。`test:ai-crawler-llms-policy`で全リンクの実在確認・404チェックを実施 |

## ON_PAGE_SEO

| ID | 施策 | 現状 | ステータス |
|---|---|---|---|
| P-01 | JSON-LD構造化データ | Organization/WebSite(全ページ共通)、WebApplication+Offer+FAQPage(`/`)、Article+DefinedTerm+DefinedTermSet+BreadcrumbList(辞書語ページ)、Article+BreadcrumbList+FAQPage(guide 40本中大半)、ItemList等、広範に実装済み | **完了(既存)** |
| P-02 | パンくずJSON-LDと画面表示の不整合 | `src/components/ui/Breadcrumb.tsx`を新設しPR #34で本番反映済み(merge `9ff4dbc`)。guide記事32本中27本をPR #34で実装。フォローアップPR #38(eiken-conversation・toeic-tango)・PR #39(daigaku-juken-tango)・PR #37(chugaku-eigo-tango)・PR #40(business-english-tango)がすべてマージ済みで**32/32完了**。guide一覧・dictionary(一覧+語ページ)・materials一覧+7カテゴリページ・tools・ピラーページも完了済み。**唯一の未対応**: `/materials/[id]`は動的ラベル使用時にE2Eテストが再現性100%で失敗する既知の技術的問題があり対象外(詳細はPR #34本文・コミット履歴) | **完了(32/32ガイド記事+主要ページ、`/materials/[id]`のみ技術的課題により意図的に保留)** |
| P-03 | alt属性 | 全体で`&lt;img&gt;`/`next/image`使用がほぼ皆無(唯一の`&lt;img&gt;`はPDF内QRコード、alt付き)なテキスト主体サイトのため、alt不足リスクは実質的に低い | **完了(該当箇所僅少・対応済み)** |
| P-04 | 内部リンク・関連記事導線 | 31本のguideページ・materials詳細・dictionary詳細に「関連記事/関連教材」導線は存在するが、共通コンポーネント化されておらず各ページが個別にハードコード | **実行中** — 共有コンポーネント化は技術的負債として次ラウンド候補(機能的には動作、優先度中) |

## CONTENT_SEO

| ID | 施策 | 現状 | ステータス |
|---|---|---|---|
| C-01 | トピッククラスタ構造 | `/guide`は40記事をフラット配列+`TAG_TO_CATEGORY`で12カテゴリに再編済み（覚え方/英検対策/TOEIC対策等）、カテゴリジャンプナビ+`ItemList` JSON-LD実装済み | **完了(既存)** |
| C-02 | カニバリ解消・記事統合 | `next.config.js`に`guideRedirects`で統合済みの旧URLリダイレクト1件を確認(2026-07-21実施)。継続的な監査が`GUIDE_REWRITE_PRIORITY.md`にあり | **実装済み・継続監視** |
| C-03 | ロングテール記事の追加改稿 | `GUIDE_REWRITE_PRIORITY.md`に上位候補記事の残りリストあり(未全面改稿分) | **実行中(既存バックログ)** |
| C-04 | 試験情報の最終確認日・出典 | 英検/TOEIC記事の一部で既に対応済み(過去ラウンドのコミット履歴で確認: 断定表現の除去、根拠のない数値の削除等) | **実装済み・横展開継続中** |

## AEO / GEO / LLMO

| ID | 施策 | 現状 | ステータス |
|---|---|---|---|
| A-01 | 直接回答フォーマット | FAQPage JSON-LD+可視FAQセクションが`/`、4つの目的別LP、`/premium`等に実装済み。ただし「冒頭で質問に即答する」形式の網羅監査は未実施 | **データ不足/要監査** |
| A-02 | AIクローラー区別(検索流入用 vs 学習データ用) | 本番マージ・反映済み(T-09と同一、PR #31) | **完了** |
| A-03 | llms.txt | 本番マージ・反映済み(T-12と同一、PR #31) | **完了** |
| A-04 | AI経由流入の計測・成果検証 | 専用実装は無いが、GA4の「トラフィック獲得」レポートでリファラベースに`chatgpt.com`/`perplexity.ai`等を現状でも確認可能(コード変更不要)。**ただし実際にこのレポートを確認して流入があるかどうかを検証した実績はまだ無く、T-09/T-12のポリシー導入がAI検索経由の流入・引用に効果があったかどうかの成果検証も未実施**。robots.txt/llms.txtの導入自体は「AIクローラーに正しい許可/ブロック設定と発見補助を提供した」ことの完了であり、それが実際の流入・引用増加につながったかの検証は別工程として残っている | **実装済み(GA4標準機能で代替可)・計測/成果検証は未着手** |

## SXO

| ID | 施策 | 現状 | ステータス |
|---|---|---|---|
| S-01 | ページ別の次の行動導線 | 辞書→単語帳追加、guide→CTA、教材→学習開始等、既存実装で概ね充足 | **実装済み(既存)** |
| S-02 | 登録前価値提供 | 語彙診断・辞書検索は既に未ログインで利用可能(2026-07-01ラウンドで`/dictionary`を未ログイン化済み) | **完了(既存)** |
| S-03 | 登録後オンボーディング | `OnboardingModal`・`FirstStepsGuide`が`/dashboard`に実装済み | **実装済み(既存)** |

## FREE_TOOL

**注記**: 当初のチェックリストにこのカテゴリが独立した表として存在しておらず、
「新規に発見したギャップ」に間接的に記載されているのみだった(19カテゴリ要件からの漏れ)。
本ラウンドで独立表として追加。実装順は2026-07-28継続指示のワークストリームD本文が権威あるソース。

| ID | 施策 | 対象URL | 現状 | ステータス |
|---|---|---|---|---|
| FT-01 | 語彙力チェックの検索・共有・登録導線強化(実装順1番) | `/vocab-check` | 既存実装(20問・3分診断・シェアカード)。SEO/共有導線の追加強化は未着手 | **未着手** |
| FT-02 | 復習日計算ツール(実装順「試験日から逆算する学習計画」相当の一部を先行実装) | `/review-date-calculator` | 新規実装・本番反映済み。アプリの実SRS固定間隔(1/3/7/14/30日)を使用、V1/V2の違いを明記 | **完了** |
| FT-03 | 英単語リスト整形・CSV変換ツール | (未実装) | `PLANNED_TOOLS`に記載のみ、コード未着手 | **未着手** |
| FT-04 | 英単語小テスト作成 | `/guide/english-vocabulary-quiz-maker`等の記事は既存、専用UIツールとしては小テストPDF機能が実質これに相当 | 既存のPDF小テスト機能で大部分カバー済み、追加のスタンドアロンUIは優先度低 | **実装済み(既存機能でカバー)** |
| FT-05 | PDF作成 | 既存のPDF小テスト作成機能 | 実装済み | **完了(既存)** |
| FT-06 | 発音・カタカナ読み検索 | (未実装) | 精度の限界について正直な注記が必要(架空情報禁止遵守) | **未着手** |
| FT-07 | 似た意味の単語比較(類義語比較) | `/guide/affect-vs-effect`・`/guide/apply-for-vs-apply-to` | PR #41で新規実装(品詞・前置詞の違いを軸にした解説記事2本)。マージ済み | **完了(PR #41)** |
| FT-08 | 不規則動詞一覧・テスト | `/guide/fukikisoku-doushi-ichiran` | PR #42で「一覧」部分のみ新規実装(全部同じ型・ABB型・ABA型・ABC型+例外のAAB型の5パターン分類一覧記事)。マージ済み。**「テスト」機能(インタラクティブな確認テスト)は未実装のまま** | **一覧のみ完了(PR #42)、テスト機能は未着手** |
| FT-09 | 今日覚える英単語 | (未実装) | | **未着手** |
| (追加) | 試験日から逆算する学習計画メーカー(FT-02の完全版、独立ツールとして実装) | `/exam-countdown-planner` | PR #43で新規実装。試験日+単語数から最短ペースと復習7日確保ペースの2パターンを算出。`/tools`のPLANNED_TOOLSからLIVE_TOOLSへ移動。マージ済み | **完了(PR #43)** |

## ANALYTICS

| ID | 施策 | 現状 | ステータス |
|---|---|---|---|
| N-01 | GA4基本計測 | `NEXT_PUBLIC_GA_ID`設定時に`gtag.js`読み込み、`src/lib/analytics/events.ts`に約35個の`track*()`関数実装済み | **完了(既存)** |
| N-02 | Growth OS(ファーストパーティ計測基盤) | `src/lib/analytics/eventSchema.ts`(16対象イベントのうち10個が完全一致名で既存、詳細は下表)、`trackServerEvent.ts`、日次rollup、`/admin/growth`ダッシュボード(概要/コホート/実験/インサイト/推奨/週次レポート)が**既に構築・運用中** | **完了(既存、想像以上に成熟)** |
| N-03 | ダッシュボード(流入/CTR/登録/継続/Premium) | `/admin/growth`・`/admin/growth/reports`・`/admin/stats`が既に存在し概ね要求仕様をカバー | **完了(既存)** |

### 指定16イベントの現状(このラウンドの監査で確認)

| イベント名 | 状態 |
|---|---|
| `signup_cta_click` | 完了(既存) |
| `vocab_check_started` | 完了(既存) |
| `vocab_check_completed` | 完了(既存) |
| `signup_started` | 完了(既存) |
| `signup_completed` | 完了(既存) |
| `first_test_completed` | 完了(既存) |
| `first_review_completed` | 完了(既存) |
| `material_viewed`(`material_view`という名で実装) | 実装済み(命名差異のみ) |
| `word_added`(GA4のみ、Growth OS側は`dictionary_word_added`等の派生イベント) | 実装済み(命名差異のみ) |
| `tool_started` / `tool_completed` | rollup層のエイリアスとしてのみ存在、直接発火するイベントではない | 実行中(要判断: 別名運用を維持するか実イベント化するか) |
| `wordbook_created` | PR #27で実装・マージ済み(merge `bab5075`)。material import/import-shared/custom作成の3経路すべてで、単語帳作成+単語insertまで全成功しrollback経路に入らないことが確定してから発火。本番DBで動作確認済み | **完了** |
| `first_test_started` | PR #27で実装・マージ済み(merge `bab5075`)。`first_test_completed`と対称、localStorageで1デバイス1回 | **完了** |
| `return_next_day` / `return_day_7` | PR #27で実装・マージ済み(merge `bab5075`)。部分ユニークインデックス+`SECURITY DEFINER`関数によるatomic dedup(supabase/migrations/024〜027)。並行cron実行での重複防止をテストで確認、本番DBの関数定義・インデックス定義・権限が2026-07-29時点で一致することを確認済み | **完了** |
| `premium_started` | 未実装(`subscription_started`/`checkout_started`が近似) | 実行中(命名統一を検討) |

## CRO

| ID | 施策 | 現状 | ステータス |
|---|---|---|---|
| R-01 | CTA文言・A/Bテスト | 過去ラウンドで複数回実施済み(SRS訴求文言変更等)、履歴は`WORK_HISTORY.md`に記録 | **実装済み・継続中** |

## RETENTION

| ID | 施策 | 現状 | ステータス |
|---|---|---|---|
| E-01 | 復習リマインド | Vercel Cronで`daily-push`(毎日0時UTC)・`weekly-digest`(毎週日22時UTC)実装済み | **完了(既存)** |
| E-02 | 連続学習・ストリーク表示 | `computeStreak`・`StreakShareCard`・`StreakTracker`が`/dashboard`等に実装済み | **完了(既存)** |
| E-03 | 継続率の指標化(翌日/7日/30日) | `return_next_day`/`return_day_7`イベントがPR #27で実装・マージ済み(merge `bab5075`)。イベント発火は動作するが、実際の継続率データはこれから日次cronの稼働により蓄積される | **実装済み・データ蓄積待ち** |

## SOCIAL

| ID | 施策 | 現状 | ステータス |
|---|---|---|---|
| SO-01 | X(Twitter)投稿計画・テンプレ・分析 | `MARKETING_X_30DAY_CALENDAR.md`・`MARKETING_X_PLAYBOOK.md`・`MARKETING_X_POST_TEMPLATES.md`・`MARKETING_X_ANALYTICS_TEMPLATE.md`・`MARKETING_X_SCHEDULE_READY.md`が既に整備済み | **完了(既存)** |
| SO-02 | ショート動画展開 | `SHORT_VIDEO_CONTENT_QUEUE.md`・`SHORT_VIDEO_GROWTH_PLAN.md`が既に整備済み | **実装済み・計測待ち** |
| SO-03 | 31日目以降のXカレンダー継続 | 30日計画の次のサイクル未作成 | **実行中(既存バックログ、`GROWTH_90_DAY_ROADMAP.md` Month3記載)** |
| SO-04 | 主要10テーマのマルチプラットフォーム素材(X/Instagram/Shorts/TikTok/Pinterest) | `MARKETING_10THEMES_CONTENT_KIT.md`作成・マージ済み。UTM・OGP方針・架空情報禁止の遵守を明記 | **実装済み・投稿実行待ち**(OGP画像制作・実際の投稿操作はユーザー確認後) |

## BACKLINK

| ID | 施策 | 現状 | ステータス |
|---|---|---|---|
| B-01 | プレスページ | `/press`実装済み(概要・スクショ・開発者情報・機能・料金・問い合わせ) | **完了(既存)** |
| B-02 | 教員向けPDF小テストガイド(被リンク資産) | `/guide/vocabulary-quiz-pdf-for-teachers`実装済み | **完了(既存)** |
| B-03 | 教育メディアへの紹介依頼(手動営業) | 未着手、`GROWTH_90_DAY_ROADMAP.md` Month3に記載 | **外部人力作業待ち** |

## PERFORMANCE

| ID | 施策 | 現状 | ステータス |
|---|---|---|---|
| PF-01 | 画像最適化(WebP/AVIF/`next/image`) | `src/`全体で`next/image`・`&lt;img&gt;`使用がほぼ皆無(テキスト主体サイト)のため、現時点で最適化対象自体が僅少 | **完了(該当箇所僅少)** |
| PF-02 | フォント最適化 | `next/font`不使用、Tailwindデフォルトのシステムフォントスタックのみ使用(カスタムフォント読み込みなし=追加リクエスト0) | **完了(既に最適)** |
| PF-03 | 依存関係の肥大化チェック | chart/animation系ライブラリ・moment.js・lodash等の重量ライブラリなし、依存関係はリーン | **完了(既に良好)** |
| PF-04 | Cache-Control/CDN設定 | `next.config.js`に`headers()`定義なし(Next.js/Vercelのデフォルト任せ)。CDN自体はVercelで既に提供されている | **実行中(要検討: 明示的なCache-Control設定の検証)** |

## ACCESSIBILITY

| ID | 施策 | 現状 | ステータス |
|---|---|---|---|
| AC-01 | aria属性・role属性 | `aria-`使用は全体で6箇所のみ(`src/components`2件・`src/app`4件)、`role=`属性は0件。第1弾(中核学習フロー)・第2弾(独自モーダル3箇所)・第3弾の一部(`DictionarySearch`・`GuideEmailCapture`、PR #59・本番確認済み)・第4弾(テスト解答欄3ファイル、PR #60・本番確認済み)を修正済み(下記参照)。第3弾の再調査で発見した追加9ファイルのうち、第4弾で3ファイル・第5弾で3ファイル(`QuickAddWord`・`CreateClassForm`・`DisplayNameForm`)を対応済み、残り3ファイル(`materials/page.tsx`・`ExtractWordsClient`・`ContactForm`)は未着手。加えて、(2)非同期処理結果の`aria-live`不足も未着手 | **一部完了(中核学習フロー・独自モーダル・フォームラベルの大部分、本番確認済み)・残り未着手分あり(3ファイル+aria-live)** |
| AC-02 | 画像alt | 実質的に画像使用がほぼ無いため対象範囲は小さい(PF-01と同根拠) | **完了(該当箇所僅少)** |

## ADSENSE

| ID | 施策 | 現状 | ステータス |
|---|---|---|---|
| AD-01 | 広告表示ルートのホワイトリスト化 | `src/lib/ads/adRoutePolicy.ts`で`/`・`/materials`・`/guide`・`/dictionary/[word]`のみ許可、操作画面(dashboard/wordbooks/admin等)は広告ゼロ | **完了(既存)** |
| AD-02 | ads.txt / Publisher ID | `public/ads.txt`に`pub-5148247638505100`設定済み、AdSenseメタタグも設置済み | **完了(既存)** |
| AD-03 | CMP(同意管理プラットフォーム) | PR #29でGoogle Funding Choices CMPタグをサイト全体に実装・マージ済み(merge `08ae340`)。本番で`<script async src="https://fundingchoicesmessages.google.com/i/pub-5148247638505100?ers=1">`の出力、`/privacy`の「広告のパーソナライズ設定を変更する」ボタンの表示・クリック時無エラーを確認済み。**コード実装は完了だが、AdSense管理画面でのGDPR同意メッセージ本体の作成・公開が別途必要(AD-04参照)。それが完了するまでEEA/UK/スイス向けの実際の同意バナーは表示されない** | **コード実装完了・AdSense管理画面での公開作業待ち** |
| AD-04 | AdSense管理画面側の設定確認(CMP/ads.txt Authorized状態) | コードから確認不可。**ユーザー操作待ちの手順**: (1)AdSense「プライバシーとメッセージ」でEEA/UK/スイス向けGDPR同意メッセージを作成、(2)対象地域(EEA・英国・スイス)を設定、(3)同意前のデフォルト広告設定(非パーソナライズ広告等)を確認、(4)13歳未満・未成年者向け設定を確認、(5)メッセージを公開、(6)EEA相当の環境からアクセスして実際に同意バナーが表示されることを確認、(7)ads.txt Authorized状態の確認 | **外部認証待ち(ユーザー操作待ち)** |

## PRIVACY

| ID | 施策 | 現状 | ステータス |
|---|---|---|---|
| PR-01 | 個人情報の非保存方針 | `ai_usage_events`はプロンプト本文を保存しない設計を徹底(コメントで明記)。旧テーブル`ai_usage_logs`はGrowth OS集計対象から除外済み | **完了(既存)** |
| PR-02 | プライバシーポリシーの正確性 | `PRIVACY_CMP_ADSENSE_AUDIT.md`で監査済み | **完了(既存)** |

## BING

| ID | 施策 | 現状 | ステータス |
|---|---|---|---|
| BI-01 | Bingへのsitemap自動検出 | robots.txtに`Sitemap:`行あり、Bing側で登録済みなら自動検出可能 | **実装済み(既存)** |
| BI-02 | Bing Webmaster Tools登録状況確認 | T-10と同一 | **外部認証待ち** |

## EXPERIMENT

| ID | 施策 | 現状 | ステータス |
|---|---|---|---|
| EX-01 | 実験基盤(割り当て・露出・コンバージョン計測) | `experiments`テーブル、`test:experiment-assignment`・`test:experiment-statistics`が既存 | **完了(基盤は既存)** |
| EX-02 | 実際の実験の実施・記録 | 基盤はあるが本ラウンドで新規実験は開始していない | **データ蓄積待ち** |

---

## このラウンドで実際に完了した項目(実装・テスト・PR・本番反映まで)

1. **PR #23**: `robots.txt`の`/road`が`/roadmap`まで誤ブロックしていた問題を修正(2段階の修正: 初回`Disallow: /road$`は誤りと判明し訂正、最終的に`Disallow: /road` + `Allow: /roadmap`のGoogle最長一致方式で解決)。回帰テスト`scripts/testing/e2e/robots-sitemap-collision.mjs`新設。本番反映・確認済み。
2. **PR #24**: `/roadmap`にcanonicalタグが存在しなかった問題を修正。`test:canonical-integrity`拡張。本番反映・確認済み。
3. **`www.loop-vocabulary.app`のドメイン追加**: Vercelプロジェクトに308リダイレクト付きで追加、証明書発行・エラー解消を実測確認。
4. **Search Console対応**: `eigo-listening-renshu`のcanonical不一致でValidate Fix開始、インデックス登録リクエスト実行。`/roadmap`はインデックス登録完了を確認。
5. **PR #25**(本ラウンド): `SEO_INDEXING_POLICY.md`のTODOだった、38ページへのnoindexメタデータ追加。`test:indexing-policy`拡張。マージ・本番デプロイ・READY確認まで完了(merge `f0e909f`)。
6. **本チェックリスト**の作成・既存30本以上のポリシー文書との統合。
7. **PR #31**: robots.txtへのAIクローラー個別指定(OAI-SearchBot/GPTBot/ClaudeBot/Google-Extended/PerplexityBot)+`public/llms.txt`新規作成。T-09/A-02/T-12/A-03クローズ。**マージ・本番反映済み**(merge `0dc94d1`)。本番`/robots.txt`・`/llms.txt`を直接取得し、全ボットの許可/ブロック設定・Content-Type・掲載URL全11件の200応答・console errorなしを確認済み。**ただしAI検索施策全体としては未完了**: AI経由流入の実際の計測・成果検証はまだ実施していない(A-04参照)。
8. **PR #32**: IndexNowキーファイル・送信ユーティリティ・週次cron再送信ルート実装。**完了**(merge `8c6fbc0`)。本番でキーファイル配信(200・text/plain・内容完全一致)・cron認証(未認証/誤認証で401)・`INDEXNOW_KEY`設定(2026-07-29)・本番初回送信(170 URL送信・0スキップ・`ok=true`・外部API 2xx成功)をすべて確認済み。外部APIの正確なステータス番号(200/202)は管理画面表示に含まれず未確認のまま記録。残るのはページ個別の即時通知(公開/更新/削除時、別PR課題)・Bing Webmaster Tools登録と送信状況監視(ユーザー手動作業)・IndexNow経由の成果測定の3点のみ。
9. **PR #33**(本ラウンド): 復習日計算ツール(`/review-date-calculator`)新規実装。アプリの実SRS固定間隔を使用、V1/V2の違いを明記。マージ・本番反映済み(merge `a87fe68`)。
10. **PR #34**(本ラウンド): 「英単語の覚え方」ピラーページ+サイト共通の視覚的パンくずUIコンポーネント新設、32本中27本のガイド記事・辞書・教材7カテゴリページに展開。P-02ほぼクローズ(`/materials/[id]`は既知の技術的理由で対象外、詳細は次項)。
11. **PR #30**(本ラウンド): 主要10テーマのSNS素材キット(X/Instagram/Shorts/TikTok/Pinterest)作成。マージ済み(merge `d14a316`)。
12. **PR #38**(本ラウンド): PR #34のパンくずフォローアップ第2弾、eiken-conversation・toeic-tango 2記事に展開。マージ済み(merge `3d564eb`)。
13. **PR #39**(本ラウンド): PR #34のパンくずフォローアップ、daigaku-juken-tango 1記事に展開(quality-gate 20分タイムアウト回避のため単一ファイルPRに分割)。マージ済み(merge `82e5b00`)。
14. **PR #37・#40**(本ラウンド): 残るchugaku-eigo-tango・business-english-tangoへのパンくず展開。各1ファイルPRに分割してマージ済み(merge `fef807f`・`b95a0c1`相当)。これによりP-02は32/32ガイド記事完了(`/materials/[id]`のみ既知の技術的理由で対象外)。
15. **PR #41・#42・#43**(本ラウンド): 混同しやすい単語ペア解説(affect-vs-effect・apply-for-vs-apply-to、FT-07)、不規則動詞一覧(fukikisoku-doushi-ichiran、FT-08「一覧」部分)、試験日逆算学習計画メーカー(exam-countdown-planner、FT-02の完全版)を新規実装・マージ済み。いずれもchatgpt-codex-connectorのレビュー指摘(表内Markdown太字が未レンダリング/AAB型動詞の欠落/試験当日ラベル誤り/小数単語数入力)を修正済み。
16. **PR #44**(本ラウンド): 上記進捗を反映したマスターチェックリスト更新。マージ済み。
17. **PR #27**(本ラウンド): Growth OSイベント(`wordbook_created`/`first_test_started`/`return_next_day`/`return_day_7`)実装。DB挿入失敗の誤成功報告・D1/D7重複防止のatomic化・イベント発火位置の是正などレビュー指摘4件へ全面対応後、本番Supabaseへ適用済みだったDBマイグレーション(部分ユニークインデックス+`SECURITY DEFINER`関数、supabase/migrations/024〜027)をリポジトリへ記録し、owner承認を得てマージ済み(merge `bab5075`)。本番デプロイREADY確認済み、本番DBの関数定義・インデックス定義・権限・重複ゼロを再確認済み。
18. **教材のページ個別IndexNow即時通知** — **完了(コード実装・本番マージ・本番デプロイ・本番での実際の発火まですべて確認済み)**(PR #52、merge `fc78c7c`)。`MaterialAdminTable.tsx`のブラウザ直接Supabase書き込みを`/api/admin/materials`・`/api/admin/materials/[id]`・`/api/admin/materials/[id]/words`へ移行し、実際の公開可否(`is_public`かつ`license_status`承認済み)の遷移時に`after()`経由で該当URLのみをIndexNowへ即時送信するよう実装。可視性の反転(公開⇄非公開・削除)はデデュープを明示的にバイパスし(`bypassDedupe:true`)、10分以内の反転通知が握りつぶされないようにした(chatgpt-codex-connectorのP2指摘対応)。公開教材への単語インポート(`ImportPanel.tsx`)も同じルート経由に統一し、内容更新時は通常のデデュープを維持したまま最大1回だけ通知する。
    - **本番デプロイ確認**: `dpl_3aejATEQ7u3MhQure3SaiPjMncxP`がREADY・`loop-vocabulary.app`へalias済みを確認。
    - **本番E2E確認**: `admin-materials-canary.yml`を手動実行し、`test:admin-materials-api`(13件)・`test:admin-materials-words-import-api`(10件)がすべて本番相当の実DB・実ログインで成功、テスト用教材のDB残留なしを確認。
    - **本番での実際の発火確認**: test+adminアカウントで本番(`https://loop-vocabulary.app`)へログインし、実際に教材を作成→公開(`is_public:true`+`license_status:approved`、200)→`/materials/{id}`が直後に200で公開済みとして表示されることを確認→削除(200)する一連の操作を実施。作成・公開・削除いずれも本番APIが200を返し、DBの可視性遷移(非公開→公開→消滅)が実際に発生したことを確認済み。**ただし外部IndexNow APIがこの実送信を実際に2xxで受理したかどうかは、Vercelランタイムログ(`get_runtime_logs`)では`console.log`/`console.error`の内容までは見えず(リクエスト単位のメソッド/パス/ステータスの要約のみ)、他に観測できる手段が無いため未確認のまま記録する(T-11の週次resyncと同じ制約。2xx/失敗いずれも推測しない)**。テスト後、`TEST_%`の残留データがDBに無いことも確認済み。
19. **静的コンテンツ(ガイド記事・辞書語ページ・リダイレクト)のページ個別IndexNow即時通知** — **実装・マージ・本番デプロイ・push発火まで確認済み。ただし外部IndexNow APIへの実際の送信は未確認(理由は後述)**。教材(DBテーブル、実行時の書き込みイベントあり)と異なり、ガイド記事(`sitemap.ts`の`GUIDE_SLUGS`)・辞書語(`src/lib/dictionaryWords/pilotWords.ts`の`PILOT_WORDS`)・リダイレクト(`next.config.js`の`guideRedirects`)はすべてgit commit + Vercelビルドでのみ公開/更新される静的データであり、実行時の書き込みルートが存在しない。このため`main`へのpushそのものを公開/更新イベントとみなし、push前後のコミット間で実際に生成される公開URL集合の差分を取って変更のあったURLだけをIndexNowへ通知する`scripts/improvement/notify-indexnow-static-content-diff.mjs`(+ `.github/workflows/indexnow-static-content-notify.yml`、push:main トリガー)を新規実装した。新規公開・削除に相当する変更(新規ガイド記事・新規/削除辞書語・新規リダイレクト)はデデュープを明示的にバイパスして送信し、既存ページの内容更新(パンくず修正等)は通常のデデュープを維持したまま送信する(教材と同じ設計方針)。PR #54として実装、chatgpt-codex-connectorのP1(root-relative pathをそのまま送信していた絶対URL化漏れ)・P2×2(動的`[slug]`ルート型ガイド記事・非ガイド静的ページの内容更新検出漏れ)の指摘3件すべてに対応し(`toAbsoluteUrl`/`extractDynamicGuideArticles`/`pageFilePathToUrl`を新設)、owner承認を得てマージ済み(merge `cd347f6`)。
    - **検証済み**: 実際の過去コミット(`9ff4dbc`新規ガイド記事・`3c51fe7`専用ディレクトリ型更新・`52937e4`動的`[slug]`型更新・`bb97cf8`辞書追加/更新・`bb97cf8`→`265ad34`辞書削除・`2146e0e`新規リダイレクト・`341d481`/faq更新・`96a563f`自己diff)に対する統合テスト(`test:indexnow-static-content-diff-integration`)で、最終送信payloadが全件絶対URL・hostがsite baseと一致・existence側はbypassDedupe/content側は通常dedupeで呼び出されることまで確認。単体テスト(`test:indexnow-static-content-diff-extraction`)34件、`npm run typecheck`・`npm run lint`・`npm run build`・既存の`test:indexnow-submit`回帰テストもすべて成功。**正直な訂正(chatgpt-codex-connectorのP2指摘、PR #55で対応)**: 当初動的`[slug]`型更新の検証には`fecf684`を使っていたが、squash mergeでPR #42がマージされた際にfeature branchが削除され、`fecf684`はorigin/mainのどのrefからも到達不能になっていたことが判明した(`git merge-base --is-ancestor fecf684 origin/main`がfalseを返すことで確認、ローカルworktreeには過去のfetch残骸としてオブジェクトが残っていたため見かけ上は通っていた)。origin/mainから実際に到達可能な`52937e4`へ差し替えて再検証済み。
    - **本番デプロイ確認**: マージ後のVercel production deployment `dpl_8udqTmVfnwJz8D7Jv6rueSu2jNUC`がREADY(2026-07-31T00:43:32Z、push後約88秒)・`loop-vocabulary.app`/`www.loop-vocabulary.app`へalias済みを確認。
    - **push発火確認**: `main`へのマージpush(`96a563f`→`cd347f6`)で`indexnow-static-content-notify.yml`が実際に起動(run 30594287256、`conclusion=success`)し、before/afterのSHAが正しく`96a563f`/`cd347f6`であることをログで確認。ワークフローの150秒固定待機(00:42:21開始)は本番READY時刻(00:43:32、push後約88秒)より約79秒長く、本番反映前に検出処理へ入ってしまうことは無かった(ただし1回の観測のみであり、将来ビルドが長引いた場合の余裕を保証するものではない。より確実にするならVercel deployment READY状態を明示的にポーリングする方式への改善が考えられるが、新規secret(`VERCEL_TOKEN`)を要求せずに済む固定待機の簡便さを優先し今回は採用しなかった設計判断を維持)。
    - **この回の検出結果**: このpush自体(`96a563f`..`cd347f6`)はスクリプト・テスト・ドキュメントのみの変更で、`GUIDE_SLUGS`・`PILOT_WORDS`・`guideRedirects`・ガイド本文・非ガイド静的ページのいずれも変更していないため、`可視性変化: 0件`・`内容更新: 0件`で「通知対象のURLなし」と正しく終了した(ログで確認、バグではなく想定どおりの検出結果)。
    - **`INDEXNOW_KEY`追加確認(2026-07-31)**: リポジトリ管理者が`autonomous-improvement` GitHub Environmentへ`INDEXNOW_KEY`を追加。`gh secret list --env autonomous-improvement`で`INDEXNOW_KEY`(登録日時2026-07-31T02:19:28Z)が存在することを確認済み(値そのものは表示・出力していない)。
    - **PR #55(訂正PR)のマージ・本番反映確認**: chatgpt-codex-connectorのP2指摘2件(統合テストが到達不能な`fecf684`に依存していた点、静的コンテンツ通知のIndexNow応答観測性に関する記述誤り)へ対応し、owner承認を得てマージ済み(merge `a949e88`)。マージ後のVercel production deployment `dpl_5CuSGSucAXtTPrTYQxMnLZt1PkqN`がREADY(push後約82秒)・`loop-vocabulary.app`/`www.loop-vocabulary.app`へalias済みを確認。
    - **`INDEXNOW_KEY`追加確認(2026-07-31)**: リポジトリ管理者が`autonomous-improvement` GitHub Environmentへ`INDEXNOW_KEY`を追加。`gh secret list --repo roromukuro-afk/loop-vocabulary --env autonomous-improvement`で`INDEXNOW_KEY`(登録日時2026-07-31T02:19:28Z)が存在することを確認済み(値そのものは表示・出力していない)。マージpush(`cd347f6`→`a949e88`)によるworkflow実行(run 30599266274、`conclusion=success`)のログでも、`env:`ブロックの`INDEXNOW_KEY`が(空ではなく)`***`とマスク表示されており、Environment secretが実際にworkflowへ渡っていることを構造的に確認した。
    - **未確認(正直な記録、意図的にコンテンツを変更しての検証はしない)**: `INDEXNOW_KEY`は設定されたが、`cd347f6`→`a949e88`のpushはドキュメント・テストのみの変更で`GUIDE_SLUGS`・`PILOT_WORDS`・`guideRedirects`・ガイド本文・非ガイド静的ページのいずれも変更していないため、この回も`可視性変化: 0件`・`内容更新: 0件`で正しく終了しており(ログで確認)、**外部IndexNow APIへの実際の送信はまだ一度も発生していない**。検証目的だけの無意味なコンテンツ変更は作らず、次に実際にガイド記事・辞書語・リダイレクトを変更する正当なpushが発生した時点で、GitHub Actionsの実行ログ(`gh run view <runId> --log`)から対象URL・絶対URL形式・`ok`・正確なHTTPステータス・`submittedCount`・`skippedCount`を記録する(検出対象0件のrunを外部送信成功として扱わないことを徹底する)。**訂正(chatgpt-codex-connectorのP2指摘、PR #55で対応)**: 教材(materials、Vercelのサーバールート経由)とは異なり、この静的コンテンツ通知はGitHub Actionsのステップとして直接Node scriptを実行するため、`Vercelランタイムログ(get_runtime_logs)がconsole出力を表示しない`という制約は当てはまらない。`main()`は`submitUrlsToIndexNow()`の結果(`ok`・HTTPステータス含む)をそのまま`console.log`しており、GitHub Actionsの実行ログにそのまま出力される。
20. **AC-01(aria/role属性の低カバレッジ)第1弾: 中核学習フローのキーボード操作性** — **完了(コード実装・本番マージ・本番デプロイ・本番での動作確認まですべて確認済み)**(PR #57、merge `cc35224`)。事前調査(Exploreエージェントによるコードベース横断調査)で、独自インタラクティブUIのうちキーボード操作が完全に不可能な箇所を特定し優先度順に4バッチへ分類。うち最優先の2件(毎日使う中核学習フロー)を実装:
    - `src/components/review/FlipCardRunner.tsx`: 復習フラッシュカードの「タップして裏返す」操作が`<div onClick>`のみでキーボード操作不可だった。`role="button"`・`tabIndex={0}`・`aria-label`・Enter/Spaceキーでの`handleFlip()`呼び出しを追加。
    - `src/app/wordbooks/[id]/WordListWithDrawer.tsx`: (1)単語リストの各行が`<li onClick>`のみでキーボード到達不可だった → `role="button"`・`tabIndex={0}`・`aria-label`・Enter/Spaceキー対応を追加。(2)単語詳細ドロワーが独自モーダルながら`role="dialog"`/`aria-modal`/Escapeキー対応/フォーカス移動のいずれも無かった → すべて追加(編集モード時も`aria-labelledby`の参照先が存在するよう対応)。(3)検索欄・編集フォーム2件のplaceholderのみでラベル不足だった箇所に`aria-label`を追加。
    - **chatgpt-codex-connectorのレビュー指摘4件(P1×1・P2×3)へ対応**: (P1)内部の`PronounceButton`(子のbutton)で発生したEnter/Spaceのkeydownが親までbubbleし、発音ボタンを押しただけでカードが裏返る/ドロワーが開いてしまう問題 → 両ハンドラの先頭に`if (e.target !== e.currentTarget) return;`を追加して修正。(P2)ドロワーが閉じている間も`role="dialog"`が残り、名前の無い空のモーダルとしてアクセシビリティツリーに残る問題 → `selected`の有無で`role`/`aria-modal`/`aria-labelledby`を条件付与するよう修正。(P2)ドロワーを閉じてもフォーカスが起点の単語行へ戻らない問題 → `openerRef`を追加し閉じるアニメーション完了後に起点要素(無ければ単語リスト自体)へ`focus()`するよう修正。(P2)Tab/Shift+Tabで背景の検索欄・他の単語行へ操作が漏れる問題 → ドロワー内の操作可能要素を走査するフォーカストラップを実装。
    - **検証(ローカル)**: `npm run typecheck`・`npm run lint`・`npm run build`成功。既存の`test:srs`・`test:wordbook-delete`が変更後も成功(クリック経路のリグレッション無し)。新規`test:a11y-keyboard-navigation`(TEST_プレフィックス付きの専用データを都度作成しfinallyで削除、実ログイン・実DBでEnter/Space/Tab/Shift+Tab/Escapeキー操作と`document.activeElement`を検証する24件のアサーション、flip-card含めskip無し)を3回連続実行しflakeが無いことを確認。
    - **本番デプロイ確認**: マージ後のVercel production deployment `dpl_4CymGNvEQVbPk7pCij75HJyXLDGd`がREADY(push後約91秒)・`loop-vocabulary.app`/`www.loop-vocabulary.app`へalias済みを確認。
    - **本番での動作確認**: `test:a11y-keyboard-navigation`・`test:srs`それぞれの本番相当版(使い捨てスクリプト、baseUrlのみ本番URLへ差し替え、実行後は削除済み)を実際に`https://loop-vocabulary.app`に対して実行し、両方とも全アサーション(a11y側24件・srs側6件+DB検証21件)が成功することを確認(発音ボタンとの操作干渉なし・ドロワー閉鎖後のフォーカス復帰・閲覧/編集モード双方でのフォーカストラップ・`role="dialog"`が閉時に存在しないことを含む)。**ただし**、この2つの実行では本番のGoogle Funding Choices CMPスクリプトが実際に有効なため、E2Eテスト共通ヘルパー(`nav.mjs`)が全ナビゲーションへ付与する`x-lv-e2e-test`ヘッダー付きリクエストが、CMPの外部ビーコン(`fundingchoicesmessages.google.com`)のCORSプリフライトで拒否されるconsole errorが多数発生し、両スクリプトの「console error無し」チェックのみ失敗として記録された。これは本PRの変更やAC-01の実装とは無関係な、E2Eテスト用ヘッダー注入とサードパーティCMPビーコンの相互作用によるもの(ローカルdev serverでは発生しない、本番のCMP有効化時のみ顕在化するテストインフラ側の既知の相互作用として正直に記録する。機能面のアサーションはすべて成功)。テスト後、`TEST_%`の残留データがDBに無いことも確認済み。
    - **AC-01第2弾で対応**: 独自モーダル3箇所(`OnboardingModal`・`UpsellModal`・`AiSuggestButton`)の`role="dialog"`/Escape対応は下記21番で実装。公開ページの検索・登録フォームのラベル不足(`DictionarySearch`・`GuideEmailCapture`等)、非同期処理結果の`aria-live`不足の2バッチは、事前調査で特定済みだが引き続き未着手。
21. **AC-01(aria/role属性の低カバレッジ)第2弾: 独自モーダル3箇所のダイアログ対応** — **完了(コード実装・本番マージ・本番デプロイ・本番での動作確認まですべて確認済み)**(PR #58、merge `4cf1441`)。第1弾のレビュー(PR #57)で指摘された4件の落とし穴(子要素からのkeydown bubbling・閉時のdialog属性残留・フォーカス未復帰・フォーカストラップ欠如)を同じ実装で繰り返さないよう、共通フック`src/lib/a11y/useModalA11y.ts`を新設し、以下3箇所へ適用:
    - `src/components/onboarding/OnboardingModal.tsx`: 初回ダッシュボード訪問時に表示されるオンボーディングモーダル。`role="dialog"`・`aria-modal`・`aria-labelledby`(常に表示されるヘッダーの「ようこそ · N / 3」ラベルを参照)・閉じるボタンの`aria-label`・フォーカストラップ・Escapeキー対応を追加。
    - `src/components/premium/UpsellModal.tsx`: プレミアム誘導モーダル。同様に`role="dialog"`等を追加。閉じるボタンの`aria-label`を追加。
    - `src/components/wordbooks/AiSuggestButton.tsx`: AI単語提案モーダル。`role="dialog"`等に加え、提案リストの各項目(`<li onClick>`のみでキーボード操作不可だった)へ`role="checkbox"`・`aria-checked`・`tabIndex={0}`・Enter/Spaceキー対応を追加(親のモーダル自体のkeydownとの干渉を避けるため`target!==currentTarget`ガードも付与)。
    - **`useModalA11y`の設計**: 開いた瞬間の`document.activeElement`を起点として記憶し、閉じる際(useEffectのcleanup、`open`のfalse遷移とアンマウントの両方で発火)に起点要素が`isConnected`ならフォーカスを戻す。フォーカストラップ・Escape対応は共通の`handleKeyDown`として提供。
    - **chatgpt-codex-connectorのレビュー指摘3件(P1×1・P2×2)へ対応**: (P1)`OnboardingModal`で「次へ」「戻る」をキーボードで押すとステップ切り替えでフォーカスされていたボタンごとDOMが消え、フォーカスがbodyへ落ちる問題 → ステップ切り替え時に新しいステップの見出し(`h2`、`tabIndex={-1}`)へフォーカスを戻す`useEffect`を追加。(P2)`test:a11y-modal-dialogs`のAI提案チェックボックステストが外部LLM呼び出しの成否に応じてスキップされる問題 → `page.route()`でAPIレスポンスを決定論的な固定2件データへ差し替え、スキップ分岐を完全に除去。(P2)fixture作成が`try/finally`保護の外で実行され部分的なsetup失敗でDBに孤立データが残りうる問題 → setup全体を`try/finally`内へ移動、各book IDを作成直後に個別保存、cleanupも各ステップを個別に`try/catch`。
    - **正直な注記(統合先固有の制約)**: `UpsellModal`は`CsvImportPanel.tsx`からCSVインポート導線で開いた場合、親コンポーネントがモーダル表示中に自身の全内容をモーダルへ置き換える実装のため、起点の「アップグレード」ボタン自体がモーダル表示中にDOMから消える。この場合`useModalA11y`は`isConnected`チェックにより安全にフォールバックする(クラッシュしない・dialogが残らない・元のページは正しく復元される)が、起点への確実なフォーカス復帰はこの特定の統合では原理的に不可能(`useModalA11y`自体の欠陥ではなく`CsvImportPanel`側の描画方式に起因、テストでこの制約を明示的に記録)。
    - **副次的な発見(本PRと切り離して別途追跡)**: 強化したE2Eテストが、`OnboardingModal.tsx`の`saveProfileToSupabase()`が`profiles`テーブルに実際には存在しない`exam_goal`・`level`列へ`upsert`しようとしており、目標選択後にモーダルを閉じるたびにHTTP 400で失敗している(try/catchで握りつぶされ画面上は無症状)という、アクセシビリティとは無関係の既存バグを検出した。本PRには含めず、独立した追跡タスクとして起票済み(再現手順・影響・修正候補を記載)。
    - **検証(ローカル)**: `npm run typecheck`・`npm run lint`・`npm run build`成功。既存の`test:premium-conversion`・`test:premium-gating`が変更後も成功しリグレッション無し。`test:a11y-modal-dialogs`(TEST_プレフィックス付きの専用単語帳を都度作成、`test+onboarding`の`is_premium`も一時変更しfinallyで復元、実ログイン・実DBで3モーダルそれぞれのdialog属性・accessible name・フォーカス移動・フォーカストラップ・Escape対応・`OnboardingModal`のStep0→1→0→1→2遷移後のフォーカス維持・`AiSuggestButton`のSpace/Enterでのチェック切り替えを決定論的に検証)を4回以上連続実行しすべて成功(skip 0件、flakeなし)を確認。
    - **本番デプロイ確認**: マージ後のVercel production deployment `dpl_DtJ6WG5v9aykZvuajo7L3w4U9TsV`がREADY(push後約98秒)・`loop-vocabulary.app`/`www.loop-vocabulary.app`へalias済みを確認。
    - **本番での動作確認**: `test:a11y-modal-dialogs`・`test:premium-conversion`・`test:premium-gating`それぞれの本番相当版(使い捨てスクリプト、baseUrlのみ本番URLへ差し替え、実行後は削除済み)を実際に`https://loop-vocabulary.app`に対して実行し、3モーダルのdialog属性・フォーカス管理・フォーカストラップ・`OnboardingModal`のステップ遷移後のフォーカス維持・`AiSuggestButton`のEnter/Spaceチェック切り替え(決定論的テスト)を含む全アサーションが成功することを確認。**ただし**この3スクリプトの実行では、PR #54/#55/#56で既に記録済みの本番のGoogle Funding Choices CMPスクリプトと`x-lv-e2e-test`ヘッダーのCORS相互作用(既知・本PRとは無関係)による console error が複数回発生し、「console error無し」チェックのみ失敗として記録された(本番のCMPが実際に有効な場合のみ顕在化するテストインフラ側の既知の相互作用であり、機能面のアサーションはすべて成功。1件、通常のCORSメッセージとは異なる`pageerror: Y`という短い断片も同一クラスタ内に観測されたが、同時多発した同じCMPビーコンへのCORS拒否と同一リクエスト群の中で発生しており、CMPスクリプト自身の(圧縮された)内部エラーハンドリングに起因する可能性が高いと考えられる。本PRの変更が原因である確証は無い一方、完全に断定もできないため、推測を避けて事実のみ正直に記録する)。テスト後、`TEST_%`の残留データがDBに無いこと・両アカウントの`is_premium`が元に戻っていることも確認済み。
22. **AC-01(aria/role属性の低カバレッジ)第3弾: 検索・登録フォームのラベル不足** — **完了(PR #59、merge `a382a1d8852da9bd0bceaec3da9c9e84bb38efb9`、本番での動作確認まで確認済み)**。当初想定していた`DictionarySearch.tsx`・`GuideEmailCapture.tsx`の2箇所を修正:
    - `src/app/dictionary/DictionarySearch.tsx`: 検索`<Input>`が`placeholder`のみでラベル不足だった箇所に`aria-label="英単語を入力"`を追加。「追加先:」の`<span>`が`<Select>`と紐付いていなかった箇所を`<label htmlFor="dictionary-add-target">`+`<Select id="dictionary-add-target">`へ変更。
    - `src/components/guide/GuideEmailCapture.tsx`: メール登録`<input type="email">`が`placeholder`のみでラベル不足だった箇所を修正。
    - **Codexレビュー指摘(P2)対応**: 初回実装では`aria-label="メールアドレス"`を追加したが、可視テキストが`placeholder="your@email.com"`のままで一致しておらず、音声入力ユーザーが可視テキストでフィールドを指定できない(WCAG 2.5.3 Label in Name違反)との指摘を受けた。`aria-label`を外し、可視の`<label htmlFor="guide-email-input">メールアドレス</label>`+`<input id="guide-email-input">`へ変更して可視・accessible name を一致させた。
    - **ローカル検証**: `npm run typecheck`・`npm run lint`・`npm run build`成功。
    - **本番検証**: マージ後、`loop-vocabulary.app`へのVercel本番デプロイ(`dpl_E83DWjohdzPKnsjXEYPEa5hsjzMt`)がREADY・`loop-vocabulary.app`/`www.loop-vocabulary.app`へalias済みであることを確認。本番の`/dictionary`ページで検索`<Input>`に`aria-label="英単語を入力"`が実際にレンダリングされていることを確認。本番の`/guide/eiken-vocabulary-study`ページで`<label for="guide-email-input">メールアドレス</label>`が実際にレンダリングされていることを確認。
    - **新たに発見した追加のギャップ(Exploreエージェントによる全文横断調査)**: 当初の事前調査で名指しされていたのは`DictionarySearch`・`GuideEmailCapture`の2箇所のみだったが、今回同種のパターン(`placeholder`のみでラベル不足、または`<label>`はあるが`htmlFor`/`id`で紐付いていない)を管理画面以外の公開/ログイン後ページ全体で再調査したところ、追加で11箇所を発見した: `src/app/wordbooks/[id]/QuickAddWord.tsx`(単語・意味の2フィールド)、`src/app/test/typing/TypingTestRunner.tsx`・`src/app/test/listening/ListeningTestRunner.tsx`・`src/app/test/input/InputTestRunner.tsx`(各テストの解答欄)、`src/app/teacher/CreateClassForm.tsx`(クラス名)、`src/app/materials/page.tsx`(教材検索)、`src/app/extract/ExtractWordsClient.tsx`(レベル選択・英文貼り付け欄)、`src/app/settings/DisplayNameForm.tsx`(表示名)、`src/app/contact/ContactForm.tsx`(氏名・メール・件名・本文の4フィールド)。件数が多く1PRに収めると肥大化するため、本ラウンドでは当初スコープの2箇所のみ実装し、残り9ファイルは次ラウンド(下記項目23以降)へ持ち越した(`<Field label="...">`ラッパー使用箇所・管理画面は既に対応済みまたは対象外のため除外済み)。**このうち3ファイル(テスト解答欄)は項目23、3ファイル(`QuickAddWord`・`CreateClassForm`・`DisplayNameForm`)は項目24で対応済み。残りは3ファイル(`materials/page.tsx`・`ExtractWordsClient`・`ContactForm`)。**

23. **AC-01(aria/role属性の低カバレッジ)第4弾: テスト解答欄のラベル不足** — **完了(PR #60、merge `03da3cd01f425be66dcae0bc5e50569ae0fb3b8c`、本番での動作確認まで確認済み)**。第3弾の再調査で発見した11箇所のうち、同種パターン(解答欄が`placeholder`のみでラベル不足)でまとまっている3ファイルを修正:
    - `src/app/test/typing/TypingTestRunner.tsx`・`src/app/test/listening/ListeningTestRunner.tsx`・`src/app/test/input/InputTestRunner.tsx`: いずれも解答用`<input>`/`<Input>`の直前に、その入力欄の目的を示す可視テキスト(「この意味の英単語は？」「音声を聞いて、英単語を入力してください」「この意味の英単語を入力」)が既に存在していたため、PR #59のCodexレビュー指摘(可視テキストと不一致な`aria-label`はWCAG 2.5.3違反)を踏まえ、新規`aria-label`ではなく既存の可視テキストへ`id`を付与し`aria-labelledby`で入力欄と紐付ける方式を採用(可視・accessible name の不一致を構造的に発生させない)。
    - **ローカル検証**: `npm run typecheck`・`npm run lint`・`npm run build`成功。これら3ページ専用の既存E2Eテストは無し(`scripts/testing/e2e/quiz.mjs`は別ページが対象)。いずれも既存要素への`id`/`aria-labelledby`属性追加のみで、動作・見た目の変更は無い。
    - **本番検証**: マージ後、`loop-vocabulary.app`へのVercel本番デプロイ(`dpl_FxbcxqXShCCz3Qzu5L4G2rUBNxEF`)がREADY・aliasされていることを確認。使い捨てスクリプト(検証後に削除、コミットせず)で`test+srs`アカウントへ実ログインし、`is_premium`を一時的にtrueへ設定(元の値を保存)、テスト用単語帳(3語)を作成した上で本番の`/test/typing`・`/test/listening`・`/test/input`へ実際に遷移し、各ページで`id="…-quiz-prompt-label"`が存在し解答欄の`aria-labelledby`がそのIDと一致していることを2回連続で確認した(6/6アサーション成功)。既知の非致命的ノイズ(Google Funding Choices CMPビーコンへの`x-lv-e2e-test`ヘッダーがCORSプリフライトで拒否される、本番環境のみで発生する既知の事象。過去のPR#54〜#59の本番検証でも一貫して観測済み)以外のconsole error・5xxは無し。検証後、テスト用単語帳・単語を削除し`is_premium`を元の値へ復元したことを確認済み。

24. **AC-01(aria/role属性の低カバレッジ)第5弾: 単純な単一/二重フィールドフォームのラベル不足** — **コード実装・ローカル検証まで完了(PR未作成)**。第3弾の再調査で発見した残り8箇所のうち、単純な1〜2フィールドのフォーム3ファイルを修正:
    - `src/app/wordbooks/[id]/QuickAddWord.tsx`: 単語・意味の2フィールドが`placeholder`のみでラベル不足だった。それぞれのplaceholder(「英単語 (例: persevere)」「意味 (例: 頑張り続ける)」)の先頭部分と一致する`aria-label`(`"英単語"`・`"意味"`)を追加(`DictionarySearch.tsx`で採用済み、Codexレビュー済みの「可視テキストの先頭部分と一致するaria-labelは不一致にならない」パターンを踏襲)。
    - `src/app/teacher/CreateClassForm.tsx`: クラス名`<input>`が`placeholder`(例示テキストのみで用途を説明していない)のみでラベル不足だった。可視の`<label htmlFor="create-class-name">クラス名</label>`を追加し`id`で紐付け。
    - `src/app/settings/DisplayNameForm.tsx`: 表示名`<input>`の`<label>`は既に存在していたが`htmlFor`/`id`で紐付いていなかった。`htmlFor="display-name-input"`+`id="display-name-input"`を追加して紐付け。
    - **検証**: `npm run typecheck`・`npm run lint`・`npm run build`成功。いずれも既存要素への`id`/`aria-label`/`htmlFor`属性追加、または新規`<label>`1行の追加のみで、動作・見た目の変更は無い(`DisplayNameForm`は既存の可視`<label>`のテキストは変更していない)。
    - 残り3ファイル(`src/app/materials/page.tsx`・`src/app/extract/ExtractWordsClient.tsx`・`src/app/contact/ContactForm.tsx`)は次ラウンドへ持ち越す。

## 既知の未解決事項(意図的な対象外、根拠あり)

- **`/materials/[id]`ページに視覚的パンくずUIが無い**: 動的な`material.title`をラベルに使う`<Breadcrumb>`を追加したところ、`test:internal-links`が「ページ遷移(リサイズ後の再ナビゲーション)でnetworkidle待ちがタイムアウトする」形で100%再現性のある形で失敗することを確認した。静的ラベルを使う他の全ページ(ガイド記事30本以上・教材カテゴリ7ページ・辞書・ピラーページ)は同じコンポーネントで問題なく動作しているため、コンポーネント自体の欠陥ではなく、動的ラベル+このページ特有のデータ取得パターンとの相互作用が疑われる。根本原因は特定できなかったため、実際に壊れるE2Eテストを通すコードを出荷するより、このページのみ対象外として次ラウンドへ持ち越すことを選択した。

## 新規に発見したギャップ(次ラウンド候補、優先度順)

1. **CMP(同意管理)** — **コード実装完了、マージ・本番反映済み**(PR #29、merge `08ae340`)。Google Funding Choices CMPタグをサイト全体に実装、`/privacy`に同意設定変更ボタンを追加。本番で以下を確認済み: CMPタグ(`fundingchoicesmessages.google.com`)のHTML出力、同意変更ボタンの表示・クリック時無エラー、console errorなし、mobile横スクロールなし、既存AdSense表示ポリシー(ホワイトリスト化ルート)への回帰なし。**ただしCMP対応は未完了**: AdSense管理画面での実際のGDPR同意メッセージ作成・EEA/UK/スイス対象設定・未成年者向け設定・同意前デフォルト広告設定・メッセージ公開・実環境確認は、いずれもユーザーのAdSense管理画面操作が必要でコード側からは実施不可(AD-04参照)。それが完了するまでEEA等からのアクセス時に実際の同意バナーは表示されない。また、本PRはAdSense広告同意のみを扱っており、GA4・Microsoft Clarity・Growth OS側の分析用同意方針は別課題として引き続き未着手
2. **`return_next_day`/`return_day_7`/`wordbook_created`イベント** — **完了**。`feat/growth-events-wordbook-retention`(PR #27、merge `bab5075`)。DB挿入失敗の誤成功報告・D1/D7重複防止のatomic化(Postgres部分ユニークインデックス+`SECURITY DEFINER`関数、supabase/migrations/024〜027で本番DBとリポジトリを整合済み)・`wordbook_created`発火位置の是正など、レビュー指摘4件を全面的に作り直して対応。本番マージ・デプロイREADY・DB整合性確認済み。イベント自体は稼働開始したが、D1/D7継続率の実データはこれから日次cron稼働により蓄積される(E-03参照)
3. **パンくずJSON-LDと視覚的UIの不整合** — **完了**。PR #34+#37+#38+#39+#40で32/32ガイド記事完了(教材7カテゴリ・辞書・ピラーページも完了)。`/materials/[id]`のみ既知の技術的理由で対象外(上記「既知の未解決事項」参照)
4. **アクセシビリティ(aria/role)の低カバレッジ** — 未着手
5. **無料ツール** — `FREE_TOOL`セクション参照。FT-02(復習日計算ツール)・FT-07(単語比較)・試験日逆算学習計画メーカー(FT-02完全版、PR #43)は完了、FT-04(小テスト作成)・FT-05(PDF作成)は既存機能でカバー済み。FT-08(不規則動詞一覧)は「一覧」部分のみ完了(PR #42)、「テスト」機能は引き続き未着手。残りFT-01(語彙力チェック強化)・FT-03(CSV変換)・FT-06(発音検索)・FT-08のテスト機能・FT-09(今日覚える英単語)の5件が未着手
6. **AIクローラーポリシー・llms.txt** — **完了**。`feat/ai-crawler-policy-llms-txt`(PR #31、merge `0dc94d1`)。T-09/A-02/T-12/A-03クローズ、本番`/robots.txt`・`/llms.txt`を直接確認済み。**ただしAI検索施策全体としては未完了**: AI経由流入の実際の計測(GA4トラフィック獲得レポートでの確認)・ポリシー導入の成果検証(実際に引用・流入が増えたか)はまだ実施しておらず、A-04として引き続き未着手
7. **IndexNow実装** — 週次全件再送信は**完了**(PR #32、merge `8c6fbc0`、T-11クローズ)。本番でキーファイル配信・cron認証・`INDEXNOW_KEY`設定・週次全件再送信機能の本番初回送信(170 URL送信・0スキップ・`ok=true`・外部API 2xx成功、詳細はT-11参照)をすべて確認済み。**教材(materials)のページ個別即時通知も完了**(PR #52、merge `fc78c7c`、本番マージ・本番デプロイ・本番での実際の発火まで確認済み。外部IndexNow API側の2xx受理はVercelランタイムログから観測できず未確認のまま記録。詳細は上記完了項目サマリ18番・`AI_SEARCH_AND_INDEXNOW_POLICY.md`参照)。**教材以外(ガイド記事・辞書語ページ・無料ツール・URLリダイレクト)のページ個別即時通知も実装・マージ・本番デプロイ・push発火まで完了**(PR #54、merge `cd347f6`。mainへのpush前後のコミット間で実際に生成される公開URL集合を比較する方式で実現、詳細は`AI_SEARCH_AND_INDEXNOW_POLICY.md`参照。`autonomous-improvement` Environmentへ`INDEXNOW_KEY`が追加されたことを確認済み(2026-07-31)だが、実際にガイド記事等を変更する次のpushが来るまで外部API送信は未検証)。**残タスク**: (1) 実際にガイド記事等を変更する次のpushでの外部API実送信確認(GitHub Actionsログで`ok`・HTTPステータスを直接確認可能、Vercelランタイムログの制約は当てはまらない)、(2) Bing Webmaster Toolsへの登録と送信状況の監視(ユーザーの手動作業)、(3) IndexNow経由のインデックス・流入成果測定(まだ実施していない)

## 外部認証・人間の判断が必要なブロッカー

1. Bing Webmaster Tools登録状況の確認(Bing管理画面へのアクセスが必要。登録後は送信状況の監視も継続対象、IndexNow関連の残タスクとして「新規に発見したギャップ」項目7参照)
2. AdSense管理画面でのCMP設定・ads.txt Authorized状態確認
3. 教育メディアへの被リンク依頼(手動営業)

(旧項目「AIクローラー個別許可の事業判断」はT-09/A-02で実装済みのため解消。推奨デフォルトに異議があれば`public/robots.txt`の該当ボックロックを直接編集するだけで即座に上書き可能。旧項目「Vercel Production環境変数へのINDEXNOW_KEY設定」は2026-07-29に完了・本番初回送信も確認済みのため解消、詳細はT-11参照)
