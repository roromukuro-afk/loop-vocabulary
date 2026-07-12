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

## 10. canonical不整合の緊急修正（2026-07-09、Search Console報告への対応）

§9の完了後、Search Consoleで`/press`・`/guide`一覧・`/guide/*`記事10本（レガシー動的
ルート配信分）のUser-declared canonicalが自己参照になっていない（別ページを指している
ように見える）という報告があり、緊急でAdSense再申請を一旦停止して調査・修正した。

- **実際の原因**: 「前記事のcanonicalをコピペし忘れた」といったチェーン状の誤り自体は
  現行コードには存在しなかった（`/about`・`/press`・静的フォルダ記事はいずれも作成時から
  正しい自己参照URLをハードコードしていたことをgit履歴・現行ソース・本番HTMLで確認済み）。
  実際の不具合は2件、**canonicalの「誤り」ではなく「欠落」**だった。
  1. `/guide`（一覧ページ）に`alternates.canonical`が設定されていなかった
  2. `guide/[slug]/page.tsx`（静的フォルダに未移行の旧記事10本を配信する動的ルート）の
     `generateMetadata`がcanonicalを返しておらず、該当10記事がcanonicalなしで配信されていた
- **修正ファイル**: `src/app/guide/page.tsx`・`src/app/guide/[slug]/page.tsx`
- **追加テスト**: `test:canonical-integrity`（`/about`・`/press`・`/guide`・静的記事9本・
  レガシー動的記事10本、計22URLのcanonical自己参照・noindex非設定・sitemap収録・
  robots.txt非ブロックを検証）
- 本番デプロイ後、対象22URLすべてでcanonicalが自己参照になっていることをcurlで直接確認済み

## 11. 追加監査ラウンド（2026-07-09、公開辞書・プライバシー・ガイド構成・信頼性）

「低価値コンテンツ・広告表示」の観点で追加の8項目を監査し、見つかった不整合を修正した。

### 11-1. 「辞書だけ試す（登録不要）」の実挙動確認

- 懸念（`/dictionary`が実はログイン要求される）は**再現しなかった**。コード
  （`src/app/dictionary/page.tsx`にroot middlewareなし、`AppShell`に認証チェックなし）・
  本番HTML（未ログインで200・「ログイン不要で英単語を検索できます」表示）・DB RLS
  （`material_words`は匿名SELECT許可、`words`はユーザー自身のみで匿名は空配列）の
  3方向で確認し、いずれも「登録不要」の表示どおり動作している。
- 再発防止のため`test:public-dictionary`を新規追加（未ログインで200・リダイレクトなし・
  検索結果表示・「単語帳に追加」ボタン非表示・「無料登録」導線表示・noindex非設定・
  canonical自己参照を検証）。コード変更は無し。

### 11-2. `/privacy`のAdSense（Web）Cookie対応確認

- 既に「3. 広告について」セクションに、Web版AdSenseにおけるGoogle等third-partyの
  Cookie使用・パーソナライズ広告への言及・Google広告設定へのオプトアウト導線・
  Googleの広告ポリシーへのリンクが記載済みであることを確認した。アプリ版AdMobとWeb版
  AdSenseの記載も明確に分けられている。コード変更は不要と判断。

### 11-3. `/guide`のカテゴリ別整理

- 37記事すべてを12カテゴリ（記憶法・忘却曲線／英検対策／TOEIC対策／大学受験英単語／
  定期テスト・高校英語／リスニング・発音／英文法／長文読解／AIを使った英単語学習／
  PDF小テスト・教育者向け／英単語帳レビュー・比較／英会話・資格・ビジネス英語）に
  分類し、カテゴリ見出し・カテゴリジャンプナビ・「はじめての方へ」おすすめ3記事
  セクションを追加した。既存記事のURL・tagは一切変更していない。
  - **変更ファイル**: `src/app/guide/page.tsx`

### 11-4. 公開辞書・単語詳細ページ（`/dictionary/[word]`）の実現可能性調査

今回は調査・提案のみで実装は行っていない（大量ページの拙速な公開を避けるため）。

- `material_words`は33,392行・distinct 15,614語だが、例文（`example`）を持つのは
  3,887行（約12%）のみ。品詞・発音表記の専用カラムは無い（発音はブラウザのWeb Speech
  APIによる読み上げのみで、音声データの保存は無い）。
- `materials`テーブルは全46件が`license_status = 'approved'`（許諾確認済み）または
  `'original'`（自社作成）のみで、権利未確認データが混入するリスクは無い。
- **提案**: いきなり全15,614語を公開するのではなく、(1) 例文を持つ語に限定、
  (2) 複数教材にまたがる語は意味・例文を集約して1ページの情報量を厚くする、
  (3) まず50〜100語の小規模PoCとして`noindex`で公開し、表示崩れ・重複コンテンツの
  有無を確認してから`index`許可を判断する、という段階的な進め方を推奨する。
  単語帳への追加操作のみログイン導線とする設計は`/dictionary`の既存パターンを踏襲できる。

### 11-5. SSR/SSGクローラー可読性監査

- `/`・`/guide`・`/guide/*`記事2本・`/materials`・`/materials/highschool`・
  `/materials/eiken`・`/materials/university-exam`・`/materials/school-test`・
  `/dictionary`・`/about`・`/press`・`/privacy`・`/faq`・`/contact`の計15ページを
  JavaScript実行なしのfetchで直接確認し、いずれもタグ除去後の本文テキスト・JSON-LD・
  canonicalがHTMLに直接出力されていることを確認した（client-onlyの空シェルは無し）。
- 再発防止のため`test:crawler-readable-pages`を新規追加。

### 11-6. 著作権・教材データについてのページ追加

- `/legal/content-policy`（教材データ・著作権について）を新設。収録教材データの許諾方針、
  市販単語帳の紹介記事が非公式・商標は各権利者に帰属する旨、CSVインポート時の注意、
  権利者向けの問い合わせ導線を記載。特商法ページの内容は変更していない。
  - `/terms`§4・`/faq`・`/contact`・`/legal/commercial-transaction`から相互リンク
  - 市販単語帳を比較する5記事（system-eitango・target-1900・systan-vs-target-1900・
    leap-eitango・eitango-cho-hikaku）に非公式である旨の注記とリンクを追加
  - sitemap.tsに追加、robots.txtでブロックされていないことを確認
  - `test:legal-trust-pages`に§10として検証項目を追加

### 11-7. Premium/Free表記の整合性監査

- **発見**: サイト全体で「AI解説無制限」という表記が18箇所（`/premium`・`/faq`・
  `/terms`・`/settings`・`/dashboard`・`/learn`・`/test/typing`・`/premium/success`・
  `/legal/commercial-transaction`・ホームページ・学習ガイド記事2本）に存在していたが、
  実際にはPremiumでも他のAI機能と合算で**1日300回のソフト上限**（`src/lib/ai/aiQuota.ts`、
  `supabase/migrations/015_atomic_ai_quota.sql`）がある。すべて「300回/日」という
  正確な表記に修正した。
- PDF出力（Premiumで実装上の上限なし）・単語帳/単語登録（実装上の上限なし）・
  CSV一括インポート（5000語/回、無制限とは謳っていない）の「無制限」表記は、
  実装を確認のうえ正確であることを確認し、変更していない。
- teacher機能がPremium限定であるかのような表記は見つからなかった（コード上も
  Premium判定なしで無料利用可能であることと一致）。

### 11-8. 今回の変更ファイル一覧

- `src/app/guide/page.tsx`（カテゴリ別整理）
- `src/app/guide/[slug]/page.tsx`（商標注記追加）
- `src/app/legal/content-policy/page.tsx`（新規）
- `src/app/sitemap.ts`（`/legal/content-policy`追加）
- `src/app/terms/page.tsx`（`/legal/content-policy`リンク追加）
- `src/app/faq/page.tsx`（同上）
- `src/app/contact/page.tsx`（同上）
- `src/app/legal/commercial-transaction/page.tsx`（同上）
- `src/app/premium/page.tsx`・`src/app/faq/page.tsx`・`src/app/page.tsx`・
  `src/app/legal/commercial-transaction/page.tsx`・
  `src/app/guide/flashcards-vs-multiple-choice/page.tsx`・
  `src/app/guide/how-to-memorize-english-words/page.tsx`・`src/app/terms/page.tsx`・
  `src/app/settings/page.tsx`・`src/app/dashboard/page.tsx`・
  `src/app/learn/LearnRunner.tsx`・`src/app/test/typing/page.tsx`・
  `src/app/premium/success/page.tsx`（AI「無制限」表記の修正、計18箇所）
- `scripts/testing/e2e/public-dictionary.mjs`（新規）
- `scripts/testing/e2e/crawler-readable-pages.mjs`（新規）
- `scripts/testing/e2e/legal-trust-pages.mjs`（§10追加）
- `scripts/testing/run-e2e.mjs`・`package.json`（新規テスト2本を登録）

Stripe価格・Stripe checkout・Premium課金ロジック・特商法ページ内容・SRS V2 ON状態・
teacher機能・教材データ本体・AdSense publisher ID・ads.txt・広告枠数への変更は
一切行っていない。

## 12. 広告プレースホルダーの安全確認（2026-07-12、グロース計測ラウンド）

### 12-1. 現在の広告アーキテクチャの再確認

Web版の広告は `AdSenseLoader.tsx`（`src/app/layout.tsx`から読み込み）による
**Auto ads（`enable_page_level_ads: true`）のみ**で、ページ内の個別要素に手動で
`<ins class="adsbygoogle">`スロットを配置している箇所は無い（`src/components/ads/AdComponents.tsx`は
Capacitor/AdMobアプリ版向けのコンポーネントで、Web版のAdSenseとは別経路）。
つまりWeb版の広告制御は事実上すべて`src/lib/ads/adRoutePolicy.ts`の
**ルート単位ホワイトリスト**に集約されている。

### 12-2. 許可ルートの現状（変更なし）

- `/`（完全一致）
- `/materials`・`/materials/*`
- `/guide`・`/guide/*`
- `/dictionary/[word]`（`/dictionary`本体はサブパスのみ許可のため対象外）

上記以外の全ルート（`/dashboard`・`/wordbooks`・`/review`・`/test/*`・`/learn`・`/pdf`・
`/login`・`/signup`・`/premium`・`/settings`・`/contact`・`/terms`・`/privacy`・
`/legal/*`・`/vocab-check*`）では`AdSenseLoader`がスクリプト自体を読み込まないため、
広告要素が一切出現しない。オーナー指定の「広告を避ける場所」（フラッシュカード操作中・
「覚えた」「忘れた」ボタン付近・テスト選択肢付近・ログイン/登録/決済/問い合わせ/規約・
PDF生成画面・学習中の主要操作UI）は、コードを確認した結果すべて許可リスト外であることを
再確認した。**問題は見つからず、変更は行っていない。**

### 12-3. 「診断結果画面の下部」への広告追加を見送った判断

オーナー指定の許可場所に「診断結果画面の下部」（`/vocab-check`系の結果画面）が
含まれているが、今回は`/vocab-check`を許可リストに追加**しなかった**。理由:

`/vocab-check`・`/vocab-check/eiken`・`/vocab-check/toeic`はいずれも、
「問題に回答する画面」と「結果画面」が**同一URL・同一クライアントコンポーネント内**で
`done`という状態フラグの切り替えだけで表示を出し分けている（別ルートに遷移しない）。
Auto ads はページ単位でGoogle側のアルゴリズムが自動配置する仕組みのため、
ルートを許可リストに追加すると**回答中の画面（テスト選択肢付近）にも広告が出現しうる**。
これはオーナー指定の「広告を避ける場所」に明確に抵触するため、今回は見送った。

結果画面のみに限定して広告を出したい場合は、次のいずれかの対応が必要になる
（今回は実装しない、次回検討時の選択肢として記録）。

- 結果画面を`/vocab-check/result`のような別ルートに分離する
- Auto ads ではなく、`done===true`のときだけクライアント側で読み込む手動広告ユニットに
  切り替える（Auto ads の設定だけでは画面内の特定ゾーンを狙い撃ちできないため）

「安全確認」が今回の目的であり「広告枠を増やしすぎない」という指示とも整合するため、
確実に安全と言えない状態で許可リストを広げるより、現状維持を選んだ。

### 12-4. 結論

既存の広告ポリシー・実装に問題は見つからなかった。コード変更は無し。

## 13. 広告プレースホルダー最終設計（Phase 9・プログラマティックSEO/AEO拡張ラウンド）

### 13-1. 許可場所の最終リスト（現状維持、変更なし）

| 場所 | 状態 | 備考 |
|---|---|---|
| `/guide/*` 記事本文中・記事下 | ✅ 許可済み | Auto ads、ルート単位で許可 |
| `/dictionary/[word]` 下部 | ✅ 許可済み | サブパスのみ許可（`/dictionary`本体は非許可） |
| `/materials/*` 下部 | ✅ 許可済み | Auto ads、ルート単位で許可 |
| `/vocab-check` 結果画面下部 | ⏸ 保留 | 12-3参照。回答中の画面と同一ルートのため見送り |
| 復習10問完了後のリザルト画面 | ⏸ 保留 | `/review`は学習操作画面全体が同一ルートのため、12-3と同じ理由で見送り |

### 13-2. 禁止場所の最終リスト（現状維持、変更なし）

フラッシュカード操作中・「覚えた」「忘れた」ボタン付近・4択選択肢付近・入力欄付近・
ログイン/登録/決済/規約・PDF生成画面。いずれも`adRoutePolicy.ts`のホワイトリスト外で
あることを`test:adsense-safe-placements`で継続的に検証している。

### 13-3. 「結果画面だけに限定して広告を出す」ための今後の選択肢（実装しない、記録のみ）

`/vocab-check`・`/review`とも、結果画面だけに広告を限定したい場合は次のいずれかが必要:

1. 結果画面を独立ルートに分離する（例: `/vocab-check/result`, `/review/complete`）
2. Auto ads をやめて、`done===true`のときだけクライアント側で読み込む手動広告ユニットに切り替える

どちらも現時点では実装しない。AdSense通過後、実際の運用データを見てから判断する。

### 13-4. 結論

今回も広告枠は増やさない。設計を明文化し、`test:adsense-safe-placements`で
新たに追加したページ（`/reports`等）を含めて非許可ルートに広告が出ないことを確認した。
