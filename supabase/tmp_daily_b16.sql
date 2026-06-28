BEGIN;
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','About time!','ようやくですね！','phrase','日常英会話',3,1601
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='About time!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','After you','お先にどうぞ','phrase','日常英会話',4,1602
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='After you');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','All the best','頑張ってください','phrase','日常英会話',4,1603
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='All the best');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Am I too late?','遅れてしまいましたか？','phrase','日常英会話',4,1604
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Am I too late?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Any luck?','うまくいきましたか？','phrase','日常英会話',3,1605
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Any luck?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Are you coming?','来ますか？','phrase','日常英会話',4,1606
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Are you coming?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Be my guest','どうぞご遠慮なく','phrase','日常英会話',3,1607
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Be my guest');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Both work for me','どちらでも大丈夫です','phrase','日常英会話',4,1608
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Both work for me');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','By any chance','もしかして','phrase','日常英会話',4,1609
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='By any chance');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Can I borrow your pen?','ペンを貸していただけますか？','phrase','日常英会話',4,1610
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Can I borrow your pen?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Can we reschedule?','予定を変更できますか？','phrase','日常英会話',4,1611
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Can we reschedule?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Can you bear with me?','しばらく待ってもらえますか？','phrase','日常英会話',4,1612
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Can you bear with me?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Care to join us?','一緒にどうですか？','phrase','日常英会話',4,1613
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Care to join us?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Catch you later','またあとで','phrase','日常英会話',4,1614
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Catch you later');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Come to think of it','考えてみると','phrase','日常英会話',3,1615
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Come to think of it');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Could you elaborate?','詳しく話してもらえますか？','phrase','日常英会話',4,1616
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Could you elaborate?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Cut to the chase','要点を話してください','phrase','日常英会話',3,1617
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Cut to the chase');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Does that make sense?','理解できますか？','phrase','日常英会話',4,1618
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Does that make sense?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Don''t mention it','礼には及びません','phrase','日常英会話',4,1619
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Don''t mention it');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Drop it','もう話さないで','phrase','日常英会話',4,1620
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Drop it');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Either way is fine','どちらでも構いません','phrase','日常英会話',4,1621
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Either way is fine');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Fancy seeing you here!','こんなところで会うとは！','phrase','日常英会話',3,1622
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Fancy seeing you here!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Feeling under the weather','体調が優れない','phrase','日常英会話',4,1623
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Feeling under the weather');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Forget it','いいですよ','phrase','日常英会話',4,1624
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Forget it');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Got a minute?','少し時間がありますか？','phrase','日常英会話',4,1625
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Got a minute?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Have a good trip','良い旅を','phrase','日常英会話',4,1626
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Have a good trip');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Have you eaten yet?','もう食べましたか？','phrase','日常英会話',4,1627
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Have you eaten yet?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','How come?','なぜですか？','phrase','日常英会話',4,1628
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='How come?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','How did it go?','どうでしたか？','phrase','日常英会話',4,1629
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='How did it go?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I am listening','聞いていますよ','phrase','日常英会話',4,1630
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I am listening');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I have mixed feelings','複雑な気持ちです','phrase','日常英会話',4,1631
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I have mixed feelings');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I know how you feel','お気持ちわかります','phrase','日常英会話',4,1632
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I know how you feel');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I missed your call','電話に出られませんでした','phrase','日常英会話',4,1633
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I missed your call');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I see what you mean','おっしゃっていること理解できます','phrase','日常英会話',4,1634
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I see what you mean');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I take your point','おっしゃる通りです','phrase','日常英会話',4,1635
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I take your point');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m afraid not','残念ながらそうではありません','phrase','日常英会話',4,1636
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m afraid not');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m flattered','光栄です','phrase','日常英会話',4,1637
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m flattered');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m in two minds','迷っています','phrase','日常英会話',4,1638
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m in two minds');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m open to suggestions','提案を受け付けています','phrase','日常英会話',4,1639
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m open to suggestions');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m stuck','行き詰まっています','phrase','日常英会話',4,1640
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m stuck');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m with you on that','その点については同意します','phrase','日常英会話',4,1641
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m with you on that');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','If you ask me','私に言わせれば','phrase','日常英会話',4,1642
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='If you ask me');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','In hindsight','振り返ってみると','phrase','日常英会話',4,1643
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='In hindsight');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','In that case','それならば','phrase','日常英会話',4,1644
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='In that case');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Is it convenient?','ご都合よいですか？','phrase','日常英会話',4,1645
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Is it convenient?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Just checking','確認しているだけです','phrase','日常英会話',4,1646
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Just checking');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Keep at it','頑張り続けてください','phrase','日常英会話',4,1647
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Keep at it');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Last but not least','最後になりましたが','phrase','日常英会話',4,1648
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Last but not least');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Let me sleep on it','考える時間をください','phrase','日常英会話',3,1649
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Let me sleep on it');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Likewise','同様に','phrase','日常英会話',4,1650
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Likewise');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Mind if I sit here?','ここに座っていいですか？','phrase','日常英会話',4,1651
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Mind if I sit here?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','More or less','まあそんなところです','phrase','日常英会話',4,1652
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='More or less');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Much appreciated','とても感謝します','phrase','日常英会話',4,1653
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Much appreciated');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','No rush','急がなくて大丈夫ですよ','phrase','日常英会話',4,1654
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='No rush');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Not at all','全然いいですよ','phrase','日常英会話',4,1655
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Not at all');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Now you''re talking','それなら話が違います','phrase','日常英会話',3,1656
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Now you''re talking');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Off the top of my head','とっさに思いつきですが','phrase','日常英会話',3,1657
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Off the top of my head');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Once bitten, twice shy','一度失敗したら慎重になる','phrase','日常英会話',3,1658
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Once bitten, twice shy');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Pardon me for asking','失礼ですが','phrase','日常英会話',4,1659
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Pardon me for asking');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Piece of cake','朝飯前です','phrase','日常英会話',4,1660
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Piece of cake');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Point taken','ご意見は理解しました','phrase','日常英会話',4,1661
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Point taken');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Pull yourself together','しっかりして','phrase','日常英会話',3,1662
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Pull yourself together');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','See you around','またどこかで','phrase','日常英会話',4,1663
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='See you around');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Settle down','落ち着いてください','phrase','日常英会話',4,1664
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Settle down');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Something came up','急に用事が入りました','phrase','日常英会話',4,1665
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Something came up');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Sorry to keep you waiting','お待たせしました','phrase','日常英会話',4,1666
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Sorry to keep you waiting');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Stay in touch','連絡を取り合いましょう','phrase','日常英会話',4,1667
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Stay in touch');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Step aside','脇にどいてください','phrase','日常英会話',4,1668
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Step aside');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Take care of yourself','お体に気をつけてください','phrase','日常英会話',4,1669
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Take care of yourself');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That being said','とはいえ','phrase','日常英会話',4,1670
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That being said');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That said','しかし','phrase','日常英会話',4,1671
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That said');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That sounds lovely','素敵ですね','phrase','日常英会話',4,1672
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That sounds lovely');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Think nothing of it','気にしないで','phrase','日常英会話',4,1673
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Think nothing of it');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','This is on me','私が払います','phrase','日常英会話',4,1674
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='This is on me');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','To tell the truth','実を言うと','phrase','日常英会話',4,1675
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='To tell the truth');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Touch base','連絡をとる','phrase','日常英会話',3,1676
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Touch base');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Totally','まったくそうです','phrase','日常英会話',4,1677
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Totally');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Way to go!','よくやった！','phrase','日常英会話',4,1678
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Way to go!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What a coincidence','なんと偶然','phrase','日常英会話',4,1679
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What a coincidence');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What a relief','ほっとしました','phrase','日常英会話',4,1680
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What a relief');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What are you up to?','何をしているんですか？','phrase','日常英会話',4,1681
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What are you up to?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What do you say?','どうですか？','phrase','日常英会話',4,1682
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What do you say?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What were you thinking?','一体何を考えていたんですか？','phrase','日常英会話',3,1683
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What were you thinking?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','When it comes to','〜に関しては','phrase','日常英会話',4,1684
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='When it comes to');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','With pleasure','喜んで','phrase','日常英会話',4,1685
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='With pleasure');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Wonder if you could help','助けていただけますでしょうか','phrase','日常英会話',4,1686
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Wonder if you could help');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Worth a try','試してみる価値はある','phrase','日常英会話',4,1687
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Worth a try');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You can say that again','全くそのとおりです','phrase','日常英会話',4,1688
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You can say that again');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You deserve it','当然です','phrase','日常英会話',4,1689
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You deserve it');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You know what I mean','わかりますよね','phrase','日常英会話',4,1690
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You know what I mean');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You''re kidding','冗談でしょう','phrase','日常英会話',4,1691
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You''re kidding');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You''re too kind','ご親切に','phrase','日常英会話',4,1692
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You''re too kind');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Your call','あなたが決めてください','phrase','日常英会話',4,1693
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Your call');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Zero in on','〜に集中する','phrase','日常英会話',3,1694
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Zero in on');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Allow me to introduce','ご紹介します','phrase','日常英会話',4,1695
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Allow me to introduce');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','At your earliest convenience','ご都合のよいときに','phrase','日常英会話',4,1696
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='At your earliest convenience');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','By the same token','同様に','phrase','日常英会話',3,1697
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='By the same token');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Clear as day','明白です','phrase','日常英会話',3,1698
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Clear as day');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Don''t hold back','遠慮しないでください','phrase','日常英会話',4,1699
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Don''t hold back');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Feel free to call anytime','いつでも気軽に電話してください','phrase','日常英会話',4,1700
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Feel free to call anytime');
COMMIT;