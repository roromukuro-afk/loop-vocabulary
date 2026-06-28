BEGIN;
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','field trip','校外学習','n','英検準2級',4,1801
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='field trip');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','fundraiser','資金調達イベント','n','英検準2級',3,1802
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='fundraiser');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','generation gap','世代間のギャップ','n','英検準2級',4,1803
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='generation gap');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','go on a diet','ダイエットをする','v','英検準2級',4,1804
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='go on a diet');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','grading system','採点制度','n','英検準2級',3,1805
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='grading system');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','grow up','成長する','v','英検準2級',4,1806
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='grow up');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','hands-on experience','実践経験','n','英検準2級',4,1807
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='hands-on experience');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','health care system','医療制度','n','英検準2級',4,1808
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='health care system');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','high-tech','ハイテクの','adj','英検準2級',4,1809
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='high-tech');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','hold an event','イベントを開催する','v','英検準2級',4,1810
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='hold an event');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','human rights','人権','n','英検準2級',4,1811
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='human rights');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','in addition to','〜に加えて','prep','英検準2級',5,1812
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='in addition to');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','in general','一般的に','adv','英検準2級',5,1813
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='in general');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','infrastructure','インフラ','n','英検準2級',4,1814
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='infrastructure');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','innovative','革新的な','adj','英検準2級',4,1815
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='innovative');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','intellectual','知識的な','adj','英検準2級',4,1816
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='intellectual');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','is likely to','〜しそうだ','v','英検準2級',5,1817
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='is likely to');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','job satisfaction','仕事の満足感','n','英検準2級',4,1818
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='job satisfaction');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','keep in mind','心に留める','v','英検準2級',4,1819
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='keep in mind');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','lead to','〜につながる','v','英検準2級',5,1820
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='lead to');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','local community','地域社会','n','英検準2級',4,1821
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='local community');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','long-term','長期的な','adj','英検準2級',4,1822
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='long-term');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','look up to','〜を尊敬する','v','英検準2級',4,1823
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='look up to');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','make a decision','決断する','v','英検準2級',5,1824
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='make a decision');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','major in','〜を専攻する','v','英検準2級',4,1825
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='major in');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','manage to','何とかして〜する','v','英検準2級',4,1826
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='manage to');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','minimum wage','最低賃金','n','英検準2級',4,1827
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='minimum wage');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','moral value','道徳的価値','n','英検準2級',3,1828
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='moral value');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','nutrition','栄養','n','英検準2級',4,1829
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='nutrition');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','obstacle','障害','n','英検準2級',4,1830
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='obstacle');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','on purpose','わざと','adv','英検準2級',4,1831
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='on purpose');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','opinion poll','世論調査','n','英検準2級',3,1832
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='opinion poll');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','outstanding','優れた','adj','英検準2級',4,1833
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='outstanding');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','overcrowded','過密な','adj','英検準2級',4,1834
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='overcrowded');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','overcome','乗り越える','v','英検準2級',4,1835
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='overcome');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','part-time job','アルバイト','n','英検準2級',4,1836
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='part-time job');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','pay attention to','〜に注意を払う','v','英検準2級',5,1837
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='pay attention to');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','per capita','一人当たり','adv','英検準2級',3,1838
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='per capita');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','physical activity','身体活動','n','英検準2級',4,1839
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='physical activity');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','play a role','役割を果たす','v','英検準2級',5,1840
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='play a role');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','policy maker','政策立案者','n','英検準2級',3,1841
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='policy maker');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','positive attitude','前向きな姿勢','n','英検準2級',4,1842
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='positive attitude');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','potential','可能性','n','英検準2級',4,1843
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='potential');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','prevent from','〜を妨げる','v','英検準2級',4,1844
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='prevent from');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','primary school','小学校','n','英検準2級',4,1845
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='primary school');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','prior to','〜の前に','prep','英検準2級',4,1846
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='prior to');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','promote health','健康を促進する','v','英検準2級',4,1847
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='promote health');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','public transportation','公共交通機関','n','英検準2級',4,1848
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='public transportation');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','put into practice','実践する','v','英検準2級',4,1849
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='put into practice');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','raise awareness','認識を高める','v','英検準2級',4,1850
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='raise awareness');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','rapid growth','急速な成長','n','英検準2級',4,1851
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='rapid growth');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','rate of unemployment','失業率','n','英検準2級',4,1852
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='rate of unemployment');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','reach a goal','目標を達成する','v','英検準2級',4,1853
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='reach a goal');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','recycling program','リサイクルプログラム','n','英検準2級',4,1854
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='recycling program');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','reduce stress','ストレスを軽減する','v','英検準2級',4,1855
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='reduce stress');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','regardless of','〜に関係なく','prep','英検準2級',4,1856
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='regardless of');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','remote area','遠隔地','n','英検準2級',3,1857
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='remote area');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','right to vote','選挙権','n','英検準2級',3,1858
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='right to vote');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','role model','ロールモデル','n','英検準2級',4,1859
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='role model');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','save energy','エネルギーを節約する','v','英検準2級',4,1860
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='save energy');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','scholarship','奨学金','n','英検準2級',4,1861
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='scholarship');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','screen time','スクリーン時間','n','英検準2級',4,1862
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='screen time');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','self-discipline','自己規律','n','英検準2級',4,1863
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='self-discipline');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','senior citizen','高齢者','n','英検準2級',4,1864
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='senior citizen');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','shift work','シフト勤務','n','英検準2級',3,1865
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='shift work');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','shortage of workers','労働力不足','n','英検準2級',4,1866
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='shortage of workers');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','show interest in','〜に興味を示す','v','英検準2級',4,1867
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='show interest in');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','social media','ソーシャルメディア','n','英検準2級',5,1868
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='social media');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','solar energy','太陽エネルギー','n','英検準2級',4,1869
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='solar energy');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','specialize in','〜を専門にする','v','英検準2級',4,1870
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='specialize in');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','starvation','飢餓','n','英検準2級',3,1871
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='starvation');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','stereotyping','固定観念を持つこと','n','英検準2級',4,1872
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='stereotyping');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','student loan','学生ローン','n','英検準2級',4,1873
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='student loan');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','sustainable development','持続可能な開発','n','英検準2級',4,1874
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='sustainable development');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','take action','行動を起こす','v','英検準2級',5,1875
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='take action');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','take a risk','リスクを冒す','v','英検準2級',4,1876
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='take a risk');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','tend to','〜する傾向がある','v','英検準2級',5,1877
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='tend to');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','there is no doubt that','〜は疑いない','phrase','英検準2級',4,1878
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='there is no doubt that');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','threat to the environment','環境への脅威','n','英検準2級',4,1879
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='threat to the environment');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','throughout the world','世界中に','adv','英検準2級',4,1880
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='throughout the world');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','timetable','時刻表','n','英検準2級',4,1881
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='timetable');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','to be honest','正直に言えば','phrase','英検準2級',4,1882
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='to be honest');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','trade-off','トレードオフ','n','英検準2級',4,1883
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='trade-off');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','traditional culture','伝統文化','n','英検準2級',4,1884
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='traditional culture');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','turn into','〜に変わる','v','英検準2級',4,1885
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='turn into');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','undergraduate','学部生','n','英検準2級',3,1886
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='undergraduate');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','unemployment rate','失業率','n','英検準2級',4,1887
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='unemployment rate');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','university degree','大学の学位','n','英検準2級',4,1888
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='university degree');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','up to date','最新の','adj','英検準2級',4,1889
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='up to date');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','urban area','都市部','n','英検準2級',4,1890
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='urban area');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','usage','使用','n','英検準2級',4,1891
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='usage');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','valuable experience','貴重な経験','n','英検準2級',4,1892
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='valuable experience');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','variety of','様々な','adj','英検準2級',4,1893
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='variety of');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','video call','ビデオ通話','n','英検準2級',4,1894
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='video call');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','volunteerism','ボランティア精神','n','英検準2級',3,1895
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='volunteerism');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','water pollution','水質汚染','n','英検準2級',4,1896
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='water pollution');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','well-being','幸福','n','英検準2級',4,1897
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='well-being');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','what is more','さらに','phrase','英検準2級',4,1898
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='what is more');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','with regard to','〜に関して','prep','英検準2級',4,1899
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='with regard to');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000033','work ethic','勤労倫理','n','英検準2級',4,1900
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000033' AND word='work ethic');
COMMIT;