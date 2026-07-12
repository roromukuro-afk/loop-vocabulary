# 90日成長ロードマップ（Phase 9）

`MARKETING_X_30DAY_CALENDAR.md`（30日間のX投稿計画）・`GROWTH_MEASUREMENT_PLAN.md`（計測基盤）を土台に、AdSense審査前監査の結果を踏まえた実装寄りの90日計画。

## Week 1-2: AdSense審査前の是正（このラウンドで着手済み）

- [x] 教材名/語数不整合の是正（4件、`reports/material-count-consistency.md`）
- [x] noindex漏れの是正（`/beta` `/premium/success` `/referral/*` `/offline` `/auth/*`）
- [x] プライバシーポリシーのCMP/Cookie/AdSense開示の正確性確認（`PRIVACY_CMP_ADSENSE_AUDIT.md`）
- [ ] **人間の作業**: AdSense管理画面で以下を確認・設定（`PRIVACY_CMP_ADSENSE_AUDIT.md`のバケットB項目）
  - Google認定CMP（Privacy & messaging）のEEA/UK/Switzerland向け設定
  - `ads.txt` のAuthorized状態確認
  - Auto ads vs 手動広告ユニットの構成確認
  - パーソナライズ広告のデフォルト状態（同意前は非パーソナライズになっているか）確認
- [ ] requireUser()保護下の個人ページ（`/dashboard`等15ページ以上）へのmeta noindex明示追加（`SEO_INDEXING_POLICY.md`のTODO参照）
- [ ] 出典未記録の教材4件（`reports/material-count-consistency.md`参照）の出典を人力で確認・`license_note`に記録

## Week 3-4: 公開コンテンツの強化

- [ ] `GUIDE_REWRITE_PRIORITY.md` の上位候補記事の残り分（全面改稿していない分）を順次改稿
- [ ] Phase 2で対応した英検/TOEIC記事以外の残りの試験関連記事にも「最終確認日」「出典」を横展開
- [ ] 内部リンクの再点検（`/tools`ハブが新設されたため、関連ガイド記事から`/tools`への導線を追加）

## Month 2: 検索流入を増やす無料ツール

- [ ] `TOOLS_SEO_ROADMAP.md` に記載の2ツール（試験日逆算学習計画・単語リストCSV変換）の実装検討
- [ ] `/tools`からの遷移率・直帰率をGA4で計測し、優先度を再評価
- [ ] Bing Webmaster Tools登録状況を確認（`AI_SEARCH_AND_INDEXNOW_POLICY.md`参照、人間作業）

## Month 3: 独自データ・被リンク

- [ ] `/reports`の「最低サンプルサイズ基準」（単語100件・カテゴリ300件）を満たす項目があるか確認し、条件を満たせば実データ公開に着手
- [ ] 教育系メディア・塾向けメディアへの`/guide/vocabulary-quiz-pdf-for-teachers`等の紹介依頼（被リンク獲得、手動営業が必要）
- [ ] `MARKETING_X_30DAY_CALENDAR.md` の投稿サイクルを継続し、31日目以降の新カレンダーを作成

## 追跡する指標

| 指標 | 確認場所 | 頻度 |
|---|---|---|
| インデックス済みページ数・除外ページ数 | Search Console カバレッジレポート | 週次 |
| `noindex`対象URLが誤ってインデックスされていないか | Search Console URL検査 | 月次 |
| 教材詳細ページの平均掲載順位・クリック率 | Search Console 検索パフォーマンス | 週次 |
| `/tools`・語彙力診断・辞書検索の流入経路 | GA4 トラフィック獲得 | 週次 |
| AdSense審査結果・広告表示状況 | AdSense管理画面 | 都度 |

## Search Consoleで確認すべきURL（このラウンドの変更を反映）

- `/beta` `/premium/success` `/referral/*` `/offline` — 「除外（noindexタグ）」に分類されているか
- 教材詳細ページ4件（`英検2級 基礎単語` `英検準1級 基礎単語` `TOEIC頻出基礎単語` `TOEIC 頻出単語 2500`）— タイトル変更後、再クロール・再インデックスされているか
- `/tools` — 新規ページとして正しくインデックスされるか

## GO/NO-GO判定条件（AdSense再審査に進む前の最終チェック）

1. `npm run test:material-count-consistency` `test:indexing-policy` `test:privacy-ads-disclosure` `test:external-material-rights` `test:exam-info-sources` がすべてパスしている
2. 上記「人間の作業」のうちAdSense管理画面側の項目（CMP設定・ads.txt確認）が完了している
3. Search Consoleで`noindex`対象URLが実際に除外されていることを確認できている
4. 明らかな断定的表現（合格保証・成績保証等）が主要ページに残っていないことを`test:adsense-readiness`で確認できている

上記すべてを満たした時点でGO。1つでも未達の場合は該当項目を解消してから審査に進む。
