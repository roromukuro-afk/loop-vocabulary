# PRIVACY_CMP_ADSENSE_AUDIT — CMP/Cookie/Privacy/広告開示の正確性監査（Phase 5・2026-07-12）

> AdSense本審査に進む前に、「プライバシー開示の文言」と「実装の実態」が一致しているかを
> コードベース側から監査した記録。AdSense管理画面（Privacy & messaging / 広告関連設定）で
> しか確認・設定できない項目はコードから検証不可能なため、本書では明確に分離して記載する
> （§3「AdSense管理画面で人間が確認する必要がある項目」）。

## 0. 前提・スコープ

- 対象: `src/app/privacy/page.tsx`（プライバシーポリシー本文）、広告読み込み実装
  （`AdSenseLoader.tsx` / `adRoutePolicy.ts` / `admob.ts`）、GA4イベント実装
  （`src/lib/analytics/events.ts`）、CMP/Cookieバナー系コンポーネントの有無。
- Stripe/決済/チェックアウト、AdSense publisher ID、`public/ads.txt`、学習セッション画面への
  広告追加は指示により対象外（変更していない）。
- `/privacy` の内容は本ラウンド以前（過去ラウンドのコミット `13c0732`
  「ai_usage_eventsの保持期間・削除運用を整備し、/privacyのAI利用記載を整合させる」、
  `341d481`「公開辞書・privacy/canonical欠落・ガイド構成・著作権ページ・Premium表記を
  監査・修正」、および`ADSENSE_REVIEW_CHECKLIST.md`記載の`legal-trust-pages`監査）で
  既にGoogle Analytics・Microsoft Clarity・Google AdSense・AdMob・Cookie・パーソナライズ
  広告オプトアウト・13歳未満の利用制限について記載済みだった。今回はこれらの記載が
  現在の実装と正確に一致しているかを再監査し、1件の記載を精緻化した。

## 1. コードで検証できた事実（(A)バケット）

### 1-1. `/privacy` の開示内容と実装の突き合わせ

| 開示項目 | `/privacy` での記載箇所 | 実装での裏付け |
|---|---|---|
| Google Analytics | 4章「アクセス解析」 | `src/app/layout.tsx` で `NEXT_PUBLIC_GA_ID` が設定されている場合のみ `gtag.js` を読み込み |
| Microsoft Clarity | 4章「アクセス解析」 | `src/app/layout.tsx` で `NEXT_PUBLIC_CLARITY_ID` が設定されている場合のみ Clarity タグを読み込み |
| Google AdSense（Web版） | 3章「広告について」 | `src/components/ads/AdSenseLoader.tsx` が `isAdsAllowedPath()` を満たすルートのみで `adsbygoogle.js` を読み込み（`src/lib/ads/adRoutePolicy.ts`：許可は `/`・`/materials`配下・`/guide`配下・`/dictionary/[word]`のみ、デフォルト拒否） |
| Google AdMob（アプリ版） | 3章「広告について」 | `src/lib/native/admob.ts`：`nonPersonalizedOptions()` が全広告リクエスト（banner/interstitial/rewarded）に `npa: true` を付与、iOS では `requestTrackingAuthorization()`（ATT）を初期化時に呼び出し |
| Cookie利用（広告） | 3章「広告について」 | AdSense/AdMobともにGoogle公式SDK/スクリプト経由であり、Cookie利用はGoogle側の標準動作 |
| パーソナライズ広告オプトアウト | 3章「広告について」 | Web: `https://adssettings.google.com/` へのリンクを記載。アプリ: 既定で `npa: true`（非パーソナライズ）+ 端末設定でのオプトアウト案内 |
| 13歳未満の利用 | 7章、6-4章 | `src/app/terms/page.tsx` 2章「13 歳未満の方は、保護者の同意のもとで利用してください」と表現・閾値とも一致（`/terms`・`/privacy`間で13歳表記が揃っていることを確認） |
| 第三者への提供 | 5章 | Stripe（決済）・Anthropic（AI解説）・Supabase（認証/DB）を4章に列挙、目的外利用なしと明記 |

### 1-2. GA4イベントのPIIチェック

`src/lib/analytics/events.ts` の全 `gtag()` 呼び出し（約35関数）を確認。送信パラメータは
`plan` / `method` / `guide_slug` / `word_slug` / `variant` / `question_index` / `correct` /
`score` / `level` / `event_category` など、ページ種別・操作種別・匿名の集計値のみで、
**メールアドレス・氏名・単語帳の中身（登録単語そのもの）を event params として送信している
箇所は見つからなかった**（`src/app` 配下・`src/lib` 配下で `gtag(` を直接呼んでいるのは
`events.ts` と `layout.tsx`（`gtag('config', ...)` の初期化呼び出しのみ）の2ファイルに
限定されており、他コンポーネントが独自に `gtag()` を呼んでPIIを混入させている形跡はない）。

`/privacy` 4章の「メールアドレス・氏名・単語帳の内容など個人を特定できる情報は送信しません」
という記載は、この確認結果と一致している。

### 1-3. CMP/Cookieバナーの有無

`consent` / `CMP` / `cookie banner` / `funding choices` / `FundingChoices` で `src/` 全体を
検索したが、該当するのは教師機能の「クラス参加同意」（`JoinConsentClient.tsx` 等、広告Cookie
とは無関係な学習データ共有の同意）のみで、**広告向けのCookie同意バナー・CMP実装はコード上
存在しない**ことを確認した。`AdSenseLoader.tsx` にも Funding Choices のスクリプトタグは
含まれていない。

これは実装漏れではなく、そもそもGoogleのCMP（Privacy & messaging / Funding Choices）は
AdSense管理画面側でメッセージを作成・有効化する運用であり、コード側で必要になるのは
（有効化された場合に自動注入される）タグの読み込みを妨げないことのみである。現状
`AdSenseLoader.tsx` は許可ルート以外でAdSense本体スクリプト自体を読み込まないため、
CMPが管理画面側で有効化されれば許可ルートでは通常どおり動作する設計になっている。

### 1-4. `/privacy` に対して実施した修正

**修正箇所**: 4章「決済・AI機能における外部サービスの利用」内、アクセス解析の項目。

- **Before**:
  > アクセス解析（Google Analytics, Microsoft Clarity）: サービス改善のため、どのページが
  > どれだけ利用されているか等をアクセス解析ツールで計測しています。送信するのはページの
  > 種類・操作したボタンの種類・匿名の識別子・アクセス日時等のみで、メールアドレス・氏名・
  > 単語帳の内容など個人を特定できる情報は送信しません。

- **After**:
  > アクセス解析（Google Analytics, Microsoft Clarity）: サービス改善のため、Google
  > Analytics でどのページがどれだけ利用されているか等のイベントを計測するほか、
  > Microsoft Clarity では画面内のクリック・スクロール等の操作を録画するヒートマップ・
  > セッション記録機能を利用しています。これらのツールに送信するのはページの種類・操作
  > したボタンの種類・匿名の識別子・アクセス日時等のみで、メールアドレス・氏名・単語帳の
  > 内容など個人を特定できる情報をイベントパラメータとして送信することはありません。
  > ただし Microsoft Clarity のセッション記録機能は画面表示内容を録画する性質上、入力欄の
  > マスキング（伏字化）設定は Microsoft Clarity 管理画面側の設定に依存します。

- **理由**: 従来の文言はMicrosoft ClarityをGoogle Analyticsと同種の「イベント計測ツール」
  として一括りに説明していたが、Clarityの実際の機能はヒートマップ・セッション記録
  （画面操作の録画）であり、GA4の離散イベント計測とは性質が異なる。実装（`gtag()`経由の
  イベントにPIIが乗らないこと）自体は変わらないが、Clarityの録画機能が入力欄をどこまで
  マスクするかはClarity管理画面側の設定（Strict/Balanced/Relaxed等）に依存し、**コードからは
  検証できない**。この依存関係を偽らずに開示するよう文言を精緻化した（過大な安全主張を
  避けつつ、実装しているツールの性質を正確に説明する）。
- それ以外の項目（GA/AdSense/AdMob/Cookie/オプトアウト/13歳未満）は、実装との照合の結果
  既に正確だったため変更していない。

### 1-5. 変更しなかったファイル

`AdSenseLoader.tsx`・`adRoutePolicy.ts`・`admob.ts`・`events.ts`・`layout.tsx`・
`terms/page.tsx` はいずれも実装と開示の不一致が見つからなかったため変更していない。
AdSense publisher ID・`public/ads.txt`・Stripe/決済関連・学習セッション画面（`/learn`・
`/review`等）への広告追加は指示どおり一切変更していない。

## 2. 新規追加したテスト

`scripts/testing/e2e/privacy-ads-disclosure.mjs`（`npm run test:privacy-ads-disclosure`）：
`/privacy` を生fetchし、HTML本文（タグ除去後）に以下5トピックへの言及が残っていることを
機械的に検証する回帰テスト。

1. Google Analytics（または GA4）
2. Microsoft Clarity
3. Google AdSense（または「広告」という語）
4. Cookie
5. パーソナライズ広告のオプトアウト手段（`adssettings.google.com` / 「パーソナライズ広告」/
   「広告設定」のいずれか）

将来 `/privacy` の文言をリライトした際に、これらのトピックがうっかり削除されるのを防ぐための
軽量な回帰ガード。文言の法的妥当性そのものを判定するテストではない。

実行結果（2026-07-12時点）: 全項目PASS。`npx tsc --noEmit` もエラーなしを確認済み。

## 3. AdSense管理画面で人間が確認する必要がある項目（(B)バケット）

以下はGoogleのAdSense/Google Ad Manager管理画面でしか確認・設定できず、**このリポジトリの
コードからは検証も設定もできない**。オーナー側での確認・対応が必要。

- [ ] **EEA/UK/スイス向けGoogle認定CMPメッセージの作成・公開**（「プライバシーとメッセージ」/
      Privacy & messaging セクション）。§5（Phase 6）でコード側のCMPタグ埋め込みは実装済みだが、
      **AdSense管理画面側で実際にGDPR/UK/CH向けメッセージを作成・公開する作業はオーナーが
      行う必要がある**（コードからは作成・公開できない）。メッセージ未公開の状態では
      Funding Choicesタグ自体はページに読み込まれるが、対象地域からのアクセスであっても
      同意UIは表示されない。
- [ ] **EEA向けユーザーに対するパーソナライズ広告の同意取得前デフォルト状態**
      （同意取得前はパーソナライズ広告オフ・非パーソナライズ広告のみ配信、が既定として
      正しく設定されているか）。これは「プライバシーとメッセージ」でメッセージを作成する際の
      設定項目（Google側が地域法制に応じて標準で強制する挙動）であり、コード側では制御しない
      （§5参照。`AdSenseLoader.tsx`・`adRoutePolicy.ts`はAuto ads自体のON/OFFをルート単位で
      制御しているのみで、地域別の同意state分岐はGoogle側のCMP機構に委ねる設計を維持）。
- [ ] **`ads.txt` の Authorized 状態**。`public/ads.txt` の内容自体は今回変更していないが
      （`google.com, pub-5148247638505100, DIRECT, f08c47fec0942fa0`）、Googleのクロールが
      これを正しく認識し「Authorized」ステータスになっているかはAdSense管理画面の
      「サイト」または「ads.txt」ステータス画面で確認する必要がある。
- [ ] **AdSenseアカウント自体の審査ステータス**（`ADSENSE_REVIEW_CHECKLIST.md` に記載の
      過去の不承認理由「Low value content」等への対応後、再申請結果がどうなったか）。
      これは管理画面の「サイト」タブでのみ確認できる。
- [ ] **Auto ads と手動広告ユニットの実際の配信設定**。本リポジトリの実装は
      `enable_page_level_ads:true`（Auto ads）を許可ルートでのみ読み込む方式（§1-1参照）。
      Auto ads配下でどの広告フォーマット（アンカー広告・モバイル全画面広告・関連コンテンツ等）
      が有効化されているかはAdSense管理画面「広告」→「サイト単位の設定」でのみ確認・調整可能。
      特にモバイル全画面広告（インタースティシャル）はUXへの影響が大きいため、有効化状態を
      確認し、学習系操作画面（許可ルート外なので原則出ないはずだが、Auto adsの関連コンテンツ
      ユニット等が意図せず目立つ配置にならないか）を実機でも目視確認することを推奨する。
- [ ] **Microsoft Clarityのマスキング設定**（AdSenseそのものではないが、今回の監査で新たに
      判明した関連項目。§1-4参照）。Clarity管理画面（プロジェクト設定 → マスキング）で
      Strict/Balanced/Relaxedのいずれが選択されているか、ログイン・サインアップ画面の
      メールアドレス・パスワード入力欄が録画時にマスクされているかを確認する。コードからは
      判定できない。

## 4. まとめ

- コード側で検証可能な範囲（GA4/Clarity/AdSense/AdMob/Cookie/オプトアウト/13歳未満条項の
  実装との整合性、GA4イベントのPII混入有無、CMP実装の有無）はすべて確認済み。
- `/privacy` の1箇所（Microsoft Clarityの説明）を、実際の機能（セッション記録）とマスキング
  設定への依存を正確に反映する形に精緻化した。他の開示項目は既に実装と一致しており変更していない。
- 「GDPR準拠」「Google認定CMP導入済み」等、コードから検証できない適合性の主張は本書・
  `/privacy` のいずれにも追加していない（コード側にCMP実装が存在しないため、これらは
  §3の管理画面確認事項として明示的に未確認のまま残している）。
- 回帰テスト `npm run test:privacy-ads-disclosure` を追加し、開示トピックの記載漏れを
  今後自動検知できるようにした。

## 5. Google Funding Choices（CMP）コード実装（2026-07-28・Phase 6）

§1-3・§3で「コード上にCMP実装が存在しない」と記録していた項目に対応するため、
Google公式のCMP（Funding Choices / AdSense「プライバシーとメッセージ」）をコード側に
組み込んだ。実装方針・変更ファイルは以下のとおり。

### 5-1. 実装方針

- Googleが「Google認定CMP」として提供するFunding Choicesの標準タグ
  （`fundingchoicesmessages.google.com/i/{pub-id}?ers=1` + `signalGooglefcPresent`
  スニペット）を追加。地域判定（EEA/UK/CH該当かどうか）・同意UIの表示・IAB TCF
  同意シグナルの記録は、このタグを起点にGoogleのサーバー/スクリプト側が行う。
  自前でジオIP判定や同意ロジックを実装していない（Google公式スニペットをそのまま
  使うことが「認定CMP」を名乗れる条件であり、独自実装は認定の対象外になるため）。
- `adsbygoogle.js`（`AdSenseLoader.tsx`）は、このCMPが記録したTCF同意シグナルを
  自動的に読み取ってパーソナライズ/非パーソナライズ広告を出し分ける（Google広告配信側の
  標準動作）。そのため`AdSenseLoader.tsx`・`adRoutePolicy.ts`自体は変更していない
  （広告表示ルートの許可リストというAuto ads自体のON/OFF方針とCMPは独立した関心事）。
- CMPタグの読み込み範囲は、広告表示ルートの許可リスト（`isAdsAllowedPath`）とは
  **あえて分離**し、`NEXT_PUBLIC_ADSENSE_CLIENT`が設定されていればサイト全体
  （`src/app/layout.tsx`の`<head>`）で読み込む。理由:
  同意状態は`/privacy`など広告非表示ページでも保持・変更できる必要があること、
  最初に訪れたページが偶然広告非許可ルートだった場合でもEEA/UK/CH判定・同意記録は
  以後の全ページに引き継がれる必要があること。
- 同意を後から変更する導線として、`AdConsentSettingsLink`
  （`window.googlefc.showRevocationMessage()`を呼ぶボタン）を`/privacy`「3. 広告について」に
  追加。対象地域外からのアクセスではGoogle側にメッセージが存在しないため、クリックしても
  何も起こらない（Google公式リファレンス実装と同じ挙動。ボタン自体は常時表示する）。

### 5-2. 変更ファイル

- 新規: `src/lib/ads/consentManagement.ts`（`ca-pub-XXXX` → `pub-XXXX`変換ヘルパー）
- 新規: `src/components/ads/AdConsentSettingsLink.tsx`（同意変更ボタン）
- `src/app/layout.tsx`: Funding Choicesタグを`<head>`に追加（`NEXT_PUBLIC_ADSENSE_CLIENT`
  設定時のみ、`AdSenseLoader`より先・サイト全体で読み込み）
- `src/app/privacy/page.tsx`: 「3. 広告について」に同意管理メッセージの説明と
  `AdConsentSettingsLink`を追加
- `scripts/testing/e2e/privacy-ads-disclosure.mjs`: CMP/同意変更導線への言及チェックを追加
- `scripts/testing/e2e/adsense-readiness.mjs`: Funding ChoicesタグがAdSense本体スクリプトと
  異なりルート制限なくサイト全体で読み込まれることの検証を追加

### 5-3. コード側で実装したもの・していないもの

- **実装した**: CMPタグの埋め込み（サイト全体）、同意変更導線（`/privacy`）、
  上記2点の回帰テスト。
- **実装していない（Googleの認定CMPが担う範囲）**: 地域判定ロジック、同意UI自体の
  デザイン・文言、EEA向けデフォルト非パーソナライズの強制、IAB TCF文字列の生成・保存。
  これらを自前実装しないことが「Google認定CMP」を使う設計上の意図であり、欠落ではない。
- **オーナー側の対応が引き続き必要**: AdSense管理画面「プライバシーとメッセージ」での
  実際のGDPR/UK/CHメッセージの作成・公開（§3チェックリスト参照）。これが未実施の間は、
  コード側のタグは読み込まれるが同意UI自体は表示されない。
