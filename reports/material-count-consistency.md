# 教材名/語数整合性 監査レポート

生成日時: 2026-07-12T14:17:05.068Z

- 監査対象教材数: 46
- 語数表記あり: 19
- 不整合(mismatch): 0
- 出典未記録(approved but no publisher/author/license_note): 4

## 不整合一覧

不整合なし（2026-07-12ラウンドで検出された4件は修正済み: 英検2級 基礎単語 / 英検準1級 基礎単語 / TOEIC頻出基礎単語 / TOEIC 頻出単語 2500）。

## 出典未記録の要確認教材（license_status=approvedだがpublisher/author/license_noteが空）

これらは自社データか外部データか判別できないため、人間による出典確認が必要です。

| id | title | actual words | is_public |
|---|---|---|---|
| 96d6e5a2-c0f5-48b1-8eed-14a91424790f | TOEIC頻出基礎単語 | 263 | false |
| 00000000-0000-0000-0000-000000000024 | 大学受験英単語1500 | 1553 | true |
| f2661c18-fb99-4ec2-888f-30e1fd012da0 | 英検2級 基礎単語 | 349 | false |
| 5eae7c64-fcb5-4164-99fb-cdb5ce10567c | 英検準1級 基礎単語 | 265 | false |

### 一時非公開の対応状況

2026-07-12: 出典未記録のまま`license_status=approved`だった以下の教材は、AdSense再申請前の安全判断として`is_public=false`に変更済み（削除ではない）。sitemap・/materials一覧・カテゴリLP（/materials/eiken・/materials/toeic）・関連ガイド記事のCTAカードからは除外され、詳細ページは既存の`materials/[id]/page.tsx`の`is_public=true`フィルタにより404となる。

- TOEIC頻出基礎単語（96d6e5a2-c0f5-48b1-8eed-14a91424790f）
- 英検2級 基礎単語（f2661c18-fb99-4ec2-888f-30e1fd012da0）
- 英検準1級 基礎単語（5eae7c64-fcb5-4164-99fb-cdb5ce10567c）

**再公開の条件**（いずれかを満たし、対応するDBフィールドを記録すること）:
1. 出所が自社作成であることを確認できる → `license_note`に記録
2. 外部由来の場合、公開・PDF/CSV出力・共有利用の許諾範囲を確認できる → `licenses`テーブルに`note`/`approved_by`/`approved_at`を記録し`license_id`を設定
3. `publisher`/`author`/`license_note`のいずれかを適切に記録する（PDF/CSV出力時に出典表示が空にならないようにするため）

詳細は `EXTERNAL_MATERIALS_RIGHTS_AUDIT.md` を参照。
