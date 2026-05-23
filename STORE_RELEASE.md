# Loop Vocabulary — ストア公開チェックリスト

Google Play / App Store 公開前に埋めるチェックリスト。
本ファイルは Confluence / Notion 等にコピペして、各項目を埋めながら進める想定。

---

## 共通の準備物

| 項目 | 値 |
|------|----|
| **アプリ名** | Loop Vocabulary |
| **アプリID (Android Package / iOS Bundle)** | `com.loopvocabulary.app` |
| **本番 Web URL** | <https://loop-vocabulary.vercel.app> |
| **プライバシーポリシー URL** | <https://loop-vocabulary.vercel.app/privacy> |
| **利用規約 URL** | <https://loop-vocabulary.vercel.app/terms> |
| **サポート / お問い合わせ URL** | <https://loop-vocabulary.vercel.app/contact> |
| **アカウント削除 URL (Web から開始)** | <https://loop-vocabulary.vercel.app/account/delete> |
| **サポートメール** | (要置換) `support@example.com` ← 本番前に実メールに差し替え。環境変数 `NEXT_PUBLIC_SUPPORT_EMAIL` または `src/lib/support.ts` |
| **対象年齢** | 13 歳以上 |
| **広告** | あり (AdMob)。トラッキング ON/OFF はユーザー選択に委ねる方針 |
| **アプリ内課金** | 現状なし。将来: Android = Google Play Billing / iOS = Apple In-App Purchase |

---

## Google Play 公開チェックリスト

### Play Console 基本情報

- [ ] アプリ名: `Loop Vocabulary`
- [ ] パッケージ名: `com.loopvocabulary.app`
- [ ] ショート説明 (80 文字以内):  
  例: 「調べた英語を、覚える英語へ。英単語の検索・登録・忘却曲線復習・テストを 1 つに。」
- [ ] 詳細説明 (4000 文字以内):
  - 機能サマリ (辞書 / 単語帳 / 4 択 / 入力テスト / 復習 / 教材 / AI 例文 / PDF 小テスト)
  - 対象ユーザー (中高生 / 大学受験生 / 英検 / TOEIC / 塾講師)
  - 広告について明示
- [ ] アプリのアイコン (512×512 PNG): `public/icons/icon-512.png` を流用
- [ ] Feature Graphic (1024×500): 別途要作成
- [ ] スマホ用スクリーンショット (16:9 推奨、最低 2 枚 / 最大 8 枚)
- [ ] (任意) タブレット用スクリーンショット

### コンテンツ レーティング & データ セーフティ

- [ ] **対象年齢**: 13 歳以上 (IARC 質問表に回答)
- [ ] **広告の有無**: あり ← 必ず ON にする
- [ ] **アプリのコンテンツ**:
  - [ ] **データ収集の申告**:
    - メールアドレス (アカウント認証用、Supabase Auth)
    - ユーザーが入力した英単語データ (Supabase DB)
    - 端末識別子 (広告 ID。AdMob 経由、パーソナライズ無効推奨)
  - [ ] **共有先の申告**: AdMob (Google Mobile Ads SDK)
  - [ ] **暗号化 (送受信中)**: HTTPS で常時暗号化
  - [ ] **ユーザーのデータ削除リクエスト方法**: アプリ内 `/settings` から、または問い合わせ
- [ ] **コンテンツの説明**: 教育 / 英語学習 / 暴力・性的描写なし

### 広告 / マネタイゼーション

- [ ] **AdMob テスト広告で動作確認**: 内部テスト APK で Banner / Rewarded / Interstitial が表示されることを確認
- [ ] **app-ads.txt**: AdMob 承認後、`public/app-ads.txt` の `pub-XXXXXXXXXXXXXXXX` を本物の Publisher ID に置換し再デプロイ
- [ ] **Play Console → 収益化 → AdMob 連携**: アプリ名・パッケージ名を AdMob 側にも登録
- [ ] **本番広告 Unit ID への切替**:
  - Vercel 環境変数 `NEXT_PUBLIC_ADMOB_USE_TEST_IDS=false`
  - `NEXT_PUBLIC_ADMOB_ANDROID_BANNER` / `_INTERSTITIAL` / `_REWARDED` を設定
  - `android/app/src/main/AndroidManifest.xml` の `com.google.android.gms.ads.APPLICATION_ID` を本番 App ID に書き換え
  - `npx cap sync android` → 再ビルド → 内部テスト → 本番

### リリース手順

- [ ] **キーストア作成**: `android/app` で `keytool -genkey ...` (パスワード管理重要)
- [ ] **`android/app/build.gradle` の signingConfigs** にキーストア情報を追加
- [ ] **AAB ビルド**: Android Studio → Build → Generate Signed Bundle (AAB)
- [ ] **Play Console → 内部テスト**: AAB アップロード → テスター招待 → 動作確認
- [ ] **Play Console → クローズドテスト**: 招待ユーザー 20 名以上で 14 日間のテスト (Play 必須要件、2023 年以降)
- [ ] **本番リリース**: クローズドテスト完了後に審査申請

---

## Apple App Store 公開チェックリスト

### 必要なもの

- [ ] **Mac** (Xcode 必須、Windows では iOS ビルド不可)
- [ ] **Apple Developer Program 登録** (年 $99 / 約 14,800 円)
- [ ] **Xcode 最新版** (Mac App Store からインストール)

### App Store Connect 基本情報

- [ ] **アプリ名**: `Loop Vocabulary`
- [ ] **Bundle ID**: `com.loopvocabulary.app`
- [ ] **Subtitle** (30 文字): 例「英単語を、回せる学習へ。」
- [ ] **Promotional Text** (170 文字): 期間限定キャンペーン等を書く欄
- [ ] **Description** (4000 文字): Play と同様の内容
- [ ] **Keywords** (100 文字, カンマ区切り): `英単語,英語,英検,TOEIC,大学受験,中学英語,高校英語,単語帳,リスニング,リーディング`
- [ ] **Support URL**: <https://loop-vocabulary.vercel.app> (サポート用ページ追加が望ましい)
- [ ] **Marketing URL** (任意): <https://loop-vocabulary.vercel.app>
- [ ] **Privacy Policy URL**: <https://loop-vocabulary.vercel.app/privacy>

### App Privacy Labels (Data Types)

- [ ] **Contact Info → Email Address**: アカウント認証目的、ユーザーに紐づく
- [ ] **User Content → Other User Content**: 英単語・例文等、ユーザーに紐づく、暗号化送信
- [ ] **Identifiers → Device ID**: 広告目的 (AdMob)、トラッキング許可時のみ
- [ ] **Usage Data → Product Interaction**: 分析目的 (任意)、トラッキング可否はユーザー選択
- [ ] **Diagnostics → Crash Data**: アプリ改善目的 (Sentry 等を入れたら有効化)

### 年齢レーティング & トラッキング

- [ ] **年齢レーティング**: 4+ または 9+ (教育コンテンツ、暴力・性的描写なし)
- [ ] **App Tracking Transparency (ATT)**:
  - [ ] `NSUserTrackingUsageDescription` を `Info.plist` に設定済 (実装済)
  - [ ] アプリ初回起動時に ATT ダイアログを表示 (AdMob 初期化時)
  - [ ] **ユーザーが拒否しても非パーソナライズ広告で広告自体は配信される設計** (実装済)

### スクリーンショット (iOS は端末別に必要)

- [ ] **6.7" iPhone** (1290×2796): 必須、3〜10 枚
- [ ] **6.1" iPhone** (1170×2532): 必須、3〜10 枚
- [ ] **5.5" iPhone** (1242×2208): 必須、3〜10 枚
- [ ] **iPad Pro 12.9"** (任意、iPad 対応するなら)
- [ ] **App Icon**: 1024×1024 PNG (アルファチャネルなし、`public/icons/icon-1024.png` を別途生成)

### Xcode で行う設定

- [ ] **Bundle Identifier**: `com.loopvocabulary.app` を確認
- [ ] **Signing & Capabilities**: Apple Developer の Team を選択、Automatic signing 推奨
- [ ] **Version / Build Number**: `1.0.0` / `1`
- [ ] **Deployment Target**: iOS 14.0 以降 (AdMob SDK 要件)

### TestFlight & 本番リリース

- [ ] **TestFlight**: Xcode から Archive → Distribute App → App Store Connect → TestFlight でテスター招待
- [ ] **AdMob iOS テスト広告確認**: TestFlight ビルドで Banner / Rewarded が出ることを確認
- [ ] **Review Notes**: 「テストアカウント不要 (signup から自由に登録可能)」、または専用テスト用アカウントを発行
- [ ] **本番広告 Unit ID への切替**:
  - Vercel 環境変数 `NEXT_PUBLIC_ADMOB_IOS_*` を設定
  - `ios/App/App/Info.plist` の `GADApplicationIdentifier` を本番 App ID に書き換え
  - `npx cap sync ios` → 再 Archive → TestFlight → 本番審査申請
- [ ] **Review 申請**: 通常 24-48 時間で結果

---

## アプリ内課金 (将来実装)

現状は決済機能なし。Premium プランは「広告非表示プラン案内ページ (`/premium`)」のみ。

将来:

- **Android**: Google Play Billing Library を Capacitor プラグイン経由で利用
  - 推奨: `@capacitor-community/in-app-purchases` または Stripe (Play Billing 違反に注意)
  - Google Play では **デジタル商品 / サブスクは Play Billing 必須**
- **iOS**: StoreKit 2 を Capacitor プラグイン経由
  - 推奨: `@capacitor-community/in-app-purchases`
  - **App Store では デジタル商品は IAP 必須** (15-30% の手数料)

両ストアの利用規約で、外部決済リンク (Stripe など) は **デジタル商品では使用禁止**。
学校・塾向け B2B プランなどは Stripe 経由で OK な可能性があるが、要法務確認。

---

## データ削除 / アカウント削除要件

Apple は 2022 年から、Google は 2024 年から **アプリ内からのアカウント削除導線を必須化**。

### 実装済 (2026-05-23)

- [x] **アプリ内**: 「設定」 → 「アカウント削除」セクションに削除リクエストパネルを実装
  - 確認チェックボックス + 「削除する」テキスト入力 + 確認ダイアログの三段階で誤操作防止
- [x] **Web**: `/account/delete` ページを新設。アンインストール後でもログインして削除可能
- [x] **API**: `POST /api/account/delete-request` で `account_deletion_requests` に記録
  - `user_id` ごとに pending を 1 件に制限 (unique index)
  - RLS で本人のみ作成/閲覧、管理者は全件管理
- [x] **/privacy**: 削除リクエスト方法・対象データ・完了目安・法令上保持の説明を追記
- [x] **/terms**: アカウント削除と運営者による利用停止条項を追記
- [x] **/contact**: サポート窓口ページ新設 (mailto テンプレ付き)

### 物理削除フロー (運営者が手動 / 別ジョブで実行)

`account_deletion_requests` は **リクエストの記録のみ**。実際の `auth.users` 削除は `service_role` キーが必要なため、現状は管理者が手動で以下を実行する想定:

1. 管理画面 (将来追加予定) または Supabase Studio で pending リクエスト一覧を確認
2. 本人確認 (必要に応じてメールで連絡)
3. Supabase SQL Editor で:

```sql
-- 1. ユーザーを削除 (cascade で profiles / words / word_books / 履歴等すべて消える)
delete from auth.users where id = '<USER_UUID>';

-- 2. リクエストを完了状態に
update public.account_deletion_requests
   set status = 'completed', completed_at = now()
 where user_id = '<USER_UUID>';
```

### Google Play Data safety で書く内容

| 項目 | 値 |
|------|----|
| データ削除のリクエスト方法 (アプリ内) | あり: 「設定」 → 「アカウント削除」 |
| データ削除のリクエスト方法 (Web URL) | <https://loop-vocabulary.vercel.app/account/delete> |
| サポート URL | <https://loop-vocabulary.vercel.app/contact> |

### App Store Connect Review Notes に書く内容

```
Account deletion is available from two places:
1. Inside the app: Settings → Account deletion (red section, with a confirm checkbox and "delete" text input)
2. Web: https://loop-vocabulary.vercel.app/account/delete

Both options call POST /api/account/delete-request which records the request
in account_deletion_requests table. The user receives a confirmation message
on screen. Actual physical deletion is performed by the operator within a few
business days after manual identity verification.

Support contact: https://loop-vocabulary.vercel.app/contact
Privacy policy: https://loop-vocabulary.vercel.app/privacy
Terms of use:  https://loop-vocabulary.vercel.app/terms
```
