# ADSENSE_SETUP — Google AdSense 審査・運用ガイド

> AdSense管理画面の操作・審査状況の確認はオーナー側で行う。本書はアプリ側の実装状況、
> 管理画面で見るべき項目、そして今回発見・修正した不足点をまとめたもの。

## 0. 現在のステータス（2026-07-04調査時点 → 同日中に広告ユニット1件を本番投入）

- **サイト側のAdSense実装**: 実装済み（プレースホルダではない）
  - `layout.tsx`に `<meta name="google-adsense-account" content="ca-pub-5148247638505100">` を常時出力
  - `NEXT_PUBLIC_ADSENSE_CLIENT`環境変数がVercel Production環境に設定済み。設定されている場合、
    `adsbygoogle.js`（Google公式スクリプト）を読み込み、自動広告（`enable_page_level_ads: true`）を有効化
  - `public/ads.txt`公開済み（`google.com, pub-5148247638505100, DIRECT, f08c47fec0942fa0`）。
    `layout.tsx`の`ca-pub-5148247638505100`と一致（矛盾なし）
- **AdSense管理画面のサイトステータス（オーナー確認、2026-07-04）**: `Getting ready`。
  ads.txtはAuthorized、ポリシーセンター警告なし、自動広告ON、広告ユニット作成可能な状態
- **広告ユニット「Loop Vocabulary Display Banner」を1件作成・本番投入済み（2026-07-04）**:
  - 種類: ディスプレイ広告 / サイズ: レスポンシブ / `data-ad-slot="5952840845"`
  - `NEXT_PUBLIC_ADSENSE_SLOT_BANNER=5952840845` をVercel Production環境変数に設定済み
  - 表示箇所は**`/dashboard`の1ページのみ**に限定（本書§4参照）。`Getting ready`段階での
    最初の実配置のため、意図的に最小限に絞っている
  - `NEXT_PUBLIC_ADSENSE_SLOT_RECTANGLE` / `_INFEED` は引き続き未設定 →
    `AdSenseRectangle`/`AdSenseInFeed`（`NativeAdCard`が内部で使用）は本番で何も表示しない

---

## 1. アプリ側の審査対応チェック結果（2026-07-04調査・一部修正済み）

| 項目 | 結果 |
|---|---|
| AdSense関連の環境変数 | ✅ `NEXT_PUBLIC_ADSENSE_CLIENT`設定済み（Production）。広告ユニット3種は未設定 |
| 広告コード（`adsbygoogle.js`・`<ins class="adsbygoogle">`） | ✅ `src/app/layout.tsx`・`src/components/ads/AdSense.tsx`に実装済み |
| `ads.txt` | ✅ `public/ads.txt`に公開済み、`layout.tsx`のPublisher IDと一致 |
| `robots.txt` / sitemap / noindex設定 | ✅ 2026-07-01のSearch Console登録時に監査・修正済み（[SEARCH_CONSOLE_SETUP.md](SEARCH_CONSOLE_SETUP.md)参照）。主要な公開ページ（トップ・教材一覧/詳細・辞書・ガイド・文法・FAQ・プライバシー・利用規約）はすべてクロール可能 |
| プライバシーポリシーの広告記載 | ⚠️→✅ **修正済み**（本書§3参照）。従来はAndroid/iOSアプリ版のAdMobのみ記載されており、Web版のGoogle AdSense・広告Cookie・オプトアウト手段の記載が無かった |
| 利用規約・お問い合わせ導線 | ✅ `/terms`・`/contact`とも実装済み（お問い合わせページ・メールリンクあり） |
| 未ログインでのコンテンツ閲覧 | ✅ トップ・`/materials`一覧・`/materials/[id]`詳細・`/dictionary`・`/guide`・`/grammar`・`/faq`はすべて未ログインでも本文が閲覧できる（ログイン必須ページは`/dashboard`等の学習系機能のみ） |
| Search Console登録状況との整合性 | ✅ 矛盾なし。2026-07-01にURLプレフィックスで登録済み、sitemap送信済み（Discovered pages: 69） |

### 発見・修正した不足点

**プライバシーポリシーがWeb版のAdSenseに触れていなかった**: `src/app/privacy/page.tsx`の
「3. 広告について」は、従来「Android / iOS アプリ版でGoogle AdMobを利用」という記載のみで、
Web版のAdSense・広告Cookie・第三者配信・オプトアウト手段への言及が無かった。AdSenseの
プログラムポリシーは、広告Cookieの使用と第三者（Google）による配信について開示することを
推奨している。以下を追記した:

> Web 版では **Google AdSense** を利用して広告を配信する場合があります。
> Google を含む第三者配信事業者は Cookie を使用し、ユーザーが本サービスや他のウェブサイトに
> アクセスした際の情報に基づいて広告を配信することがあります。ユーザーは
> [Google 広告設定](https://adssettings.google.com/) でパーソナライズ広告を無効にできるほか、
> [Google の広告に関するポリシー](https://policies.google.com/technologies/ads) もあわせて
> ご確認ください。

---

## 2. AdSense管理画面で確認すべき項目（オーナー操作）

<https://www.google.com/adsense/> にログインし、以下を確認してください。

### 2-1. サイトの審査ステータス

- 左メニュー「サイト」→ `loop-vocabulary.app` の行に表示されるステータスを確認
  - **「準備完了」** : 審査通過。広告ユニットの作成・自動広告の有効化が可能
  - **「取得中」「レビュー中」**: 審査待ち。通常数日〜数週間かかる
  - **「要確認」「対応が必要」**: ポリシー違反やads.txtの問題がある可能性。詳細は該当行をクリック
  - **「不承認」**: 不承認理由がサイト詳細画面に表示される（コンテンツ不足・ポリシー違反・ads.txt未検出など）

### 2-2. ads.txtの警告有無

- 「サイト」の詳細、または「ポリシーセンター」に ads.txt 関連の警告が出ていないか確認
- 本サイトの`ads.txt`はすでに正しく公開済み（本書§0参照）なので、警告が出ている場合は
  Googleのクロールが最新の`ads.txt`をまだ検出できていないだけの可能性がある（反映まで数日かかることがある）

### 2-3. ポリシーセンターの警告有無

- 左メニュー「ポリシーセンター」で、コンテンツポリシー違反・低品質コンテンツ・
  クリック誘導などの警告が出ていないか確認
- 警告が出ている場合は、警告文言をそのまま共有してください。アプリ側の該当箇所を調査します

### 2-4. 広告ユニット作成・自動広告の有効化可否

- 「広告」→「サマリー」または「広告ユニットごと」で、新規広告ユニットを作成できる状態か確認
  （審査完了前は作成自体ができないか、作成できても配信されない）
- 「広告」→「自動広告」で、サイトの自動広告が有効化できる状態か確認

### 2-5. 私が対応できること

広告ユニットを作成すると、Google側で `data-ad-slot="XXXXXXXXXX"` の形式でスロットIDが
発行されます。**このスロットIDは私が勝手に推測・作成することはできません**。発行された
スロットID（バナー用・レクタングル用・インフィード用、いずれか使う分だけでOK）を共有
いただければ、`NEXT_PUBLIC_ADSENSE_SLOT_BANNER` 等としてVercelに設定し、実際の広告表示を
有効化します（このタイミングでUIへの表示を大量に増やすことはせず、既存の「テスト中・復習中は
広告を表示しない」ポリシーを維持したまま段階的に有効化します）。

---

## 3. 修正した実装内容

- `src/app/privacy/page.tsx`: 「3. 広告について」にWeb版AdSenseの開示（Cookie利用・
  オプトアウトリンク）を追記。既存のAdMob（アプリ版）の記載は変更していない
- `README.md`: §7を「広告の差し替え位置 (AdMob 導入)」という旧タイトル・
  プレースホルダ前提の説明から、実際にAdSense/AdMobへ接続済みである現状に合わせて更新

**変更していないもの**（AdSense管理画面での操作・発行が必要なため）:
- 広告ユニットのスロットID（`NEXT_PUBLIC_ADSENSE_SLOT_BANNER`等）→ **2026-07-04にオーナーが作成・
  発行済み**（§4参照）。Publisher ID・スロットIDとも新規作成・推測はしていない
- Publisher ID（`ca-pub-5148247638505100`・`ads.txt`）— 既存の値をそのまま使用
- 課金・Premium広告非表示プランの本番導入

---

## 4. 広告ユニットの本番投入（2026-07-04）

オーナーがAdSense管理画面で「Loop Vocabulary Display Banner」（ディスプレイ広告・レスポンシブ）
を作成し、`data-ad-slot="5952840845"` が発行された。これを受けて以下を実施した。

### 4-1. 環境変数設定

`NEXT_PUBLIC_ADSENSE_SLOT_BANNER=5952840845` をVercel Production環境変数に設定
（`vercel env add` で追加。Preview/Developmentには追加していない）。

### 4-2. 表示箇所を最小限に絞り込み

修正前の実装では`BannerAdPlaceholder`（内部的に`AdSenseBanner`を呼ぶ）が以下10箇所
（9ページ）に配置されていた: `dashboard` / `learn`(レッスン結果画面) / `materials`(検索結果・
カテゴリ一覧の2箇所) / `materials/[id]` / `review` / `road` / `settings` / `stats` / `weak` /
`wordbooks/[id]`。

スロットIDが有効化されると、これら全箇所で一斉に実広告が表示される状態だったため、
AdSenseがまだ`Getting ready`（審査未確定）であることを踏まえ、**最初の本番投入は
`/dashboard`の1箇所のみに限定**し、残り8ページからは`BannerAdPlaceholder`の呼び出しを削除した
（インポートも合わせて削除、`NativeAdCard`の呼び出しはそのまま残置——こちらは
`NEXT_PUBLIC_ADSENSE_SLOT_INFEED`が未設定のため本番では引き続き何も表示されない）。

`/dashboard`の配置は、統計カードや学習導線などのメインコンテンツすべての後、「先生向け機能への
導線」よりさらに下という、ページ最下部・区切り位置(このページの中で最後の要素)にあり、
学習操作やボタンを妨げない。レイアウト崩れ防止のため`AdSenseBanner`は`minHeight: 90`を
指定しており、広告が配信されない場合もレイアウトが潰れない。

**削除した8ページ**: `materials`（2箇所）・`materials/[id]`・`review`・`road`・`settings`・
`stats`・`weak`・`wordbooks/[id]`・`learn`(レッスン結果画面)。いずれもコード自体を削除しており
（コメントアウトではない）、再度表示したくなった場合は`git log`から該当コミットの差分を参照し、
`BannerAdPlaceholder`の呼び出しとimportを復元すれば良い。

### 4-3. 今後の拡大方針（2026-07-04オーナー承認済みの方針）

現時点(2026-07-04)ではこれ以上の実装は進めず、AdSenseの審査状況待ちとする。
`Ready / 準備完了`になったら、以下の順番で他ページへの再展開を検討する
（各ページ追加ごとにオーナー承認を得てから実装する。一括で全ページに追加はしない）。

1. `/materials`
2. `/materials/[id]`
3. `/dictionary`
4. `/guide`
5. `/grammar`
6. `/faq`

これらはいずれも未ログインでも閲覧できる公開・参照系ページ。学習中画面（`/learn`・
`/test/*`各モード）・復習中画面（`/review`実行中）・タイムアタック・入力フォーム周辺には
**当面追加しない方針**（操作の妨げになるため）。

### 4-4. オーナーがAdSense管理画面で定期確認する項目

- サイトステータスが`Getting ready`から`Ready / 準備完了`に変わるか
- ads.txtが引き続きAuthorizedか
- ポリシーセンターに警告が出ていないか
- 「広告」→「サマリー」で表示回数・クリック・推定収益が出始めるか
- 自動広告(Auto Ads)が他ページに表示され始めた場合、学習体験を妨げていないか

> **2026-07-08追記**: 上記「Auto Ads自体はアプリ側から制御できない」は不正確だったため
> 訂正する。AdSense本体スクリプト（Auto ads含む）の読み込み自体をルート単位で制御できることを
> 確認し、`src/lib/ads/adRoutePolicy.ts` + `src/components/ads/AdSenseLoader.tsx`で実装した。
> 現在は`/` ・`/materials`（配下）・`/guide`（配下）以外のページではAuto ads自体が読み込まれず、
> `/dashboard`等の操作画面・`/terms`等の法務ページには一切広告が表示されない。詳細・経緯は
> [ADSENSE_REVIEW_CHECKLIST.md](ADSENSE_REVIEW_CHECKLIST.md)を参照。

---

## 次回チェック時に共有いただきたい情報

- AdSense管理画面「サイト」でのステータス表示の変化（`Getting ready` → `準備完了`等、
  不承認の場合はその理由文言）
- `/dashboard`の広告が実際に配信されているか（表示回数・クリック率がAdSense管理画面の
  「広告」→「サマリー」で確認できるようになったら共有してください）
- ポリシーセンターに新しい警告が出ていないか
- 他ページへの展開を進めてよいかどうかの判断（§4-3参照）
