BEGIN;
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','forage','あさる','v','英検1級',3,1245
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='forage');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','formidable','恐ろしい','adj','英検1級',4,1246
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='formidable');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','forthright','率直な','adj','英検1級',3,1247
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='forthright');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','fractious','怒りっぽい','adj','英検1級',3,1248
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='fractious');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','fraught','〜で満ちた','adj','英検1級',4,1249
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='fraught');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','frugal','倹約的な','adj','英検1級',3,1250
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='frugal');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','garner','集める','v','英検1級',4,1251
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='garner');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','garrulous','おしゃべりな','adj','英検1級',3,1252
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='garrulous');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','glean','収集する','v','英検1級',4,1253
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='glean');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','glib','口先だけの','adj','英検1級',3,1254
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='glib');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','graft','腐敗','n','英検1級',3,1255
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='graft');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','gratuitous','不必要な','adj','英検1級',3,1256
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='gratuitous');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','gregarious','社交的な','adj','英検1級',3,1257
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='gregarious');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','groundbreaking','画期的な','adj','英検1級',4,1258
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='groundbreaking');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','guile','狡猾さ','n','英検1級',3,1259
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='guile');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','hamper','妨げる','v','英検1級',4,1260
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='hamper');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','harbinger','前兆','n','英検1級',3,1261
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='harbinger');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','harrowing','痛ましい','adj','英検1級',3,1262
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='harrowing');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','hasty','性急な','adj','英検1級',4,1263
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='hasty');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','haughty','傲慢な','adj','英検1級',3,1264
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='haughty');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','heinous','凶悪な','adj','英検1級',3,1265
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='heinous');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','herald','予告する','v','英検1級',4,1266
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='herald');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','heretical','異端的な','adj','英検1級',3,1267
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='heretical');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','homogeneous','均質な','adj','英検1級',4,1268
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='homogeneous');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','hostile','敵対的な','adj','英検1級',4,1269
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='hostile');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','hypocritical','偽善的な','adj','英検1級',4,1270
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='hypocritical');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','ideology','イデオロギー','n','英検1級',4,1271
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='ideology');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','imminent','差し迫った','adj','英検1級',4,1272
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='imminent');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','impartial','公平な','adj','英検1級',4,1273
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='impartial');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','impasse','行き詰まり','n','英検1級',4,1274
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='impasse');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','implicate','関与させる','v','英検1級',4,1275
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='implicate');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','incessant','絶え間ない','adj','英検1級',4,1276
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='incessant');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','incite','扇動する','v','英検1級',4,1277
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='incite');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','incongruent','矛盾した','adj','英検1級',3,1278
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='incongruent');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','indifferent','無関心な','adj','英検1級',4,1279
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='indifferent');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','indignant','憤慨した','adj','英検1級',4,1280
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='indignant');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','indiscriminate','無差別な','adj','英検1級',4,1281
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='indiscriminate');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','inept','不適当な','adj','英検1級',3,1282
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='inept');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','inertia','惰性','n','英検1級',4,1283
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='inertia');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','inflammatory','扇動的な','adj','英検1級',4,1284
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='inflammatory');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','ingenuity','独創性','n','英検1級',4,1285
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='ingenuity');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','inherent','固有の','adj','英検1級',4,1286
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='inherent');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','innocuous','無害な','adj','英検1級',3,1287
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='innocuous');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','insidious','陰険な','adj','英検1級',4,1288
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='insidious');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','insolent','無礼な','adj','英検1級',3,1289
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='insolent');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','instigate','挑発する','v','英検1級',4,1290
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='instigate');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','intransigent','妥協しない','adj','英検1級',3,1291
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='intransigent');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','irate','激怒した','adj','英検1級',3,1292
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='irate');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','irreconcilable','和解できない','adj','英検1級',4,1293
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='irreconcilable');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','jeopardize','危険にさらす','v','英検1級',4,1294
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='jeopardize');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','juxtapose','対比する','v','英検1級',4,1295
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='juxtapose');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','kindle','刺激する','v','英検1級',3,1296
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='kindle');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','laborious','骨の折れる','adj','英検1級',4,1297
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='laborious');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','lament','嘆く','v','英検1級',4,1298
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='lament');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','languish','衰える','v','英検1級',4,1299
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='languish');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','lenient','寛大な','adj','英検1級',4,1300
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='lenient');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','loom','迫る','v','英検1級',4,1301
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='loom');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','lopsided','不均衡な','adj','英検1級',3,1302
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='lopsided');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','lurid','けばけばしい','adj','英検1級',3,1303
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='lurid');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','magnanimous','寛大な','adj','英検1級',3,1304
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='magnanimous');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','malevolent','悪意ある','adj','英検1級',4,1305
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='malevolent');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','malleable','順応性のある','adj','英検1級',4,1306
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='malleable');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','marginalize','周縁化する','v','英検1級',4,1307
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='marginalize');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','maverick','異端者','n','英検1級',4,1308
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='maverick');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','menace','脅威','n','英検1級',4,1309
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='menace');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','mercenary','傭兵','n','英検1級',3,1310
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='mercenary');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','mire','泥沼','n','英検1級',3,1311
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='mire');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','mobilize','動員する','v','英検1級',4,1312
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='mobilize');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','mock','嘲る','v','英検1級',4,1313
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='mock');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','moribund','死にかけた','adj','英検1級',3,1314
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='moribund');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','muster','召集する','v','英検1級',4,1315
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='muster');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','negate','打ち消す','v','英検1級',4,1316
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='negate');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','negligent','怠慢な','adj','英検1級',4,1317
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='negligent');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','nostalgic','懐かしい','adj','英検1級',4,1318
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='nostalgic');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','noxious','有害な','adj','英検1級',3,1319
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='noxious');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','obnoxious','不快な','adj','英検1級',4,1320
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='obnoxious');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','obliterate','消し去る','v','英検1級',4,1321
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='obliterate');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','obsequious','へつらう','adj','英検1級',3,1322
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='obsequious');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','obsolete','廃れた','adj','英検1級',4,1323
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='obsolete');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','ominous','不吉な','adj','英検1級',4,1324
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='ominous');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','opportunistic','日和見的な','adj','英検1級',4,1325
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='opportunistic');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','oppressive','抑圧的な','adj','英検1級',4,1326
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='oppressive');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','orthodox','正統的な','adj','英検1級',4,1327
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='orthodox');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','outrage','憤激','n','英検1級',4,1328
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='outrage');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','overbearing','高圧的な','adj','英検1級',3,1329
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='overbearing');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','overstate','誇張する','v','英検1級',4,1330
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='overstate');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','painstaking','念入りな','adj','英検1級',4,1331
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='painstaking');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','paradoxical','逆説的な','adj','英検1級',4,1332
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='paradoxical');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','patronize','恩着せがましくする','v','英検1級',4,1333
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='patronize');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','pejorate','悪化する','v','英検1級',3,1334
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='pejorate');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','penal','刑事上の','adj','英検1級',3,1335
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='penal');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','penalize','罰する','v','英検1級',4,1336
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='penalize');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','perennial','永続的な','adj','英検1級',4,1337
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='perennial');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','peripheral','周辺的な','adj','英検1級',4,1338
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='peripheral');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','pessimistic','悲観的な','adj','英検1級',4,1339
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='pessimistic');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','petulant','不機嫌な','adj','英検1級',3,1340
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='petulant');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','piecemeal','断片的な','adj','英検1級',3,1341
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='piecemeal');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','pinpoint','正確に特定する','v','英検1級',4,1342
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='pinpoint');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','pivotal','重要な','adj','英検1級',4,1343
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='pivotal');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000032','placebo','プラセボ','n','英検1級',3,1344
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000032' AND word='placebo');
COMMIT;