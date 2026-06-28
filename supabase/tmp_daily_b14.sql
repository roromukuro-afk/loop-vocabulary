BEGIN;
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','May I take your order?','ご注文をうかがってもよろしいですか？','phrase','日常英会話',5,1401
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='May I take your order?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''d like the chicken.','チキンをお願いします。','phrase','日常英会話',4,1402
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''d like the chicken.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Can I have the menu?','メニューをいただけますか？','phrase','日常英会話',4,1403
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Can I have the menu?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What do you recommend?','何がお勧めですか？','phrase','日常英会話',4,1404
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What do you recommend?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m allergic to nuts.','ナッツアレルギーがあります。','phrase','日常英会話',4,1405
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m allergic to nuts.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Could we have separate bills?','別々のお会計にできますか？','phrase','日常英会話',4,1406
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Could we have separate bills?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Keep the change.','お釣りはいりません。','phrase','日常英会話',4,1407
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Keep the change.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Do you take credit cards?','クレジットカードは使えますか？','phrase','日常英会話',4,1408
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Do you take credit cards?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It was delicious.','とてもおいしかったです。','phrase','日常英会話',4,1409
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It was delicious.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Can I have a refill?','おかわりをいただけますか？','phrase','日常英会話',3,1410
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Can I have a refill?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Excuse me, the check please.','すみません、お会計をお願いします。','phrase','日常英会話',4,1411
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Excuse me, the check please.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What are the hours?','営業時間は何時ですか？','phrase','日常英会話',4,1412
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What are the hours?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Is this on sale?','これはセール中ですか？','phrase','日常英会話',4,1413
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Is this on sale?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Do you have this in a different size?','これの違うサイズはありますか？','phrase','日常英会話',4,1414
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Do you have this in a different size?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Can I try this on?','試着してもいいですか？','phrase','日常英会話',4,1415
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Can I try this on?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ll take it.','これをいただきます。','phrase','日常英会話',4,1416
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ll take it.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m just browsing.','見ているだけです。','phrase','日常英会話',4,1417
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m just browsing.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Can I return this?','これを返品できますか？','phrase','日常英会話',4,1418
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Can I return this?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I need a receipt.','領収書が必要です。','phrase','日常英会話',4,1419
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I need a receipt.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Is there a discount?','割引はありますか？','phrase','日常英会話',4,1420
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Is there a discount?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Where is the nearest ATM?','最寄りのATMはどこですか？','phrase','日常英会話',4,1421
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Where is the nearest ATM?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','How do I get to the station?','駅にはどうやって行けばいいですか？','phrase','日常英会話',5,1422
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='How do I get to the station?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Is it far from here?','ここから遠いですか？','phrase','日常英会話',4,1423
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Is it far from here?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Turn left at the corner.','角を左に曲がってください。','phrase','日常英会話',4,1424
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Turn left at the corner.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Go straight for two blocks.','2ブロックまっすぐ行ってください。','phrase','日常英会話',4,1425
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Go straight for two blocks.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You can''t miss it.','すぐわかりますよ。','phrase','日常英会話',4,1426
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You can''t miss it.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m lost.','道に迷いました。','phrase','日常英会話',4,1427
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m lost.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Can you show me on the map?','地図で示してもらえますか？','phrase','日常英会話',4,1428
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Can you show me on the map?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','How long does it take?','どのくらいかかりますか？','phrase','日常英会話',5,1429
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='How long does it take?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Take the subway.','地下鉄で行ってください。','phrase','日常英会話',4,1430
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Take the subway.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I have an appointment.','予約があります。','phrase','日常英会話',4,1431
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I have an appointment.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''d like to cancel my appointment.','予約をキャンセルしたいです。','phrase','日常英会話',4,1432
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''d like to cancel my appointment.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Can I reschedule?','日程を変更できますか？','phrase','日常英会話',4,1433
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Can I reschedule?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What time is your availability?','ご都合はいつですか？','phrase','日常英会話',4,1434
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What time is your availability?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m running a fever.','熱があります。','phrase','日常英会話',4,1435
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m running a fever.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I have a sore throat.','喉が痛いです。','phrase','日常英会話',4,1436
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I have a sore throat.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I feel nauseous.','吐き気がします。','phrase','日常英会話',4,1437
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I feel nauseous.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I have a rash.','発疹があります。','phrase','日常英会話',3,1438
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I have a rash.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Take this medicine three times a day.','この薬を1日3回飲んでください。','phrase','日常英会話',4,1439
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Take this medicine three times a day.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','How are you feeling today?','今日の気分はどうですか？','phrase','日常英会話',4,1440
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='How are you feeling today?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Do you have insurance?','保険はお持ちですか？','phrase','日常英会話',4,1441
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Do you have insurance?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You need to rest.','休む必要があります。','phrase','日常英会話',4,1442
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You need to rest.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Stay hydrated.','水分補給を忘れずに。','phrase','日常英会話',4,1443
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Stay hydrated.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You''ll be fine.','大丈夫ですよ。','phrase','日常英会話',4,1444
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You''ll be fine.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Call me if you need anything.','何かあれば連絡してください。','phrase','日常英会話',4,1445
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Call me if you need anything.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Take care of yourself.','お体に気をつけて。','phrase','日常英会話',4,1446
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Take care of yourself.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Get well soon.','早く良くなってください。','phrase','日常英会話',4,1447
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Get well soon.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m feeling much better.','だいぶよくなりました。','phrase','日常英会話',4,1448
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m feeling much better.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Would you like to go out?','外出しませんか？','phrase','日常英会話',4,1449
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Would you like to go out?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What are you doing this weekend?','今週末は何か予定がありますか？','phrase','日常英会話',4,1450
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What are you doing this weekend?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''d love to, but I''m busy.','ぜひ行きたいのですが、忙しいです。','phrase','日常英会話',4,1451
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''d love to, but I''m busy.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Maybe next time.','次の機会に。','phrase','日常英会話',4,1452
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Maybe next time.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Rain check?','また今度に？','phrase','日常英会話',3,1453
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Rain check?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s on me.','私のおごりです。','phrase','日常英会話',4,1454
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s on me.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Let''s split it.','割り勘にしましょう。','phrase','日常英会話',4,1455
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Let''s split it.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ll pay for myself.','自分の分は自分で払います。','phrase','日常英会話',4,1456
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ll pay for myself.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s my turn to pay.','今度は私が払う番です。','phrase','日常英会話',3,1457
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s my turn to pay.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Cheers!','乾杯！','phrase','日常英会話',4,1458
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Cheers!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Here''s to you!','あなたに乾杯！','phrase','日常英会話',3,1459
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Here''s to you!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''d like to make a toast.','乾杯の音頭を取らせていただきます。','phrase','日常英会話',3,1460
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''d like to make a toast.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Help yourself.','ご自由にどうぞ。','phrase','日常英会話',4,1461
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Help yourself.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Would you like some more?','もう少しいかがですか？','phrase','日常英会話',4,1462
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Would you like some more?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ve had enough, thank you.','もう十分です、ありがとう。','phrase','日常英会話',4,1463
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ve had enough, thank you.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It was a great evening.','すばらしい夜でした。','phrase','日常英会話',3,1464
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It was a great evening.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Thanks for having me.','招いてくれてありがとう。','phrase','日常英会話',4,1465
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Thanks for having me.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Please give my regards.','よろしくお伝えください。','phrase','日常英会話',4,1466
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Please give my regards.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Say hi to your family.','ご家族によろしく。','phrase','日常英会話',4,1467
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Say hi to your family.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Have a safe trip.','道中気をつけて。','phrase','日常英会話',4,1468
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Have a safe trip.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Welcome back!','おかえりなさい！','phrase','日常英会話',4,1469
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Welcome back!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Did you have a good trip?','旅はいかがでしたか？','phrase','日常英会話',4,1470
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Did you have a good trip?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Missed you!','会いたかった！','phrase','日常英会話',4,1471
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Missed you!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You look great!','素敵に見えますよ！','phrase','日常英会話',4,1472
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You look great!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Love the outfit.','その服すてきですね。','phrase','日常英会話',3,1473
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Love the outfit.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Where did you get that?','どこで買ったのですか？','phrase','日常英会話',3,1474
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Where did you get that?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Is something wrong?','何かありましたか？','phrase','日常英会話',4,1475
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Is something wrong?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You seem upset.','何か悩んでいるようですね。','phrase','日常英会話',4,1476
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You seem upset.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m here for you.','あなたのそばにいます。','phrase','日常英会話',4,1477
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m here for you.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Let it out.','吐き出してください。','phrase','日常英会話',3,1478
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Let it out.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I understand how you feel.','あなたの気持ちはわかります。','phrase','日常英会話',4,1479
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I understand how you feel.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Look on the bright side.','いい方向で考えましょう。','phrase','日常英会話',4,1480
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Look on the bright side.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Count your blessings.','今あるものに感謝しましょう。','phrase','日常英会話',3,1481
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Count your blessings.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Time heals everything.','時間が解決してくれます。','phrase','日常英会話',3,1482
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Time heals everything.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Go for it!','やってみて！','phrase','日常英会話',4,1483
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Go for it!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You''ve got this!','あなたならできる！','phrase','日常英会話',4,1484
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You''ve got this!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I believe in you.','あなたを信じています。','phrase','日常英会話',4,1485
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I believe in you.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Break a leg!','頑張って！（劇場で使う）','phrase','日常英会話',3,1486
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Break a leg!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Knock them dead!','うまくやって！','phrase','日常英会話',3,1487
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Knock them dead!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Fingers crossed!','うまくいくといいね！','phrase','日常英会話',4,1488
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Fingers crossed!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Touch wood.','縁起でもないこと言わないで。','phrase','日常英会話',3,1489
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Touch wood.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What a coincidence!','なんという偶然！','phrase','日常英会話',4,1490
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What a coincidence!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Small world!','世間は狭いですね！','phrase','日常英会話',3,1491
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Small world!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Speak of the devil!','噂をすれば！','phrase','日常英会話',3,1492
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Speak of the devil!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s a small world.','世界は狭い。','phrase','日常英会話',3,1493
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s a small world.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That''s life.','これが人生です。','phrase','日常英会話',4,1494
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That''s life.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Such is life.','人生そんなものです。','phrase','日常英会話',3,1495
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Such is life.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It is what it is.','そういうものです。','phrase','日常英会話',4,1496
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It is what it is.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What will be will be.','なるようになるさ。','phrase','日常英会話',3,1497
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What will be will be.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Take it easy.','無理しないで。','phrase','日常英会話',4,1498
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Take it easy.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','One step at a time.','一歩一歩着実に。','phrase','日常英会話',4,1499
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='One step at a time.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You''re not alone.','あなたは一人じゃない。','phrase','日常英会話',4,1500
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You''re not alone.');
COMMIT;