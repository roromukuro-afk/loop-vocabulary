# ADSENSE_REVIEW_CHECKLIST — 再申請に向けた対応記録（2026-07-08）

> AdSense管理画面での再申請操作・審査結果確認はオーナー側で行う。本書はアプリ側で
> 実施した改善内容と、再申請前後に確認すべき項目をまとめたもの。実装の背景・技術詳細は
> [ADSENSE_SETUP.md](ADSENSE_SETUP.md) も参照（本書と一部重複するが、本書は今回の
> 「Low value content」不承認対応に特化した記録）。

## 0. 本番反映確認（2026-07-08）

- 本番デプロイID: `dpl_9hMAdaPfFY4PJ2mEJQ1zfZsgNpfc`（commit `4a3eb93`）READY確認済み
- `verify:prod`・`verify:seo-lp-audit`・`verify:srs-global`いずれも本番で全PASS
- `curl`で本番HTMLを直接確認: `/guide`・`/materials`・`/materials/highschool`は
  AdSense本体スクリプトが出力され、`/terms`・`/login`・`/privacy`・`/dashboard`は
  出力されないことを確認
- **既知の注意点**: トップページ(`/`)のみ、デプロイ直後の確認時点でキャッシュが
  古いバージョンを返していた（`X-Vercel-Cache: HIT`, `Age`が長い）。これは
  `src/app/page.tsx`の統計表示が`unstable_cache({revalidate: 3600})`で1時間
  キャッシュされており、Vercelのデータキャッシュがデプロイをまたいで保持される
  仕様によるもので、今回の広告制限ロジック自体のバグではない（同じ許可ルートである
  `/materials`・`/guide`では即座に正しく反映されていることで裏付け済み）。
  最大1時間以内に自然に反映される。急ぎ確認したい場合はVercelダッシュボードの
  キャッシュパージ、またはブラウザで一度アクセスしてから少し待ってから
  再確認してください。

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
  別途判断が必要（低リスクだが対象ファイル数が多いため今回は見送り）。§9-3でも再監査したが、
  今回も「大量追加はしない」方針のため見送りを維持。
- `guide/[slug]/page.tsx`のARTICLESマップ内、18スロットぶんの静的ページと重複するエントリは
  実質デッドコード（静的ルートが優先されるため到達不能）。整理は別ラウンドで検討。
- `/premium`への広告表示可否は今回据え置き（§3-2参照）。

## 9. 再申請直前の最終監査（2026-07-09）

再申請の前に、追加機能実装ではなく「低価値コンテンツ・広告表示・信頼性」に絞った最終監査を実施した。
対象は既存の実装（§1〜8）全体で、新規の大規模コンテンツ追加は行わず、監査で見つかった
不整合のみを最小限修正した。

### 9-1. インデックス方針・sitemap監査

- **sitemap.tsの重複バグを発見・修正**: 実体感強化ラウンド（前回ラウンド）で`/vocab-check`系
  3URLを追加した際、既存の同一URLブロックに気づかず重複して追加していた。重複ブロックを削除し、
  既存の1ブロックのみに統一（sitemap自体の妥当性・SEO評価に実害はないが、放置すべきでないため修正）。
- **`/signup`をnoindex化**: `/login`には既に`robots: { index: false, follow: true }`が
  設定済みだったが、`/signup`には未設定だった。ログイン・登録画面はコンテンツ量が薄く
  「Thin content」判定の対象になりやすいため、`/login`と同じ扱いに揃えた。
  - **対象**: `src/app/signup/layout.tsx`
  - **理由**: `/login`と同種の認証専用ページであり、既にnoindex化済みの`/login`との一貫性を
    取るため。sitemapからも`/signup`エントリを削除（noindexページをsitemapに残すのは矛盾する
    シグナルになるため）。ただし`robots.txt`でのクロール自体のブロックは行っていない
    （`/signup`は無料登録の価値提案を含む簡単なLPでもあり、クロール自体は許可してリンクを
    辿らせる方が安全と判断。ブロックすると却って「隠している」ような不自然なシグナルになりうる）。
- **確認**: `/dashboard`・`/review`・`/test/*`・`/wordbooks/*`・`/settings`・`/admin/*`・
  `/teacher/*`・`/join/*`など操作系ルートは、`robots.txt`のDisallowとsitemap未掲載の両方で
  既に正しく除外されていることを確認（追加対応不要）。
- **確認**: `/not-found`（カスタム404）はHTTPステータス自体が404のため、meta記述に関わらず
  インデックス対象外であることを確認済み。

### 9-2. AdSense表示対象監査

- `src/lib/ads/adRoutePolicy.ts`の許可ルート（`/`・`/materials`配下・`/guide`配下のみ、
  デフォルト拒否）が、今回指定された許可/非許可リストと完全に一致していることを確認。
  コード変更なし。
- `AppBannerAd`・`AppNativeAdCard`（Web版手動広告枠）も同じルート判定を経由しており、
  `/dashboard`・`/wordbooks`・`/review`など操作画面に広告が出ないことをコードレベルで再確認。

### 9-3. ガイド記事の薄さ・重複監査

- 新規8記事（前回追加分）は1,200字以上・FAQ3件以上・関連リンクを満たしており、再監査でも
  問題なし。
- 既存18本の静的記事（新規追加以前からあるもの）を4本スポットチェック
  （`eitango-oboeru-houhou`・`eiken-2kyu-tango`・`toeic-tango`・`eibunpo-kiso`）した結果、
  いずれも12,000〜15,000字程度の実質的な本文があり「薄い」とは言えないが、FAQPage構造化
  データが無いという共通の欠落を再確認した。今回は「大量追加はしない」という指示のとおり、
  この18本への一括修正は見送り、§8の残課題として据え置いた。
- 記事の大量追加・新規記事作成は行っていない（今回のスコープ外という指示を厳守）。

### 9-4. `/about` 補強

- 内容面（開発背景・忘却曲線の説明・AIの位置づけ・対象読者・免責文）は既に今回要求された
  チェックリストを満たしていたため、新規コンテンツの追加は行っていない。
- 唯一の変更: 運営者情報の段落に`/faq`へのリンクを追加（利用規約・プライバシーポリシー・
  特商法・お問い合わせに加えて、料金や使い方の疑問にはFAQへ誘導する導線を補完）。
- 住所・電話番号の記載、ユーザー数の誇張、断定的な学習効果の主張などは追加していない
  （禁止事項どおり）。特商法ページの内容（table部分）は一切変更していない。

### 9-5. FAQ・お問い合わせ・プレスキット・About・利用規約・特商法の相互導線確認

- `/faq` → `/materials`・`/dictionary`・`/about`・`/press`・トップページへのリンクを追加
  （従来は教材一覧・辞書検索・トップページのみ）。
- `/about` → `/faq`へのリンクを追加（従来は利用規約・プライバシー・特商法・お問い合わせのみ）。
- `/legal/commercial-transaction` → `/faq`・`/about`・`/contact`へのリンク行を新規追加
  （従来はページ内の`/terms`・`/privacy`・`/contact`リンクのみ）。
- `/faq`・`/contact`・`/legal/commercial-transaction`に`canonical`タグが無かったため追加
  （`/premium`・`/materials`・`/dictionary`は既に設定済みで、この3ページのみ抜けていた）。
- `/contact`は元々`/about`・`/faq`・`/privacy`・`/terms`・`/legal/commercial-transaction`・
  `/account/delete`・`/premium`への導線が揃っており、変更不要と判断。
- `/press`をレビュー依頼・Premium無償提供の自動約束の観点で再確認。「掲載してください」
  「ぜひ」「絶対」「必ず」「保証」等の勧誘的・断定的な表現は含まれておらず、既存文言
  「現時点でアフィリエイトプログラムや自動承認によるPremium無償提供の制度はご用意して
  いません」の記載も維持されていることを確認。変更なし。
- 料金・解約・Premium・AI解説・PDF機能・アカウント削除の説明は`/faq`に既に14項目として
  網羅されており、欠落なし。

### 9-6. コンソールエラー・表示崩れ確認

`test:smoke`（Playwright、主要ページの200ステータス・console error・要素表示を検証）を
再実行して確認した（結果は本チェックリスト§0と同様、実行ログは完了報告に記載）。

### 9-7. 今回の変更ファイル一覧

- `src/app/sitemap.ts`（重複ブロック削除、`/signup`エントリ削除）
- `src/app/signup/layout.tsx`（`robots: { index: false, follow: true }`追加）
- `src/app/faq/page.tsx`（canonical追加、`/about`・`/press`リンク追加）
- `src/app/contact/page.tsx`（canonical追加）
- `src/app/legal/commercial-transaction/page.tsx`（canonical追加、`/faq`・`/about`リンク追加）
- `src/app/about/page.tsx`（`/faq`リンク追加）

いずれもnoindex化1件・canonical追加3件・相互リンク追加3件・sitemap重複削除1件の、
指示どおり「必要最小限の補強」にとどめている。新規記事の追加、Stripe・特商法内容・
SRS V2・教師機能・教材データ・AdSense publisher ID・ads.txt・広告枠数への変更は
一切行っていない。

### 9-8. 再申請タイミングについての方針

- 今回の変更はいずれも軽微（noindex・canonical・内部リンクの補強）であり、大規模な
  再クロールを要するものではない。ただし前回ラウンド（実体感強化）で追加した`/about`・
  `/press`・PDF活用ガイド記事がまだSearch Consoleのインデックスに反映しきっていない
  可能性があるため、**新規実装を追加するよりも先に、まずインデックス反映状況を確認する
  ことを推奨する**。
- 今回追加でSearch Console「URL検査」から登録リクエストすべきURL（前回§5のリストに加えて）:
  ```
  https://loop-vocabulary.app/about
  https://loop-vocabulary.app/press
  https://loop-vocabulary.app/faq
  https://loop-vocabulary.app/contact
  https://loop-vocabulary.app/legal/commercial-transaction
  ```
- **再申請前に確認すること（追加分）**:
  - [ ] Search Consoleの「カバレッジ」または「ページ」レポートで、上記URL・前回8記事が
        「インデックス登録済み」になっていることを確認する
  - [ ] `/signup`がSearch Console上で「noindexタグにより除外」等のステータスになって
        いること（意図した挙動）を確認する
  - [ ] AdSenseポリシーセンターに新しい警告が出ていないことを再確認する
- **再申請後、もし再び不承認になった場合の次のステップ**:
  1. 不承認理由の文言をそのまま共有してもらう（今回と同じ理由か、別の理由かで対応が変わる）
  2. 同じ「Low value content」系の理由が続く場合は、既存18記事へのFAQPage追加
     （§8残課題）を次の一手として検討する
  3. ポリシー系の理由（Auto ads・広告配置等）が新たに出た場合は、`adRoutePolicy.ts`の
     許可ルートをさらに絞る方向で調整する
  4. **今回のような「監査のみ」ラウンドを重ねて実装を積み増すより、まずは1回の再申請結果
     とSearch Consoleのインデックス状況を見てから次を判断する**方針とする
- **今後の方針**: インデックスの反映（数日〜1〜2週間程度）を待たずに次の実装ラウンドを
  重ねることはしない。次に着手すべきは「実装の追加」ではなく「今回までの変更が実際に
  Googleにクロール・評価されるのを待つこと」である。
