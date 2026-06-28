BEGIN;
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','hypothesis','仮説','n','高校英語基礎',4,1201
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='hypothesis');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','photosynthesis','光合成','n','高校英語基礎',4,1202
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='photosynthesis');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','ecosystem','生態系','n','高校英語基礎',4,1203
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='ecosystem');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','evolution','進化','n','高校英語基礎',4,1204
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='evolution');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','molecule','分子','n','高校英語基礎',4,1205
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='molecule');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','gravity','重力','n','高校英語基礎',4,1206
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='gravity');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','atom','原子','n','高校英語基礎',4,1207
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='atom');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','bacteria','細菌','n','高校英語基礎',4,1208
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='bacteria');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','chromosome','染色体','n','高校英語基礎',3,1209
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='chromosome');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','democracy','民主主義','n','高校英語基礎',4,1210
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='democracy');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','constitution','憲法','n','高校英語基礎',4,1211
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='constitution');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','philosophy','哲学','n','高校英語基礎',4,1212
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='philosophy');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','sociology','社会学','n','高校英語基礎',3,1213
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='sociology');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','economics','経済学','n','高校英語基礎',4,1214
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='economics');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','algebra','代数','n','高校英語基礎',4,1215
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='algebra');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','geometry','幾何学','n','高校英語基礎',4,1216
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='geometry');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','statistics','統計学','n','高校英語基礎',4,1217
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='statistics');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','theorem','定理','n','高校英語基礎',3,1218
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='theorem');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','equation','方程式','n','高校英語基礎',4,1219
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='equation');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','coefficient','係数','n','高校英語基礎',3,1220
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='coefficient');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','medieval','中世の','adj','高校英語基礎',4,1221
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='medieval');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','colonization','植民地化','n','高校英語基礎',4,1222
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='colonization');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','revolution','革命','n','高校英語基礎',4,1223
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='revolution');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','civilization','文明','n','高校英語基礎',4,1224
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='civilization');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','geography','地理学','n','高校英語基礎',4,1225
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='geography');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','latitude','緯度','n','高校英語基礎',3,1226
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='latitude');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','longitude','経度','n','高校英語基礎',3,1227
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='longitude');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','peninsula','半島','n','高校英語基礎',4,1228
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='peninsula');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','continent','大陸','n','高校英語基礎',4,1229
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='continent');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','hemisphere','半球','n','高校英語基礎',3,1230
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='hemisphere');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','metaphor','比喩','n','高校英語基礎',4,1231
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='metaphor');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','prose','散文','n','高校英語基礎',3,1232
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='prose');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','poetry','詩','n','高校英語基礎',4,1233
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='poetry');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','whereas','一方で','conj','高校英語基礎',4,1234
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='whereas');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','contrary to','〜に反して','phrase','高校英語基礎',4,1235
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='contrary to');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','in conclusion','結論として','phrase','高校英語基礎',4,1236
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='in conclusion');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','consequently','その結果','adv','高校英語基礎',4,1237
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='consequently');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','furthermore','さらに','adv','高校英語基礎',4,1238
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='furthermore');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','on the other hand','一方では','phrase','高校英語基礎',5,1239
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='on the other hand');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','in contrast','対照的に','phrase','高校英語基礎',4,1240
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='in contrast');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','nevertheless','それにもかかわらず','adv','高校英語基礎',4,1241
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='nevertheless');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','sufficient','十分な','adj','高校英語基礎',4,1242
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='sufficient');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','significant','重要な','adj','高校英語基礎',4,1243
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='significant');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','substantial','かなりの','adj','高校英語基礎',4,1244
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='substantial');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','subsequent','続く','adj','高校英語基礎',4,1245
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='subsequent');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','phenomenon','現象','n','高校英語基礎',4,1246
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='phenomenon');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','principle','原理','n','高校英語基礎',4,1247
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='principle');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','perspective','視点','n','高校英語基礎',4,1248
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='perspective');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','circumstance','状況','n','高校英語基礎',4,1249
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='circumstance');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000030','phenomenon','現象','n','高校英語基礎',4,1250
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000030' AND word='phenomenon');
COMMIT;