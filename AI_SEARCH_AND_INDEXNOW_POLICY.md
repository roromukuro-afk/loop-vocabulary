# Bing / IndexNow / AIクローラー 方針（Phase 8/9、2026-07-28更新）

`public/robots.txt` へのAIクローラー個別指定（PR #31、merge `0dc94d1`）・IndexNow実装（本PR #32）の両方が完了した。T-09/A-02/T-12/A-03/T-11クローズ。詳細はそれぞれ下記「robots.txtでのAIクローラー個別指定（実装済み）」「IndexNow 実装状況」セクション参照。

## 現状確認

- **Bing Webmaster Tools**: コード内から設定状況は確認できない（Bing側の管理画面でのサイト登録・確認が必要）。`public/robots.txt` に `Sitemap: https://loop-vocabulary.app/sitemap.xml` の記載があるため、Bingが登録済みであればこのsitemapを自動的に検出できる状態。**要人間確認**: https://www.bing.com/webmasters/ でのサイト登録有無。
- **IndexNow**: 2026-07-28に実装済み（本PR #32）。詳細は下記「IndexNow 実装状況（2026-07-28更新）」を参照。
- **robots.txt でのAIクローラー個別指定**: 2026-07-28に実装済み（PR #31、merge `0dc94d1`）。`OAI-SearchBot` `GPTBot` `ClaudeBot` `Google-Extended` `PerplexityBot` の個別User-agent行を `public/robots.txt` に追加した。それ以外のAIクローラーには引き続き `User-agent: *` の一律ルールが適用される。詳細は下記セクション参照。

## 用語の整理

- **OAI-SearchBot**: ChatGPTの検索機能がWeb検索結果を取得するためのクローラー。これを許可すると「ChatGPT経由の検索流入」につながりうる。モデル学習には使われない。
- **GPTBot**: OpenAIのモデル学習用データ収集クローラー。OAI-SearchBotとは別のクローラーであり、これを許可すると「本サイトのコンテンツがAIモデルの学習データに使われることを容認する」ことになる。
- **ClaudeBot**: Anthropicのモデル学習用データ収集クローラー。ユーザーがClaudeにURLを貼って読ませる場合の取得（ユーザー起点のfetch）とは別物。
- **Google-Extended**: Gemini/Bard/Vertex AIの学習用データ利用を制御するトークン。通常のGooglebot（検索クロール・インデックス登録）には影響しない。
- **PerplexityBot**: Perplexity AIのクローラー。検索回答の引用（出典表示付き）と一部学習の両方に使われており、OpenAI/Anthropicほどクローラーの用途が綺麗に分離されていない。
- **検索流入を得ることと、学習データ利用を許可することは別の意思決定**であり、一方を許可したいからといってもう一方も自動的に許可すべきとは限らない。以下の実装ではこの2軸を明確に分けて、ボットごとに個別のデフォルトを設定した。

## robots.txtでのAIクローラー個別指定（実装済み・2026-07-28）

「方針未確定のため保留」という状態から、**実際に動作する実装 + 明確な理由付きの推奨デフォルト**に進めた（オーナーの一存で不可逆の判断を下したわけではなく、`public/robots.txt` を編集するだけでいつでも個別に変更できる可逆的なデフォルトとして実装している）。`public/robots.txt` に以下の5つのUser-agentブロックを `User-agent: *` ブロックとは独立に追加した:

| User-agent | デフォルト | 理由 |
|---|---|---|
| `OAI-SearchBot` | `User-agent: *` と同じ許可/拒否パス（実質allow） | ChatGPT検索結果への掲載のみに影響し、モデル学習には使われない。他の検索エンジンと同じ価値提供のため、通常の検索エンジンと同様に扱う。 |
| `GPTBot` | `Disallow: /`（全面ブロック） | モデル学習用データ収集。辞書・AI解説などのオリジナルコンテンツはサイトの製品価値・収益モデルの一部であり、学習データとしてのスクレイピングは既定でブロックする方が安全かつ可逆。検索露出には影響しない（それはOAI-SearchBotが別途担当）。 |
| `ClaudeBot` | `Disallow: /`（全面ブロック） | GPTBotと同じ理由（モデル学習用データ収集、オリジナルコンテンツ保護のため既定ブロック、事業判断が変われば可逆）。 |
| `Google-Extended` | `Disallow: /`（全面ブロック） | Gemini/Bard/Vertex AIの学習データ利用を制御。通常のGooglebot検索クロール（`User-agent: *`）には影響しない。GPTBot/ClaudeBotと同じ学習データ保護の理由で既定ブロック。 |
| `PerplexityBot` | `User-agent: *` と同じ許可/拒否パス（実質allow） | 主な用途が出典表示付きの回答引用であり、検索露出と近い価値提供のため許可をデフォルトに。ただしOpenAI/Anthropicのボットほど検索用途と学習用途が明確に分離されていないため、この項目は他より再検討の余地が大きいことをrobots.txt内のコメントにも明記した。 |

**デフォルトを変更する方法**: `public/robots.txt` を開き、変更したいボットの `User-agent:` ブロックを直接編集する（各ブロックは独立しており、他のボットや `User-agent: *` ブロックには影響しない）。変更は次回クロール時から反映される。ただしrobots.txtはあくまで任意規約であり、クローラー側がこれを遵守する保証はない点に注意。

再発防止テスト: `scripts/testing/e2e/ai-crawler-llms-policy.mjs`（`npm run test:ai-crawler-llms-policy`）が、`User-agent: *` ブロックの既存Disallowパスの非退行と、5ボットのUser-agentブロックの存在・構文妥当性、`public/llms.txt` の実ルート整合性を検証する。

## 次回検討する際の論点（判断材料の整理のみ・robots.txtのAIクローラー個別指定について）

1. `OAI-SearchBot` を明示的に `Allow` した（PR #31で実装済み）。ChatGPT検索経由の流入をGA4でどう計測するか（リファラ判定・UTM設計）は未着手のため、次回検討する。
2. `GPTBot` を明示的に `Disallow` した（PR #31で実装済み）。辞書・ガイド記事などオリジナルコンテンツの学習データ利用を望まない、という意思表示として反映した。
3. `PerplexityBot` のデフォルト（許可）は、検索用途と学習用途の分離が他社ほど明確でないため、Perplexity側の方針変化やサイト側の実データを見て再検討する余地がある。
4. AI経由流入の実際の計測・T-09導入の成果検証（実際に引用・流入が増えたか）はまだ実施していない。

（旧: 「sitemap.tsが約167件のみでIndexNow導入の規模的必然性が低い」という理由でIndexNowを先送りしていたが、実装コスト自体は低くURL件数と無関係に導入できると判断し2026-07-28に実装した（本PR #32）。詳細は次のセクション。）

## GA4でのAI経由流入の見方（現状でも確認可能・コード変更不要）

GA4の「トラフィック獲得」レポートで、参照元(`source`)に `chatgpt.com` `perplexity.ai` `bing.com` 等が含まれるセッションを確認できる。現状UTMパラメータの付与や特別なイベント計測は行っていないため、リファラベースの自然流入として計測される。専用の計測を追加する場合は次ラウンドで検討する。

## IndexNow 実装状況（2026-07-28更新）

### 実装済みのもの

- **所有権証明キーファイル**: `public/724d6efdf17808d5069e6c8d78fa98bc9cd413ab302de6c35be0e113338da741.txt`（中身はキー文字列そのもの）を `https://loop-vocabulary.app/<key>.txt` として公開。このファイルはプロトコル上「公開されることが前提」であり秘密情報ではない。
  - 対応する `INDEXNOW_KEY` 環境変数は `.env.local.example` に記載済み（**要人間作業**: Vercelの環境変数にも同じ値を設定する必要がある。下記「必要な手動作業」参照）。
  - ルーティングの安全性: リポジトリのルート直下に動的セグメント（`src/app/[key]/route.ts` のようなもの）を追加すると、既存の静的ルートと衝突したり意図しないパスまで飲み込むリスクがあるため採用しなかった。代わりに、キーがめったに変わらない性質を踏まえ、生成したキーを `public/` 配下の静的ファイルとしてそのままコミットする方式にした（next.config.jsのrewrites()も検討したが、rewritesはビルド時評価でありキーのenv変数化との相性が悪いため見送った）。
- **送信ユーティリティ**: `src/lib/indexnow/submit.ts` の `submitUrlsToIndexNow(urls)` が IndexNow のバッチエンドポイント(`https://api.indexnow.org/indexnow`)へ `{ host, key, keyLocation, urlList }` をPOSTする。
  - `INDEXNOW_KEY` 未設定時は何もせず `{ok: false, error: "not configured"}` を返す（throwしない）。
  - 同一URLの10分以内の再送信はスキップする簡易デデュープ付き（**正直な注記**: モジュールレベルのインメモリMapのため、Vercelのサーバーレス関数インスタンスをまたぐ重複は防げない。同一インスタンスが温かい間にのみ効く程度の効果）。
  - ネットワーク失敗・非2xxレスポンスもthrowせず、ステータスコード・レスポンス本文をログに残したうえで `{ok: false, ...}` を返す。
  - 単体テスト: `scripts/testing/test-indexnow-submit.mjs`（`npm run test:indexnow-submit`）。fetchをスタブし、ペイロード形状・未設定時のno-op・ネットワーク失敗時に例外を投げないこと・デデュープ挙動を検証。
- **週次cron同期**: `src/app/api/cron/indexnow-sitemap-sync/route.ts` が `src/app/sitemap.ts` の全URLを読み取り `submitUrlsToIndexNow` へ渡す。認証は既存の `daily-push` / `weekly-digest` 等と全く同じ `CRON_SECRET` Bearerパターン。`vercel.json` に毎週月曜20:00 UTCのcronとして登録済み。
- **管理画面からの手動トリガー**: `/admin/indexnow`（`src/app/admin/indexnow/page.tsx`）に「今すぐIndexNowへ同期」ボタンを設置。認証は他の管理API(`/api/admin/growth/*`)と同じ `requireAdminApi()`（管理者ログインセッション必須）。cronを待たずに動作確認・即時再送信したい場合用。ロジックは cron ルートと `src/lib/indexnow/syncSitemap.ts` を共有している。

### スコープの明示的な境界（正直に書く）

このラウンドで実装したのは **「sitemap全件を定期的に再送信する(resync)」** 方式のみ。IndexNow本来の強みである **「公開/更新/削除の都度、その1URLだけを即座に通知する」** 真の即時通知は、**このPRには含まれていない**。教材公開・単語ページ追加・ガイド記事更新など、コンテンツの書き込みが起きる各コードパスに `submitUrlsToIndexNow` をフックする作業は、影響範囲が大きく別ラウンドでのスコープとして意図的に切り出した。

### 必要な人間の手動作業

1. **Vercel環境変数への `INDEXNOW_KEY` 設定**（必須）: Vercelダッシュボード → Project Settings → Environment Variables に `INDEXNOW_KEY=724d6efdf17808d5069e6c8d78fa98bc9cd413ab302de6c35be0e113338da741` を設定（Production環境）。設定しない限り送信ロジックは常にno-opで安全にスキップされる（ビルド・既存機能は壊れない）。
2. **Bing Webmaster Tools登録** (https://www.bing.com/webmasters/): **要人間確認・要人間作業**。
   - **重要な整理**: IndexNow公式ドキュメント (indexnow.org/documentation, bing.com/indexnow) を確認した限り、IndexNowのURL送信が実際に効果を持つための必須条件は「キーファイルによる所有権証明」のみであり、Bing Webmaster Toolsへのサイト登録が送信の有効性そのものの前提条件であるとは明記されていない。つまりIndexNow自体は独立して機能する設計と考えられる。
   - ただし、Bing Webmaster Toolsに登録すると管理画面上でIndexNow経由の送信状況をモニタリング・確認できる（と一般に案内されている）という側面もあり、この「モニタリング目的」の有用性については今回ライブページの直接確認では明文の一文を見つけられておらず、一般的な理解に基づく推測を含む。**確信度は中程度**として扱ってほしい。
   - 結論: Bing Webmaster Tools未登録でもIndexNow送信自体は動作すると考えられるが、送信が実際にBing側でどう扱われているかを可視化・監視したい場合は登録を推奨する。登録作業はBing側のログインが必要な人間専用の作業のため、本PRには含まれない。
