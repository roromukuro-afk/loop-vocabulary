BEGIN;
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Are you free this weekend?','今週末は空いていますか？','phrase','日常英会話',4,1501
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Are you free this weekend?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Can I get a receipt?','領収書をいただけますか？','phrase','日常英会話',4,1502
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Can I get a receipt?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Can we split the bill?','割り勘にできますか？','phrase','日常英会話',4,1503
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Can we split the bill?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Could I speak to the manager?','マネージャーと話せますか？','phrase','日常英会話',4,1504
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Could I speak to the manager?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Do you accept credit cards?','クレジットカードは使えますか？','phrase','日常英会話',4,1505
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Do you accept credit cards?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Do you have this in a larger size?','大きいサイズはありますか？','phrase','日常英会話',4,1506
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Do you have this in a larger size?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Excuse me, can you help me?','すみません、手伝ってもらえますか？','phrase','日常英会話',4,1507
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Excuse me, can you help me?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Give me a moment','少し待ってください','phrase','日常英会話',4,1508
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Give me a moment');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','How about meeting at noon?','正午に会うのはどうですか？','phrase','日常英会話',4,1509
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='How about meeting at noon?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','How do you feel about that?','それについてどう思いますか？','phrase','日常英会話',4,1510
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='How do you feel about that?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','How long have you been here?','どのくらいここにいますか？','phrase','日常英会話',4,1511
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='How long have you been here?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I appreciate your help','ご協力に感謝します','phrase','日常英会話',4,1512
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I appreciate your help');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I can''t believe it!','信じられない！','phrase','日常英会話',4,1513
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I can''t believe it!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I could use your advice','アドバイスをいただきたいです','phrase','日常英会話',4,1514
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I could use your advice');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I didn''t catch that','聞き取れませんでした','phrase','日常英会話',4,1515
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I didn''t catch that');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I have a prior engagement','先約があります','phrase','日常英会話',4,1516
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I have a prior engagement');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I hope everything goes well','うまくいくことを願います','phrase','日常英会話',4,1517
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I hope everything goes well');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I left my wallet at home','財布を家に忘れました','phrase','日常英会話',4,1518
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I left my wallet at home');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I need to cancel','キャンセルが必要です','phrase','日常英会話',4,1519
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I need to cancel');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I think that''s a great idea','それは良いアイデアだと思います','phrase','日常英会話',4,1520
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I think that''s a great idea');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I was wondering if','〜ではないかと思っていました','phrase','日常英会話',4,1521
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I was wondering if');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ll be right with you','すぐに参ります','phrase','日常英会話',4,1522
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ll be right with you');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ll get back to you','後でご連絡します','phrase','日常英会話',4,1523
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ll get back to you');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ll leave it up to you','お任せします','phrase','日常英会話',4,1524
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ll leave it up to you');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ll take the bill','支払いは私がします','phrase','日常英会話',4,1525
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ll take the bill');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m calling about','〜についてお電話しています','phrase','日常英会話',4,1526
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m calling about');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m in a hurry','急いでいます','phrase','日常英会話',4,1527
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m in a hurry');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m just browsing','見ているだけです','phrase','日常英会話',4,1528
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m just browsing');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m looking for work','仕事を探しています','phrase','日常英会話',4,1529
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m looking for work');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m not feeling well today','今日は体調が良くありません','phrase','日常英会話',4,1530
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m not feeling well today');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m on a tight budget','予算が限られています','phrase','日常英会話',4,1531
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m on a tight budget');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m pleased to meet you','お会いできて嬉しいです','phrase','日常英会話',4,1532
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m pleased to meet you');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m sorry to bother you','お邪魔して申し訳ありません','phrase','日常英会話',4,1533
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m sorry to bother you');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m tied up right now','今は手が離せません','phrase','日常英会話',4,1534
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m tied up right now');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Is it okay if I join you?','一緒にいいですか？','phrase','日常英会話',4,1535
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Is it okay if I join you?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Is there a discount?','割引はありますか？','phrase','日常英会話',4,1536
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Is there a discount?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Is this seat taken?','この席は空いていますか？','phrase','日常英会話',4,1537
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Is this seat taken?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It depends on the situation','状況によります','phrase','日常英会話',4,1538
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It depends on the situation');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It makes sense','それは理にかなっています','phrase','日常英会話',4,1539
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It makes sense');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s a pleasure','光栄です','phrase','日常英会話',4,1540
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s a pleasure');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s been a long time','久しぶりですね','phrase','日常英会話',4,1541
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s been a long time');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s my treat','私のおごりです','phrase','日常英会話',4,1542
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s my treat');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s not a big deal','大したことではありません','phrase','日常英会話',4,1543
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s not a big deal');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s on the tip of my tongue','口先まで出かかっています','phrase','日常英会話',3,1544
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s on the tip of my tongue');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s quite chilly out there','外はかなり寒いですね','phrase','日常英会話',4,1545
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s quite chilly out there');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Just in case','念のために','adv','日常英会話',4,1546
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Just in case');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Keep me posted','知らせ続けてください','phrase','日常英会話',4,1547
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Keep me posted');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Let me double-check','確認させてください','phrase','日常英会話',4,1548
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Let me double-check');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Let''s catch a movie','映画を見に行きましょう','phrase','日常英会話',4,1549
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Let''s catch a movie');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Let''s get started','始めましょう','phrase','日常英会話',4,1550
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Let''s get started');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Long time no see','久しぶり','phrase','日常英会話',4,1551
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Long time no see');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','May I use the restroom?','お手洗いを使ってもいいですか？','phrase','日常英会話',4,1552
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='May I use the restroom?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','My apologies','申し訳ありません','phrase','日常英会話',4,1553
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='My apologies');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','No worries','心配しないで','phrase','日常英会話',4,1554
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='No worries');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Not yet, but soon','まだですが、もうすぐです','phrase','日常英会話',4,1555
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Not yet, but soon');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Of course, no problem','もちろん、問題ありません','phrase','日常英会話',4,1556
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Of course, no problem');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','On second thought','考え直してみると','phrase','日常英会話',4,1557
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='On second thought');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Please feel free to ask','気軽に聞いてください','phrase','日常英会話',4,1558
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Please feel free to ask');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Please take a seat','お座りください','phrase','日常英会話',4,1559
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Please take a seat');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Sounds like a plan','良い計画ですね','phrase','日常英会話',4,1560
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Sounds like a plan');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Speak of the devil','噂をすれば','phrase','日常英会話',3,1561
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Speak of the devil');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Take it easy','ゆっくりしてください','phrase','日常英会話',4,1562
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Take it easy');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That depends','場合によります','phrase','日常英会話',4,1563
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That depends');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That rings a bell','聞いたことがあります','phrase','日常英会話',3,1564
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That rings a bell');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That works for me','私には合っています','phrase','日常英会話',4,1565
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That works for me');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Thanks for the heads-up','事前に教えてくれてありがとう','phrase','日常英会話',4,1566
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Thanks for the heads-up');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That''s up to you','あなた次第です','phrase','日常英会話',4,1567
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That''s up to you');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','To be honest with you','正直に言うと','phrase','日常英会話',4,1568
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='To be honest with you');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What are your thoughts?','どう思いますか？','phrase','日常英会話',4,1569
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What are your thoughts?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What brings you here?','どうしてここに来たのですか？','phrase','日常英会話',4,1570
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What brings you here?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What do you do for fun?','趣味は何ですか？','phrase','日常英会話',4,1571
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What do you do for fun?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What seems to be the problem?','どのようなご用件ですか？','phrase','日常英会話',4,1572
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What seems to be the problem?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What''s the Wi-Fi password?','Wi-Fiのパスワードは何ですか？','phrase','日常英会話',4,1573
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What''s the Wi-Fi password?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Would you like more water?','お水のおかわりはいかがですか？','phrase','日常英会話',4,1574
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Would you like more water?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You can count on me','私に任せてください','phrase','日常英会話',4,1575
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You can count on me');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You made my day','あなたのおかげで元気になりました','phrase','日常英会話',3,1576
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You made my day');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You''re welcome to join us','ぜひ参加してください','phrase','日常英会話',4,1577
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You''re welcome to join us');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','As far as I know','私の知る限り','phrase','日常英会話',4,1578
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='As far as I know');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','At the end of the day','結局のところ','phrase','日常英会話',4,1579
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='At the end of the day');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Bear in mind','心に留めておいてください','phrase','日常英会話',4,1580
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Bear in mind');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Break the ice','打ち解けさせる','phrase','日常英会話',4,1581
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Break the ice');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Can you give me a hand?','手伝ってもらえますか？','phrase','日常英会話',4,1582
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Can you give me a hand?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Could I borrow that?','それを借りてもいいですか？','phrase','日常英会話',4,1583
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Could I borrow that?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Hang on a second','少し待ってください','phrase','日常英会話',4,1584
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Hang on a second');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I beg to differ','異論があります','phrase','日常英会話',3,1585
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I beg to differ');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m all ears','聞かせてください','phrase','日常英会話',4,1586
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m all ears');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m doing okay','まあまあです','phrase','日常英会話',4,1587
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m doing okay');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m on my way','今向かっています','phrase','日常英会話',4,1588
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m on my way');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It slipped my mind','うっかり忘れていました','phrase','日常英会話',4,1589
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It slipped my mind');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Leave it to me','私に任せて','phrase','日常英会話',4,1590
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Leave it to me');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Let me know if you need anything','何かあれば知らせてください','phrase','日常英会話',4,1591
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Let me know if you need anything');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Make yourself at home','くつろいでください','phrase','日常英会話',4,1592
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Make yourself at home');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','My pleasure','喜んで','phrase','日常英会話',4,1593
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='My pleasure');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Never mind','気にしないで','phrase','日常英会話',4,1594
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Never mind');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Right away','すぐに','phrase','日常英会話',4,1595
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Right away');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Same here','私も同じです','phrase','日常英会話',4,1596
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Same here');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That''s fair enough','それは公平です','phrase','日常英会話',4,1597
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That''s fair enough');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','The more the merrier','人数が多ければ多いほど楽しい','phrase','日常英会話',3,1598
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='The more the merrier');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What''s new with you?','最近どうですか？','phrase','日常英会話',4,1599
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What''s new with you?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You''ve got a point','おっしゃる通りです','phrase','日常英会話',4,1600
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You''ve got a point');
COMMIT;