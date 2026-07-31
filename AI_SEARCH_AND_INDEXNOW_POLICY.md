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

### ページ個別の即時通知（完了・教材のみ・本番検証済み・2026-07-30）

上記の週次resyncに加え、教材(`materials`テーブル)の公開/更新/削除については、書き込みが起きた
その場でIndexNowへ即時通知するよう実装した。

- **サーバールート新設**: 以前は `/admin/materials`(`MaterialAdminTable.tsx`)がブラウザから
  直接Supabaseクライアントで`materials`テーブルへ書き込んでおり、サーバー側のフック地点が
  存在しなかった。`POST /api/admin/materials`(新規作成)・`PATCH /api/admin/materials/[id]`
  (公開切り替え・許諾ステータス・許諾メモ)・`DELETE /api/admin/materials/[id]`
  (削除)の3ルートを新設し、`requireAdminApi()` + `createAdminClient()`
  (`/api/admin/growth/*`と同じ既存パターン)で保護した。
- **実際の公開可否の遷移で判定**: `/materials/[id]`の実公開可否は`is_public`単独ではなく
  `is_public=true かつ license_status IN ('approved','original')`の両方で決まる
  (RLSポリシー・ページ側クエリと同じ条件、`src/lib/materials/visibility.ts`の
  `isEffectivelyPublicMaterial()`)。この実公開可否が更新前後で変化した場合のみ
  (非公開→公開、公開→非公開のいずれの方向も)、`/materials/{id}`をIndexNowへ通知する。
  `license_note`(公開ページに一切表示されない管理者専用メモ)のみの変更は通知しない。
- **削除時の扱い**: IndexNowプロトコル自体に「削除」専用のverbは無い。削除前に公開条件を
  満たしていた教材が削除された場合、同じ`/materials/{id}`を再送信し、クローラーに
  再クロールを促すことで「消えたこと」(削除後は`notFound()`で404になる)を伝える設計にした。
- **可視性反転はデデュープをバイパスする**: `submitUrlsToIndexNow()`の10分デデュープは
  同一URLへの短時間の反復送信を抑止するためのものだが、「公開→(9分後)非公開」のような
  可視性そのものの反転にまで適用されると、2回目(消えたことの通知)がスキップされ、
  外部の検索結果に古い状態が次のクロールまで残ってしまう(2026-07-30、
  chatgpt-codex-connectorのP2指摘で発覚)。可視性反転・削除の通知は`bypassDedupe: true`
  で常に送信し、通常の内容更新(単語インポート等)は従来どおりのデデュープを維持する。
- **公開教材への単語インポートも通知対象**: `POST /api/admin/materials/[id]/words`
  (`ImportPanel.tsx`のCSV/JSON一括インポート)を新設し、`material_words`への
  ブラウザ直接Supabase書き込みをサーバー経由に統一した。挿入が1件以上成功し、かつ
  対象教材が実際に公開状態の場合のみ、教材URLへ最大1回だけ通知する(何語追加しても
  ループ内で個別送信しない)。
- **本来の書き込み処理を絶対に壊さない**: Next.js 15の`after()`
  (`src/lib/indexnow/notifyContentChange.ts`)でレスポンス送信後にIndexNow送信を行うため、
  IndexNowへの送信が失敗・遅延してもDB書き込み自体のレスポンスには一切影響しない。
- **単一URLのみ送信・全件再送信は行わない**: 週次resync(`syncSitemapToIndexNow`)とは
  完全に独立しており、変更があったその1件のURLだけを`submitUrlsToIndexNow`へ渡す。
- **テスト**: `test:materials-visibility`・`test:admin-materials-words-import-notify-invariant`
  (いずれもネットワーク・DB不要の単体/ソース構造不変条件テスト)、`test:admin-materials-api`・
  `test:admin-materials-words-import-api`(実ログイン・実DB書き込みを伴うE2E、認証/認可・CRUD・
  raw fetch経由とUIのボタン操作経由の両方を検証)。後2つは`test:premium-gating`と同じ理由で
  secretless独立CIでは実行できないため、`admin-materials-canary.yml`
  (trusted workflow、要`TEST_ADMIN_PASSWORD` Environment secret)へ切り出した。
- **本番検証(2026-07-30)**: `admin-materials-canary.yml`(`test:admin-materials-api`・
  `test:admin-materials-words-import-api`の2つのE2Eスイートのみを実行する。
  `test:materials-visibility`・`test:admin-materials-words-import-notify-invariant`は
  ネットワーク・DB不要のためこのcanaryには含まれておらず、PR #52開発時にローカル・
  `pr-quality-gate.yml`側で別途検証済み)を手動実行し、上記2つのE2Eスイートが
  本番相当の実DB・実ログインで成功、テスト用データの残留なしを確認。さらにtest+admin
  アカウントで本番(`https://loop-vocabulary.app`)へ実際にログインし、教材の作成→公開
  (`is_public:true`+`license_status:approved`)→`/materials/{id}`が直後に200で表示される
  こと→削除、という一連の操作を本番APIへ実行し、いずれも200・DBの可視性遷移が実際に
  発生したことを確認済み。**ただし外部IndexNow API側がこの実送信を実際に2xxで受理したか
  どうかは、Vercelランタイムログ(`get_runtime_logs`)がリクエスト単位のメソッド/パス/
  ステータスの要約のみでconsole.log/console.errorの内容までは見えないため、他に観測
  できる手段が無く未確認のまま記録する**(T-11の週次resyncと同じ制約。2xx/失敗いずれも
  推測しない)。

### 静的コンテンツのページ個別即時通知（完了・2026-07-30）

**教材(materials)以外**——ガイド記事・辞書語ページ・無料ツール・URLリダイレクト——は、
いずれも`GUIDE_SLUGS`/`PILOT_WORDS`/`guideRedirects`のような**静的な配列・設定**で
定義されており、gitへのコミット+Vercelビルドによってのみ「公開/更新」される。つまり
これらには元々「実行時の書き込みイベント」自体が存在せず、教材のような
サーバールートへのフック方式は使えない。代わりに、**mainへのpushそのものを
「公開/更新イベント」とみなし、push前後のコミット間で実際に生成される公開URL集合を
比較して、変更のあったURLだけをIndexNowへ通知する**仕組みを実装した。

- **ワークフロー**: `.github/workflows/indexnow-static-content-notify.yml`
  (`push: branches: [main]`トリガー、post-deploy通知でありPRの必須チェックではない)。
  `github.event.before`(push前のSHA)・`github.sha`(push後のSHA)を、実装スクリプト
  `scripts/improvement/notify-indexnow-static-content-diff.mjs`へ渡す。Vercelの
  ビルド完了を確実に待つ仕組み(VERCEL_TOKENでのポーリング等)は新たなsecretを
  要求しないことを優先し採用せず、固定150秒待機で代替した(ベストエフォートの通知
  であり、多少の前後は実害が小さいため)。
- **検出方式**: sitemap.ts・pilotWords.ts・next.config.jsの2つのgit ref時点の内容を
  比較する。sitemap.tsのリテラル静的パス(`${base}/xxx`)+GUIDE_SLUGS由来の
  `/guide/<slug>`は正規表現抽出(`scripts/testing/e2e/robots-sitemap-collision.mjs`の
  既存パターンを再利用)、PILOT_WORDSは自己完結モジュール(importなし)である性質を
  利用し、2つのref時点の内容をそれぞれ一時ファイルへ書き出してdynamic importする
  ことで、`isIndexEligible`の実際の算出結果(`defineWord()`による自動判定)を
  そのまま比較できる。
- **検出対象**: (1) 新しく現れた/消えた静的URL(ガイド記事・無料ツール・その他の
  静的ページを一律にカバー、カテゴリ分けはしない)、(2) 既存ガイド記事
  (前後ともGUIDE_SLUGSに存在)のコンテンツ更新(`src/app/guide/<slug>/`配下の
  ファイル変更で検出)、(3) 辞書語ページの追加・削除・内容更新、(4) `guideRedirects`
  への新規追加(旧URL・新URLの両方を通知)。
- **デデュープの扱い**: URLの追加・削除(可視性の変化)は`bypassDedupe: true`
  (教材と同じ理由、直近デデュープに関わらず必ず届ける)。既存ページの内容更新は
  通常のデデュープを維持する。
- **意図的な対象外**: `src/lib/grammar/lessons.ts`(LESSONS、文法レッスン)は
  今回の指示範囲に含まれていないため対象外とした。PILOT_WORDSと同型の構造
  (自己完結・importなし)のため、必要になれば同じ手法で低コストに追加できる。
- **テスト**: `test:indexnow-static-content-diff-extraction`(ネットワーク・git実行
  不要、合成した小さなソース文字列での単体テスト)。開発時に実際の過去コミット
  3件(PR #43[新規無料ツール追加]・`3c51fe7`[既存ガイド記事のみコンテンツ更新]・
  `bb97cf8`[辞書24→50語拡張+付随するガイド記事コンテンツ更新])に対して直接実行し、
  期待どおりの検出結果になることを確認済み。

### 必要な人間の手動作業

1. **Vercel環境変数への `INDEXNOW_KEY` 設定**（必須）: Vercelダッシュボード → Project Settings → Environment Variables に `INDEXNOW_KEY=724d6efdf17808d5069e6c8d78fa98bc9cd413ab302de6c35be0e113338da741` を設定（Production環境）。設定しない限り送信ロジックは常にno-opで安全にスキップされる（ビルド・既存機能は壊れない）。
2. **Bing Webmaster Tools登録** (https://www.bing.com/webmasters/): **要人間確認・要人間作業**。
   - **重要な整理**: IndexNow公式ドキュメント (indexnow.org/documentation, bing.com/indexnow) を確認した限り、IndexNowのURL送信が実際に効果を持つための必須条件は「キーファイルによる所有権証明」のみであり、Bing Webmaster Toolsへのサイト登録が送信の有効性そのものの前提条件であるとは明記されていない。つまりIndexNow自体は独立して機能する設計と考えられる。
   - ただし、Bing Webmaster Toolsに登録すると管理画面上でIndexNow経由の送信状況をモニタリング・確認できる（と一般に案内されている）という側面もあり、この「モニタリング目的」の有用性については今回ライブページの直接確認では明文の一文を見つけられておらず、一般的な理解に基づく推測を含む。**確信度は中程度**として扱ってほしい。
   - 結論: Bing Webmaster Tools未登録でもIndexNow送信自体は動作すると考えられるが、送信が実際にBing側でどう扱われているかを可視化・監視したい場合は登録を推奨する。登録作業はBing側のログインが必要な人間専用の作業のため、本PRには含まれない。
