# AdSense審査前 信頼性・権利・noindex・広告 監査（Phase 0: 棚卸し）

生成日: 2026-07-12。目的はページ追加ではなく、AdSense審査前の信頼性・事実整合性・権利・noindex・広告/CMP監査。本ドキュメントは全公開URL種別の棚卸しであり、詳細は各Phaseの個別ドキュメントを参照。

- Phase 1 詳細: [`reports/material-count-consistency.md`](reports/material-count-consistency.md)
- Phase 2 詳細: `EXAM_INFO_SOURCE_POLICY.md` / `reports/exam-info-audit.md`
- Phase 3 詳細: `EXTERNAL_MATERIALS_RIGHTS_AUDIT.md` / `CONTENT_SOURCE_POLICY.md`
- Phase 4 詳細: [`SEO_INDEXING_POLICY.md`](SEO_INDEXING_POLICY.md) / [`reports/indexing-audit.md`](reports/indexing-audit.md)
- Phase 5 詳細: `PRIVACY_CMP_ADSENSE_AUDIT.md`

## 凡例

- **index方針**: index=検索インデックス対象 / noindex=対象外
- **広告**: Auto Ads経由で表示されうる（`src/lib/ads/adRoutePolicy.ts` の allow-list に該当するパスのみ）か否か
- **ログイン**: 未ログインで閲覧可能か、`requireUser()`等で必須か

## 1. トップ・コア公開ページ

| URL | 種別 | index方針 | canonical | sitemap | 広告 | ログイン | 内容品質リスク | 権利リスク | 優先度 | 対応状況 |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | トップ | index | 自己参照 | ○ | ○ | 不要 | 低 | なし | - | 既存維持 |
| `/dictionary` | 辞書トップ | index | 自己参照 | ○ | ×(サブパスのみ許可) | 不要 | 低 | なし | - | 既存維持 |
| `/dictionary/[word]` | 辞書語ページ(50語) | 品質ゲート通過分のみindex | 自己参照 | isIndexEligibleのみ | ○ | 不要 | 低(品質スコア80以上のみ公開) | なし | - | 既存維持 |
| `/materials` | 教材一覧 | index | 自己参照 | ○ | ○ | 不要 | 中→**Phase1で是正** | 中(外部由来教材あり) | 高 | 対応済 |
| `/materials/[id]` | 教材詳細(46件) | is_public&&approved/originalのみindex | 自己参照 | 公開分すべて | ○ | インポートのみ要 | 中→**Phase1で是正** | 中 | 高 | 対応済 |
| `/materials/{eiken,toeic,highschool,university-exam,school-test,business,news}` | 教材カテゴリLP | index | 自己参照 | ○ | ○ | 不要 | 低 | 低 | - | 既存維持 |
| `/guide` | ガイド一覧 | index | 自己参照 | ○ | ○ | 不要 | 低 | なし | - | 既存維持 |
| `/guide/[slug]`(40記事以上) | ガイド記事 | index | 自己参照 | ○ | ○ | 不要 | 中(試験情報の一部が古い/断定的)→**Phase2で是正** | 低(比較記事に外部教材名あり)→**Phase3で確認** | 高 | 対応中 |
| `/grammar`, `/grammar/[slug]` | 文法レッスン | index | 自己参照 | ○ | ○ | 不要 | 低 | なし | - | 既存維持 |
| `/phrases`, `/shadowing`, `/roadmap` | 学習コンテンツ | index | 自己参照 | ○ | ○ | 不要 | 低 | なし | - | 既存維持 |
| `/reports` | 独自レポート(準備中ハブ) | index | 自己参照 | ○ | ○ | 不要 | 低(準備中の明示あり) | なし | - | 既存維持 |
| `/premium` | 料金ページ | index | 自己参照 | ○ | ○ | 不要 | 低 | なし | - | 既存維持 |
| `/about`, `/press`, `/faq`, `/contact` | 会社・信頼性情報 | index | 自己参照 | ○ | 一部 | 不要 | 低 | なし | - | 既存維持 |
| `/privacy`, `/terms`, `/legal/*` | 法的ページ | index | 自己参照 | ○ | × | 不要 | 低→**Phase5で強化** | なし | 中 | 対応済 |
| `/vocab-check`, `/vocab-check/eiken`, `/vocab-check/toeic` | 語彙力診断 | index | 自己参照 | ○ | ×(結果画面は意図的に広告なし) | 不要 | 低 | なし | - | 既存維持 |
| `/tools` | ツールハブ(新規) | index | 自己参照 | ○(新規追加) | ○ | 不要 | - | なし | 中 | **Phase7で新規実装** |

## 2. 個人・ログイン後・空・完了画面（noindex対象）

| URL | 種別 | 監査前の状態 | 対応 |
|---|---|---|---|
| `/dashboard` `/settings` `/account/*` `/review` `/pdf` `/wordbooks` `/weak` `/stats` `/teacher/*` `/admin/*` `/share/*` `/join/*` `/road` `/plan` `/learn` `/extract` `/ai` `/ranking` `/test/*` | ログイン必須の個人画面 | robots.txt disallow済み・`requireUser()`で`/login`(noindex)へリダイレクト | 二重保護済み。metaタグ明示は次回以降 |
| `/login`, `/signup` | 認証フォーム | 既に`layout.tsx`で`robots:{index:false}` | 既存維持 |
| `/beta` | ベータ募集(静的な募集人数表示) | robots.txt未掲載・noindexメタなし | **今回対応: noindex化** |
| `/premium/success` | 決済完了サンクスページ | robots.txt未掲載・noindexメタなし | **今回対応: noindex化** |
| `/referral/[code]` | 招待コード別ページ(重複コンテンツ) | robots.txt未掲載・noindexメタなし | **今回対応: noindex化** |
| `/offline` | PWAオフラインフォールバック | robots.txt未掲載・noindexメタなし | **今回対応: noindex化** |
| `/auth/callback` | OAuthコールバック(route.ts) | robots.txt未掲載 | **今回対応: robots.txt disallow追加** |

## 3. 広告表示ポリシー（`src/lib/ads/adRoutePolicy.ts`、変更なし）

Google Auto Adsはページ単位でのON/OFFのみ可能なため、`ADS_ALLOWED_EXACT=["/"]` / `ADS_ALLOWED_PREFIXES=["/materials","/guide"]` / `ADS_ALLOWED_SUBPATH_ONLY_PREFIXES=["/dictionary"]` のallow-listで学習画面・診断結果画面には広告が出ない設計を維持。今回の監査で変更なし（`ADSENSE_REVIEW_CHECKLIST.md`参照）。

## 4. 権利リスクの所在（詳細はPhase3ドキュメント）

`materials`テーブルのうち外部publisher/authorが記録されている4件（VOCABULARISM由来2件、printgenerator.net由来1件、ukaru-eigo.com由来1件）と、市販教材名（ターゲット1900・システム英単語・LEAP）を扱う比較記事群。詳細は `EXTERNAL_MATERIALS_RIGHTS_AUDIT.md` を参照。

## 5. 総括（Phase0時点のGO/NO-GO判定材料）

| 観点 | 状態 |
|---|---|
| 教材名と実語数の不整合 | ✅ 解消（4件修正、監査スクリプト常設） |
| noindex漏れ | ✅ 主要な漏れ(5パス)を解消。認証必須ページのmeta明示は次回 |
| 試験情報の正確性 | 🔶 Phase2で主要記事を修正中（詳細は個別ドキュメント） |
| 権利リスク | 🔶 Phase3で監査・disclaimer整備中 |
| プライバシー/CMP/広告開示 | 🔶 Phase5で監査済み。AdSense管理画面側の確認項目あり |

最終的なGO/NO-GO判断は `GROWTH_90_DAY_ROADMAP.md` のWeek1-2チェックリストを参照。
