# インデックス監査レポート（AdSense審査前監査 Phase 4）

生成日: 2026-07-12

方針の詳細は [`SEO_INDEXING_POLICY.md`](../SEO_INDEXING_POLICY.md) を参照。本レポートは実施内容の差分サマリ。

## 修正した項目

| # | 内容 | ファイル |
|---|---|---|
| 1 | `/beta` `/premium/success` `/referral/` `/auth/` `/offline` を robots.txt Disallow に追加 | `public/robots.txt` |
| 2 | `/premium/success` に `robots:{index:false,follow:true}` metadata新設 | `src/app/premium/success/page.tsx` |
| 3 | `/beta` に `robots:{index:false,follow:true}` metadata追加 | `src/app/beta/page.tsx` |
| 4 | `/referral/[code]` に `robots:{index:false,follow:true}` metadata追加 | `src/app/referral/[code]/page.tsx` |
| 5 | `/offline`（"use client"のためpage.tsx直接には書けない）に layout.tsx を新設し `robots:{index:false,follow:true}` を設定 | `src/app/offline/layout.tsx`（新規） |

## 監査したが変更不要と判断した項目

- `/road`（ログイン後の個人進捗ダッシュボード。`requireUser()`で保護済み、robots.txtも既にDisallow済み） — 対応不要
- `/roadmap`（公開のSEO記事ページ。`/road`とは別物、意図的にindex対象） — 対応不要
- `/grammar` `/phrases` `/shadowing`（公開コンテンツ、sitemap.ts に既に含まれている） — 対応不要
- `/join/[code]`（教室参加リンク。既にrobots.txt disallow済み） — 対応不要

## 確認テスト

`npm run test:indexing-policy` で継続監視（noindex実装確認・index対象への誤爆確認・sitemap混入確認・robots.txt整合性確認・canonical自己参照確認）。

## 未対応（次回以降のTODO）

`/dashboard` `/settings` `/account/*` `/review` `/pdf` `/wordbooks` `/weak` `/stats` `/teacher/*` `/admin/*` `/plan` `/learn` `/extract` `/ai` `/ranking` `/test/*` は robots.txt disallow + 認証リダイレクト（`requireUser()`→`/login`）で二重保護されているが、ページ単位の明示的 `robots:{index:false}` metadataは未設定。実害は小さいが、Search Consoleの「検出されたがインデックス未登録」表示削減のため次ラウンドで対応予定（`GROWTH_90_DAY_ROADMAP.md` Week1-2に記載）。
