# 自律SEO改善ループ ポリシー

SEOはGrowth OSとは別管理にせず、`improvement_issues`(category='seo')として同じループに統合する。

## 自動検出項目(`src/lib/improvement/analyzers/seo.ts`)

- title重複・description重複
- canonical不一致(自己参照でない、複数存在、vercel.appドメイン混入の再発)
- sitemap不整合(sitemapに載っているのに404/noindex、逆にindex対象なのにsitemap未掲載)
- noindex漏れ(HTMLはnoindexだがrobots.txtでブロックされ読めない — 2026-07-15に発見した実例のパターンを継続監視)
- internal link不足(orphan page候補: サイト内のどこからもリンクされていない公開ページ)
- 404(サイトマップ・内部リンクからリンクされているが404を返すURL)
- outdated content(教材語数不一致 — 既存`scripts/materials/audit-existing-materials.mjs`相当のロジックを再利用、試験情報の更新期限切れ)
- 薄い辞書ページ・低品質guide(`content.ts`と共通の品質スコアを参照)
- index対象なのに内容不足 / index不要なのに公開中

## AIが自動でできる範囲(Level 2まで: 改善案を作るがコードは書かない、または軽微な修正はLevel 3でDraft PRまで)

- 修正案・書き直し案の作成(`improvement_tasks.proposed_solution`)
- 内部リンク案
- metadata案(title/description案)
- 更新対象リストの作成
- 軽微な修正(例: canonicalタグの欠落追加、noindexとrobots.txtの矛盾解消)のDraft PR作成

## 人間承認が必須(`implementation_type='human_only'`に固定)

- 新規ページの公開
- 大量URL公開(プログラマティックSEOでの一括生成)
- noindexの変更(index化・非index化どちらの方向でも)
- 教材・試験情報の**事実**の変更(語数・合格ライン・試験日程等 — 内容の正確性は人間が最終確認する)
- 市販教材関連(著作権・ライセンス表記に関わるため)
- 法的表現(特商法・プライバシーポリシー等、`legal`カテゴリと重複する範囲)

これらはIssueとしては`autonomy_level`に関わらず生成してよいが、`improvement_tasks`は作らず`proposed_solution`のテキスト提案のみで止め、`/admin/improvements`上で「人間が直接判断・実施」であることを明示する。
