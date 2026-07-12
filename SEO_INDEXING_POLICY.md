# noindex / robots.txt / sitemap / canonical ポリシー

AdSense審査前監査 Phase 4。2026-07-12時点の方針と実施内容をまとめる。

## 基本方針

1. **robots.txtのDisallowだけに頼らない。** Googlebotはrobots.txtでDisallowされたURLでも、他ページからリンクされていれば「スニペットなしでインデックスする」ことがある。個人ページ・空ページ・重複生成ページは、robots.txt disallowに加えて `<meta name="robots" content="noindex,follow">` を各ページのmetadataで明示する。
2. **認証必須ページは二重の保護がある。** `requireUser()` は未ログインアクセスを `/login`（noindex）にリダイレクトするため、クローラーは実コンテンツに到達できない。ただしURL自体がリンクされていれば「インデックス未登録（ブロック済み）」としてSearch Consoleに現れうるため、robots.txt disallowは維持する。
3. **sitemap.xmlに載せるURLは必ずindex対象であること。** noindex対象をsitemapに混在させない。

## index対象（サイトマップに含む）

`/`, `/dictionary`, 品質基準を満たす `/dictionary/[word]`（`isIndexEligible`）, `/materials`, `/materials/*` カテゴリLP, `/materials/[id]`（is_public かつ license_status in approved/original）, `/guide`, `/guide/*` 記事, `/grammar`, `/grammar/[slug]`, `/reports`, `/premium`, `/about`, `/press`, `/faq`, `/phrases`, `/shadowing`, `/roadmap`, `/privacy`, `/terms`, `/contact`, `/legal/*`, `/vocab-check`, `/vocab-check/eiken`, `/vocab-check/toeic`。

## noindex対象（今回の監査で新たに対応したもの）

| パス | 状態(監査前) | 対応内容 |
|---|---|---|
| `/beta` | robots.txt未掲載・noindexメタなし | robots.txt Disallow追加 + `robots:{index:false}` 追加。募集人数「0/20名」等の静的表示が陳腐化しやすいため |
| `/premium/success` | robots.txt未掲載・noindexメタなし | robots.txt Disallow追加 + `robots:{index:false}` 追加。決済完了直後の個人向けサンクスページ |
| `/referral/[code]` | robots.txt未掲載・noindexメタなし | robots.txt `Disallow: /referral/` 追加 + `robots:{index:false}` 追加。招待コードごとに大量の類似URLが生成される重複コンテンツ |
| `/offline` | robots.txt未掲載・noindexメタなし | robots.txt Disallow追加 + `src/app/offline/layout.tsx` 新設で `robots:{index:false}` 追加（"use client"ページのためlayout側で対応） |
| `/auth/callback` | robots.txt未掲載 | robots.txt `Disallow: /auth/` 追加（route.tsのためHTML/metaは存在せず、robots.txtのみで対応） |

## noindex対象（既存・今回変更なし、robots.txt disallow + 認証リダイレクトで保護済み）

`/dashboard`, `/settings`, `/account/*`, `/review`, `/pdf`, `/wordbooks`, `/weak`, `/stats`, `/teacher/*`, `/admin/*`, `/share/*`, `/join/*`, `/road`, `/plan`, `/learn`, `/extract`, `/ai`, `/ranking`, `/test/*`。これらは `requireUser()` により未ログイン時に `/login`（noindex）へリダイレクトされるため二重に保護されている。`/login`, `/signup` は既存の `layout.tsx` で `robots:{index:false,follow:true}` を明示済み。

### 今回の監査で見送った項目（TODO・次回以降）

上記の認証必須ページ群は、robots.txt disallow + 認証リダイレクトによる保護は効いているが、**metaタグでの明示的noindexは未設定**のページが大半（`/login`・`/signup`・`/road` のみ既設定）。実害は小さい（コンテンツ自体はクローラーに見えない）が、Search Consoleの「検出されたがインデックスに未登録」表示を減らす観点では、各ページへの `robots:{index:false}` metadata追加が望ましい。件数が多い（15ページ以上）ため今回はスコープ外とし、`GROWTH_90_DAY_ROADMAP.md` のWeek1-2タスクに追記した。

## canonical

- 全index対象ページで `alternates.canonical` が自己URLを指すことを確認済み（`scripts/testing/e2e/canonical-integrity.mjs` + 新設 `scripts/testing/e2e/indexing-policy.mjs` でチェック）。
- vercel.app → loop-vocabulary.app のドメインリダイレクトは前ラウンド（コミット `7ec0648`）で対応済み・`test:canonical-domain-redirect` で継続監視。

## sitemap分割について

現状 `src/app/sitemap.ts` は単一ファイルで167件程度のURLを出力しており、Googleのsitemap上限（1ファイルあたり5万URL/50MB）には遠く及ばないため、**今回は分割不要と判断**。将来、辞書語ページや教材ページが数千件規模に増える場合は `/sitemap-static.xml` `/sitemap-guides.xml` `/sitemap-dictionary.xml` `/sitemap-materials.xml` の分割を検討する（設計のみ、今回は実装しない）。

## テスト

`scripts/testing/e2e/indexing-policy.mjs`（`npm run test:indexing-policy`）で以下を継続監視:
- noindex対象ページに実際にnoindexメタタグが出力されているか
- index対象ページにnoindexが誤って付いていないか
- sitemap.xmlにnoindex対象URLが混入していないか
- robots.txtが必要なDisallowパスを含んでいるか
- index対象ページのcanonicalが自己参照になっているか
