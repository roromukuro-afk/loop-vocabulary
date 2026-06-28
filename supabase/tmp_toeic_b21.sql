BEGIN;
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','gross profit','粗利益','n','TOEIC',4,2001
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='gross profit');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','headcount','従業員数','n','TOEIC',4,2002
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='headcount');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','hedge','リスク回避','n','TOEIC',4,2003
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='hedge');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','high-priority','最優先の','adj','TOEIC',4,2004
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='high-priority');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','incentive','奨励策','n','TOEIC',4,2005
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='incentive');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','incur','生じる','v','TOEIC',4,2006
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='incur');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','indemnity','補償','n','TOEIC',3,2007
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='indemnity');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','influx','流入','n','TOEIC',4,2008
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='influx');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','initial public offering','新規株式公開(IPO)','n','TOEIC',3,2009
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='initial public offering');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','initiative','取り組み','n','TOEIC',4,2010
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='initiative');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','intangible','無形の','adj','TOEIC',3,2011
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='intangible');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','interim','中間の','adj','TOEIC',4,2012
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='interim');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','inventory management','在庫管理','n','TOEIC',4,2013
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='inventory management');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','joint venture','合弁事業','n','TOEIC',4,2014
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='joint venture');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','KPI','重要業績評価指標','n','TOEIC',4,2015
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='KPI');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','labor shortage','人手不足','n','TOEIC',4,2016
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='labor shortage');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','layoff','一時解雇','n','TOEIC',4,2017
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='layoff');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','lead time','リードタイム','n','TOEIC',4,2018
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='lead time');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','letter of intent','意向書','n','TOEIC',3,2019
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='letter of intent');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','liability insurance','賠償責任保険','n','TOEIC',3,2020
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='liability insurance');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','line manager','直属の上司','n','TOEIC',4,2021
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='line manager');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','liquidate','清算する','v','TOEIC',3,2022
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='liquidate');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','long-term strategy','長期戦略','n','TOEIC',4,2023
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='long-term strategy');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','lump sum','一括払い','n','TOEIC',3,2024
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='lump sum');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','margin','利益率','n','TOEIC',4,2025
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='margin');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','market penetration','市場浸透','n','TOEIC',4,2026
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='market penetration');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','maternity leave','産休','n','TOEIC',4,2027
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='maternity leave');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','memo','社内連絡文','n','TOEIC',5,2028
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='memo');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','micromanage','細かく管理する','v','TOEIC',3,2029
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='micromanage');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','minutes','議事録','n','TOEIC',4,2030
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='minutes');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','mission statement','経営理念','n','TOEIC',4,2031
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='mission statement');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','net income','純利益','n','TOEIC',4,2032
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='net income');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','non-disclosure agreement','秘密保持契約','n','TOEIC',3,2033
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='non-disclosure agreement');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','occupancy rate','稼働率','n','TOEIC',3,2034
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='occupancy rate');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','on-the-job training','職場内訓練','n','TOEIC',4,2035
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='on-the-job training');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','operational efficiency','業務効率','n','TOEIC',4,2036
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='operational efficiency');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','organizational chart','組織図','n','TOEIC',4,2037
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='organizational chart');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','outperform','凌ぐ','v','TOEIC',4,2038
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='outperform');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','ownership','所有権','n','TOEIC',4,2039
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='ownership');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','paid leave','有給休暇','n','TOEIC',5,2040
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='paid leave');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','parental leave','育児休暇','n','TOEIC',4,2041
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='parental leave');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','patent','特許','n','TOEIC',4,2042
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='patent');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','pay raise','昇給','n','TOEIC',5,2043
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='pay raise');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','peer review','仲間による評価','n','TOEIC',3,2044
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='peer review');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','pending','保留中の','adj','TOEIC',4,2045
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='pending');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','pilot program','試験的なプログラム','n','TOEIC',4,2046
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='pilot program');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','point of contact','担当窓口','n','TOEIC',4,2047
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='point of contact');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','press release','プレスリリース','n','TOEIC',4,2048
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='press release');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','priority','優先事項','n','TOEIC',5,2049
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='priority');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','probationary period','試用期間','n','TOEIC',4,2050
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='probationary period');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','product launch','新製品発売','n','TOEIC',5,2051
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='product launch');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','profit margin','利益率','n','TOEIC',4,2052
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='profit margin');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','project scope','プロジェクト範囲','n','TOEIC',4,2053
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='project scope');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','promotional campaign','販促キャンペーン','n','TOEIC',4,2054
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='promotional campaign');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','purchase order','発注書','n','TOEIC',4,2055
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='purchase order');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','quality assurance','品質保証','n','TOEIC',4,2056
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='quality assurance');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','receivables','売掛金','n','TOEIC',3,2057
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='receivables');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','recruitment drive','採用活動','n','TOEIC',4,2058
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='recruitment drive');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','reimbursement','払い戻し','n','TOEIC',4,2059
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='reimbursement');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','reorganization','組織再編','n','TOEIC',4,2060
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='reorganization');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','retail outlet','小売店','n','TOEIC',4,2061
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='retail outlet');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','return on investment','投資収益率','n','TOEIC',4,2062
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='return on investment');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','review meeting','振り返りミーティング','n','TOEIC',4,2063
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='review meeting');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','risk assessment','リスク評価','n','TOEIC',4,2064
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='risk assessment');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','ROI','投資収益率','n','TOEIC',4,2065
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='ROI');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','run out of','〜を使い果たす','phrase','TOEIC',5,2066
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='run out of');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','salary negotiation','給与交渉','n','TOEIC',4,2067
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='salary negotiation');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','sales forecast','売上予測','n','TOEIC',4,2068
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='sales forecast');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','sign off on','〜を承認する','phrase','TOEIC',4,2069
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='sign off on');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','silent partner','匿名組合員','n','TOEIC',3,2070
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='silent partner');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','skill gap','スキルの差','n','TOEIC',4,2071
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='skill gap');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','social media marketing','ソーシャルメディアマーケティング','n','TOEIC',4,2072
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='social media marketing');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','sole proprietor','個人事業主','n','TOEIC',3,2073
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='sole proprietor');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','spending cap','支出上限','n','TOEIC',3,2074
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='spending cap');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','stakeholder management','ステークホルダー管理','n','TOEIC',4,2075
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='stakeholder management');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','standby','待機','n','TOEIC',4,2076
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='standby');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','stock option','ストックオプション','n','TOEIC',4,2077
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='stock option');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','subcontract','下請け','n/v','TOEIC',4,2078
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='subcontract');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','supply and demand','需要と供給','n','TOEIC',4,2079
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='supply and demand');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','survey results','調査結果','n','TOEIC',4,2080
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='survey results');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','talent acquisition','人材採用','n','TOEIC',4,2081
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='talent acquisition');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','target audience','ターゲット層','n','TOEIC',4,2082
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='target audience');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','task force','特別委員会','n','TOEIC',4,2083
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='task force');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','technical support','技術サポート','n','TOEIC',5,2084
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='technical support');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','terms of service','利用規約','n','TOEIC',4,2085
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='terms of service');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','time management','時間管理','n','TOEIC',5,2086
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='time management');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','top line','売上高','n','TOEIC',3,2087
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='top line');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','trade show','見本市','n','TOEIC',4,2088
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='trade show');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','transfer pricing','移転価格','n','TOEIC',3,2089
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='transfer pricing');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','troubleshoot','トラブルシューティングする','v','TOEIC',4,2090
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='troubleshoot');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','turnkey','すぐ使える','adj','TOEIC',3,2091
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='turnkey');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','unanimous decision','全会一致の決定','n','TOEIC',3,2092
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='unanimous decision');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','underwrite','引受ける','v','TOEIC',3,2093
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='underwrite');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','upgrade','アップグレード','n/v','TOEIC',5,2094
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='upgrade');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','user-friendly','使いやすい','adj','TOEIC',4,2095
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='user-friendly');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','variable cost','変動費','n','TOEIC',4,2096
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='variable cost');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','vertical integration','垂直統合','n','TOEIC',3,2097
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='vertical integration');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','vetting','審査','n','TOEIC',3,2098
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='vetting');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','whitepaper','白書','n','TOEIC',3,2099
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='whitepaper');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000031','work-life balance','仕事と生活のバランス','n','TOEIC',5,2100
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000031' AND word='work-life balance');
COMMIT;