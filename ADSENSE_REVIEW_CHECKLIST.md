# ADSENSE_REVIEW_CHECKLIST — 再申請に向けた対応記録（2026-07-08）

> AdSense管理画面での再申請操作・審査結果確認はオーナー側で行う。本書はアプリ側で
> 実施した改善内容と、再申請前後に確認すべき項目をまとめたもの。実装の背景・技術詳細は
> [ADSENSE_SETUP.md](ADSENSE_SETUP.md) も参照（本書と一部重複するが、本書は今回の
> 「Low value content」不承認対応に特化した記録）。

## 1. 不承認理由（オーナー共有分）

- Policy violations found
- Low value content
- Your site does not yet meet the criteria of use in the Google publisher network
- Minimum content requirements
- Unique high quality content and good user experience
- Thin content / Webmaster quality guidelines

## 2. 調査で判明した主な原因（Phase 1監査）

1. **Auto ads（`enable_page_level_ads:true`）+ AdSense本体スクリプトが、ルートを問わず全ページで
   無条件に読み込まれていた**（`src/app/layout.tsx`）。`/terms`・`/privacy`・`/login`・`/signup`・
   `/faq`のような薄い法務・認証ページにもGoogleが任意に広告を挿入できる状態になっており、
   「Low value content」判定の直接的な要因である可能性が高いと判断した。
2. **Premium広告非表示ロジックの不整合**: `dashboard`の`NativeAdCard`と`wordbooks`（一覧ページ）の
   `NativeAdCard`が`is_premium`判定を経由せず無条件に表示されており、「広告ゼロ」を謳うPremium訴求と
   実際の挙動が矛盾していた。
3. 学習ガイド（`/guide`）はすでに27記事の独自コンテンツが存在していたが、自己想起・忘却曲線・
   AI活用・音声学習など、今回の学習効果改善ラウンドで実装した新機能に対応する記事が無く、
   機能とコンテンツの間にギャップがあった。

## 3. 実施した改善

### 3-1. 広告表示対象を安全側に制限（ホワイトリスト方式）

- `src/lib/ads/adRoutePolicy.ts`（新規）: 広告表示を許可するルートを一元管理する
  `isAdsAllowedPath()`関数。許可ルートは `/` ・`/materials`（配下含む）・`/guide`（配下含む）のみ。
  それ以外は既定で非表示（デフォルト拒否）。
- `src/components/ads/AdSenseLoader.tsx`（新規）: `usePathname()`で現在ルートを判定し、
  許可ルート以外ではAdSense本体スクリプト・Auto ads自体を読み込まない。`src/app/layout.tsx`から
  無条件の`<Script>`呼び出しを置き換えた。
- `src/components/ads/AppAds.tsx`: `AppBannerAd`・`AppNativeAdCard`（Web版の手動広告枠）にも
  同じルート判定を追加。これにより`dashboard`・`wordbooks`・`road`・`learn`など操作画面では、
  ページ側のコードを個別に触らずに広告が一切表示されなくなった（Premiumかどうかに関わらず）。
- **重要な技術的進展**: [ADSENSE_SETUP.md](ADSENSE_SETUP.md)§4-4に「Auto Ads自体はアプリ側から
  制御できない」という2026-07-04時点の認識が記載されているが、今回の対応でAuto ads自体の
  スクリプト読み込みをルート単位で制御できることを確認した。同ドキュメントの当該記載は
  今回の変更により実質的に更新済みである。
- ネイティブアプリ（Capacitor/AdMob）側の広告表示は対象外（AdSense=Web審査の話であり、
  AdMobは別サービス・別ポリシーのため）。

### 3-2. 変更しなかったもの（指示どおり）

- AdSense publisher ID（`ca-pub-5148247638505100`）・`public/ads.txt`は変更していない。
- Premium課金ロジック・Stripe決済・特商法ページ内容・SRS V2のON状態は変更していない。
- 広告枠（コンポーネントの種類・設置箇所の数）自体は増やしていない。むしろ表示対象を絞った。
- `/premium`は「必要なら慎重に判断」との指示のため、今回は広告非許可のまま据え置いた
  （収益ページに広告が入ると訴求の妨げになりうるため）。将来的に許可する場合は
  `adRoutePolicy.ts`の`ADS_ALLOWED_PREFIXES`に`/premium`を1行追加するだけで対応可能。

### 3-3. 追加した独自コンテンツ（学習ガイド8記事）

すべて`/guide/<slug>`配下の静的ページとして追加。既存の27記事と内容が重複しないよう、
それぞれ検索意図・切り口を明確に分けている（詳細は §4 参照）。

1. `/guide/how-to-memorize-english-words` — 英単語の覚え方【「わかる」と「思い出せる」は違う】
2. `/guide/spaced-repetition-english-vocabulary` — 忘却曲線と英単語の復習タイミング
3. `/guide/flashcards-vs-multiple-choice` — フラッシュカードと4択テストの違い
4. `/guide/eiken-vocabulary-study` — 英検単語の復習方法【全級共通】
5. `/guide/university-exam-vocabulary` — 大学受験 直前期の英単語復習法
6. `/guide/school-test-vocabulary` — 定期テスト前の英単語復習法
7. `/guide/listening-and-pronunciation-vocabulary` — 単語を音で覚える【音声ファースト学習法】
8. `/guide/ai-vocabulary-learning` — AIを使った英単語学習法

各記事: 1,200字以上の本文・課題/解決策/Loopでの使い方/無料でできること/Premiumでできること/
注意点/FAQ3件以上/関連ガイドへの内部リンクを含む。Article・BreadcrumbList・FAQPage JSON-LDと
canonicalを実装（既存の18記事の静的ページにはFAQPage JSON-LDが無かったため、新規8記事では
この不足も補っている）。

### 3-4. 既存ページの補強

- `/materials/highschool`・`/materials/eiken`・`/materials/university-exam`・`/materials/school-test`：
  新規ガイド記事への「関連ガイド」リンクを追加。
- `/materials/toeic`・`/materials/business`・`/materials/news`：従来FAQセクション自体が
  存在しなかったため、FAQ 3項目＋FAQPage JSON-LD＋関連ガイドリンクを新規追加し、他4LPと
  同等の情報量に引き上げた。
- `/materials`（一覧）：`/guide`への案内バナーを追加。

### 3-5. ナビゲーション・sitemap・robots

- `/guide` → `/materials`・各教材LPへのリンクは既存のまま維持し、新規記事↔関連教材LPの
  双方向リンクを追加。
- ホームページフッター（`src/app/page.tsx`）には既存の「学習ガイド」（`/guide`）リンクが
  すでに存在しており、追加変更は不要と判断した。
- ログイン後のアプリ画面共通ヘッダー（`AppShell`/`BottomNav`）は変更していない
  （全操作画面に影響するコンポーネントであり、今回の対応範囲を超えるため）。
- `src/app/sitemap.ts`の`GUIDE_SLUGS`に新規8記事を追加。
- `robots.txt`は元々`/guide`配下を許可済みで変更不要。

## 4. 記事ごとの既存コンテンツとの差別化

| 新規記事 | 近い既存記事 | 差別化した切り口 |
|---|---|---|
| how-to-memorize-english-words | eitango-oboeru-houhou（覚え方総論）/ eitango-oboerarenai（覚えられない原因） | 「再認 vs 想起」という認知心理学の枠組みに絞った理論的な切り口 |
| spaced-repetition-english-vocabulary | tangocho-erabikata（単語帳の回し方） | SRSの内部的な間隔計算ロジックとモード別重み付けに特化 |
| eiken-vocabulary-study | eiken-2kyu-tango等（級別・単語帳選定） | 級を問わない復習「方法論」（級別の語彙数・教材選びは既存記事に譲る） |
| university-exam-vocabulary | daigaku-juken-tango（受験英単語総論） | 直前期・模試/過去問対応・AI弱点分析に絞った実践編 |
| listening-and-pronunciation-vocabulary | eigo-listening-renshu / eigo-hatsuon-renshu（総合的な聴解・発音練習） | 単語1つ1つを音とセットで覚える語彙学習の視点（総合練習とは別軸） |

## 5. sitemapへの反映・Search Consoleで登録リクエストすべきURL

デプロイ後、Search Consoleの「URL検査」から以下のインデックス登録をリクエストしてください
（各URLの日本語タイトルは目印用）。

```
https://loop-vocabulary.app/guide
https://loop-vocabulary.app/guide/how-to-memorize-english-words
https://loop-vocabulary.app/guide/spaced-repetition-english-vocabulary
https://loop-vocabulary.app/guide/flashcards-vs-multiple-choice
https://loop-vocabulary.app/guide/eiken-vocabulary-study
https://loop-vocabulary.app/guide/university-exam-vocabulary
https://loop-vocabulary.app/guide/school-test-vocabulary
https://loop-vocabulary.app/guide/listening-and-pronunciation-vocabulary
https://loop-vocabulary.app/guide/ai-vocabulary-learning
```

## 6. 再申請前に確認すること（オーナー操作）

- [ ] 本番デプロイ後、`/guide`と新規8記事がすべて実際にブラウザで閲覧できること
- [ ] AdSense管理画面「ポリシーセンター」に新しい警告が出ていないこと
- [ ] `ads.txt`が引き続きAuthorizedであること（今回変更していないため維持されるはず）
- [ ] Search Consoleで新規8記事のインデックス登録をリクエストする（§5）
- [ ] 数日〜1週間程度、Googleのクロールが反映されるのを待ってから再申請する
      （公開直後の再申請はクロールが追いついていない可能性がある）

## 7. 再申請後に確認すること

- [ ] AdSense管理画面「サイト」のステータス変化（Getting ready → 準備完了 / 不承認の場合は理由）
- [ ] 不承認が続く場合、理由文言を共有いただければ追加調査する
- [ ] 承認された場合、[ADSENSE_SETUP.md](ADSENSE_SETUP.md)§4-3の段階的展開方針に沿って
      広告表示対象ページを慎重に拡大していく（一括拡大はしない）

## 8. 残課題（今回のスコープ外）

- 既存18本の静的ガイド記事にはFAQPage JSON-LDが無い（新規8記事のみ実装）。追加するかは
  別途判断が必要（低リスクだが対象ファイル数が多いため今回は見送り）。
- `guide/[slug]/page.tsx`のARTICLESマップ内、18スロットぶんの静的ページと重複するエントリは
  実質デッドコード（静的ルートが優先されるため到達不能）。整理は別ラウンドで検討。
- `/premium`への広告表示可否は今回据え置き（§3-2参照）。
