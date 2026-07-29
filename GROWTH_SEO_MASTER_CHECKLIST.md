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
| T-09 | robots.txtでAIクローラー個別指定(GPTBot/OAI-SearchBot等) | robots.txt | 「検索流入を得る」と「学習データ利用を許可する」は別の事業判断であり、方針未確定のため意図的に見送り済み | **外部認証待ち(オーナー判断待ち)** | `AI_SEARCH_AND_INDEXNOW_POLICY.md`に判断材料整理済み。オーナーの意思決定が必要 |
| T-10 | Bing Webmaster Tools登録確認 | サイト全体 | コードからは確認不可、Bing管理画面での登録要 | **外部認証待ち** | https://www.bing.com/webmasters/ でのサイト登録要確認 |
| T-11 | IndexNow実装 | 更新系全般 | 実装コストは低いが、優先度上、意図的に前ラウンドで見送り | **未着手（根拠あり）** | `AI_SEARCH_AND_INDEXNOW_POLICY.md`参照。ページ数が大きく増える局面で再検討 |
| T-12 | llms.txt | サイト全体 | 未作成。効果を誇張せず案内として有用なら作成可能 | **未着手** | 次ラウンド候補（本ラウンドでは未着手、理由:優先度検討中） |

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
| A-02 | AIクローラー区別(検索流入用 vs 学習データ用) | 用語整理済み(`AI_SEARCH_AND_INDEXNOW_POLICY.md`)、実装は事業判断待ち(T-09と同一) | **外部認証待ち(オーナー判断待ち)** |
| A-03 | llms.txt | 未作成 | **未着手**(T-12と同一) |
| A-04 | AI経由流入の計測 | 専用実装は無いが、GA4の「トラフィック獲得」レポートでリファラベースに`chatgpt.com`/`perplexity.ai`等を現状でも確認可能(コード変更不要) | **実装済み(GA4標準機能で代替可)・計測待ち** |

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
| FT-07 | 似た意味の単語比較(類義語比較) | `/guide/affect-vs-effect`・`/guide/apply-for-vs-apply-to` | PR #41で新規実装(品詞・前置詞の違いを軸にした解説記事2本)。マージ待ち | **実装済み・マージ待ち(PR #41)** |
| FT-08 | 不規則動詞一覧・テスト | `/guide/fukikisoku-doushi-ichiran` | PR #42で「一覧」部分のみ新規実装(全部同じ型・ABB型・ABA型・ABC型+例外のAAB型の5パターン分類一覧記事)。マージ待ち。**「テスト」機能(インタラクティブな確認テスト)は未実装のまま** | **一覧のみ実装済み・マージ待ち(PR #42)、テスト機能は未着手** |
| FT-09 | 今日覚える英単語 | (未実装) | | **未着手** |
| (追加) | 試験日から逆算する学習計画メーカー(FT-02の完全版、独立ツールとして実装) | `/exam-countdown-planner` | PR #43で新規実装。試験日+単語数から最短ペースと復習7日確保ペースの2パターンを算出。`/tools`のPLANNED_TOOLSからLIVE_TOOLSへ移動。マージ待ち | **実装済み・マージ待ち(PR #43)** |

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
| AC-01 | aria属性・role属性 | `aria-`使用は全体で6箇所のみ(`src/components`2件・`src/app`4件)、`role=`属性は0件 | **実行中(新規発見、対応優先度中〜高)** |
| AC-02 | 画像alt | 実質的に画像使用がほぼ無いため対象範囲は小さい(PF-01と同根拠) | **完了(該当箇所僅少)** |

## ADSENSE

| ID | 施策 | 現状 | ステータス |
|---|---|---|---|
| AD-01 | 広告表示ルートのホワイトリスト化 | `src/lib/ads/adRoutePolicy.ts`で`/`・`/materials`・`/guide`・`/dictionary/[word]`のみ許可、操作画面(dashboard/wordbooks/admin等)は広告ゼロ | **完了(既存)** |
| AD-02 | ads.txt / Publisher ID | `public/ads.txt`に`pub-5148247638505100`設定済み、AdSenseメタタグも設置済み | **完了(既存)** |
| AD-03 | CMP(同意管理プラットフォーム) | **コード上に実装が一切確認できない**。プライバシーポリシーにテキストでの開示はあるが、機能的な同意バナー・オプトアウトUIは存在しない | **実行中(重要ギャップ、EEA/UK/スイス向け審査要件に関わる可能性)** |
| AD-04 | AdSense管理画面側の設定確認(CMP/ads.txt Authorized状態) | コードから確認不可 | **外部認証待ち** |

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
7. **PR #31**: robots.txtへのAIクローラー個別指定(OAI-SearchBot/GPTBot/ClaudeBot/Google-Extended/PerplexityBot)+`public/llms.txt`新規作成。T-09/A-02/T-12/A-03クローズ。**実装・テスト完了、owner承認待ちで未マージ**(`/approve-protected-paths`要、詳細は`EXECUTION_STATE_LEDGER.md`)。
8. **PR #32**: IndexNowキーファイル・送信ユーティリティ・週次cron再送信ルート実装。**実装・テスト完了、owner承認待ちで未マージ**(同上)。
9. **PR #33**(本ラウンド): 復習日計算ツール(`/review-date-calculator`)新規実装。アプリの実SRS固定間隔を使用、V1/V2の違いを明記。マージ・本番反映済み(merge `a87fe68`)。
10. **PR #34**(本ラウンド): 「英単語の覚え方」ピラーページ+サイト共通の視覚的パンくずUIコンポーネント新設、32本中27本のガイド記事・辞書・教材7カテゴリページに展開。P-02ほぼクローズ(`/materials/[id]`は既知の技術的理由で対象外、詳細は次項)。
11. **PR #30**(本ラウンド): 主要10テーマのSNS素材キット(X/Instagram/Shorts/TikTok/Pinterest)作成。マージ済み(merge `d14a316`)。
12. **PR #38**(本ラウンド): PR #34のパンくずフォローアップ第2弾、eiken-conversation・toeic-tango 2記事に展開。マージ済み(merge `3d564eb`)。
13. **PR #39**(本ラウンド): PR #34のパンくずフォローアップ、daigaku-juken-tango 1記事に展開(quality-gate 20分タイムアウト回避のため単一ファイルPRに分割)。マージ済み(merge `82e5b00`)。
14. **PR #37・#40**(本ラウンド): 残るchugaku-eigo-tango・business-english-tangoへのパンくず展開。各1ファイルPRに分割してマージ済み(merge `fef807f`・`b95a0c1`相当)。これによりP-02は32/32ガイド記事完了(`/materials/[id]`のみ既知の技術的理由で対象外)。
15. **PR #41・#42・#43**(本ラウンド): 混同しやすい単語ペア解説(affect-vs-effect・apply-for-vs-apply-to、FT-07)、不規則動詞一覧(fukikisoku-doushi-ichiran、FT-08「一覧」部分)、試験日逆算学習計画メーカー(exam-countdown-planner、FT-02の完全版)を新規実装・マージ済み。いずれもchatgpt-codex-connectorのレビュー指摘(表内Markdown太字が未レンダリング/AAB型動詞の欠落/試験当日ラベル誤り/小数単語数入力)を修正済み。
16. **PR #44**(本ラウンド): 上記進捗を反映したマスターチェックリスト更新。マージ済み。
17. **PR #27**(本ラウンド): Growth OSイベント(`wordbook_created`/`first_test_started`/`return_next_day`/`return_day_7`)実装。DB挿入失敗の誤成功報告・D1/D7重複防止のatomic化・イベント発火位置の是正などレビュー指摘4件へ全面対応後、本番Supabaseへ適用済みだったDBマイグレーション(部分ユニークインデックス+`SECURITY DEFINER`関数、supabase/migrations/024〜027)をリポジトリへ記録し、owner承認を得てマージ済み(merge `bab5075`)。本番デプロイREADY確認済み、本番DBの関数定義・インデックス定義・権限・重複ゼロを再確認済み。

## 既知の未解決事項(意図的な対象外、根拠あり)

- **`/materials/[id]`ページに視覚的パンくずUIが無い**: 動的な`material.title`をラベルに使う`<Breadcrumb>`を追加したところ、`test:internal-links`が「ページ遷移(リサイズ後の再ナビゲーション)でnetworkidle待ちがタイムアウトする」形で100%再現性のある形で失敗することを確認した。静的ラベルを使う他の全ページ(ガイド記事30本以上・教材カテゴリ7ページ・辞書・ピラーページ)は同じコンポーネントで問題なく動作しているため、コンポーネント自体の欠陥ではなく、動的ラベル+このページ特有のデータ取得パターンとの相互作用が疑われる。根本原因は特定できなかったため、実際に壊れるE2Eテストを通すコードを出荷するより、このページのみ対象外として次ラウンドへ持ち越すことを選択した。

## 新規に発見したギャップ(次ラウンド候補、優先度順)

1. **CMP(同意管理)** — `feat/adsense-cmp-consent`(PR #29)で実装完了。プライバシーポリシーの最終更新日修正等レビュー指摘対応済み、owner承認待ち(`/approve-protected-paths`要)。マージ後もAdSense管理画面での同意メッセージ作成等の人間の作業が残る(下記参照)
2. **`return_next_day`/`return_day_7`/`wordbook_created`イベント** — **完了**。`feat/growth-events-wordbook-retention`(PR #27、merge `bab5075`)。DB挿入失敗の誤成功報告・D1/D7重複防止のatomic化(Postgres部分ユニークインデックス+`SECURITY DEFINER`関数、supabase/migrations/024〜027で本番DBとリポジトリを整合済み)・`wordbook_created`発火位置の是正など、レビュー指摘4件を全面的に作り直して対応。本番マージ・デプロイREADY・DB整合性確認済み。イベント自体は稼働開始したが、D1/D7継続率の実データはこれから日次cron稼働により蓄積される(E-03参照)
3. **パンくずJSON-LDと視覚的UIの不整合** — **完了**。PR #34+#37+#38+#39+#40で32/32ガイド記事完了(教材7カテゴリ・辞書・ピラーページも完了)。`/materials/[id]`のみ既知の技術的理由で対象外(上記「既知の未解決事項」参照)
4. **アクセシビリティ(aria/role)の低カバレッジ** — 未着手
5. **無料ツール** — `FREE_TOOL`セクション参照。FT-02(復習日計算ツール)・FT-07(単語比較)・試験日逆算学習計画メーカー(FT-02完全版、PR #43)は完了、FT-04(小テスト作成)・FT-05(PDF作成)は既存機能でカバー済み。FT-08(不規則動詞一覧)は「一覧」部分のみ完了(PR #42)、「テスト」機能は引き続き未着手。残りFT-01(語彙力チェック強化)・FT-03(CSV変換)・FT-06(発音検索)・FT-08のテスト機能・FT-09(今日覚える英単語)の5件が未着手

## 外部認証・人間の判断が必要なブロッカー

1. Bing Webmaster Tools登録状況の確認(Bing管理画面へのアクセスが必要)
2. AIクローラー(GPTBot/OAI-SearchBot等)個別許可の事業判断(学習データ利用を許可するかどうか)
3. AdSense管理画面でのCMP設定・ads.txt Authorized状態確認
4. 教育メディアへの被リンク依頼(手動営業)
