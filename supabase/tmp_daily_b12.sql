BEGIN;
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Long time no see!','お久しぶりです！','phrase','日常英会話',5,1201
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Long time no see!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','How have you been?','最近どうでしたか？','phrase','日常英会話',5,1202
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='How have you been?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ve been keeping busy.','忙しくしていました。','phrase','日常英会話',4,1203
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ve been keeping busy.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Not much, same old same old.','特に変わりなく、いつも通りです。','phrase','日常英会話',4,1204
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Not much, same old same old.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You look great!','素敵に見えます！','phrase','日常英会話',4,1205
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You look great!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What''s new with you?','最近どうですか？','phrase','日常英会話',4,1206
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What''s new with you?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That reminds me...','そういえば...','phrase','日常英会話',4,1207
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That reminds me...');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','By the way,...','ところで...','phrase','日常英会話',5,1208
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='By the way,...');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Anyway,...','とにかく...','phrase','日常英会話',5,1209
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Anyway,...');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Speaking of which,...','そういえば...','phrase','日常英会話',4,1210
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Speaking of which,...');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Believe it or not,...','信じられないかもしれませんが...','phrase','日常英会話',4,1211
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Believe it or not,...');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','To be honest,...','正直に言うと...','phrase','日常英会話',4,1212
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='To be honest,...');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','To be fair,...','公平に言えば...','phrase','日常英会話',4,1213
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='To be fair,...');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I guess so.','そうだと思います。','phrase','日常英会話',5,1214
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I guess so.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I suppose so.','そうでしょうね。','phrase','日常英会話',4,1215
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I suppose so.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I doubt it.','そうは思いません。','phrase','日常英会話',4,1216
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I doubt it.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You never know.','わかりませんよ。','phrase','日常英会話',4,1217
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You never know.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It depends.','場合によります。','phrase','日常英会話',5,1218
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It depends.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That''s up to you.','あなた次第です。','phrase','日常英会話',4,1219
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That''s up to you.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Whatever you say.','あなたの言う通りに。','phrase','日常英会話',4,1220
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Whatever you say.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s your call.','あなたが決めてください。','phrase','日常英会話',4,1221
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s your call.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Fair enough.','なるほど、了解です。','phrase','日常英会話',4,1222
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Fair enough.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Fair point.','おっしゃる通りです。','phrase','日常英会話',4,1223
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Fair point.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I stand corrected.','訂正を受け入れます。','phrase','日常英会話',3,1224
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I stand corrected.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','My bad.','私のせいです。','phrase','日常英会話',5,1225
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='My bad.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','No worries.','大丈夫ですよ。','phrase','日常英会話',5,1226
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='No worries.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','No problem at all.','全く問題ありません。','phrase','日常英会話',5,1227
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='No problem at all.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Don''t mention it.','いいえ、どういたしまして。','phrase','日常英会話',4,1228
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Don''t mention it.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s the least I could do.','これくらいは当然です。','phrase','日常英会話',4,1229
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s the least I could do.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I owe you one.','一つ借りができました。','phrase','日常英会話',4,1230
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I owe you one.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','We''re even.','貸し借りなしです。','phrase','日常英会話',4,1231
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='We''re even.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Let''s call it a day.','今日はここまでにしましょう。','phrase','日常英会話',4,1232
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Let''s call it a day.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Let''s wrap it up.','まとめましょう。','phrase','日常英会話',4,1233
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Let''s wrap it up.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ll get back to you.','後で連絡します。','phrase','日常英会話',5,1234
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ll get back to you.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Keep me posted.','随時連絡してください。','phrase','日常英会話',4,1235
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Keep me posted.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ll keep you in the loop.','情報を共有します。','phrase','日常英会話',4,1236
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ll keep you in the loop.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Catch you later.','また後で。','phrase','日常英会話',5,1237
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Catch you later.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Take it easy.','ゆっくりしてください。','phrase','日常英会話',5,1238
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Take it easy.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Hang in there!','頑張ってください！','phrase','日常英会話',5,1239
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Hang in there!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You can do it!','あなたならできます！','phrase','日常英会話',5,1240
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You can do it!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Good luck with that!','頑張ってください！','phrase','日常英会話',5,1241
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Good luck with that!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ll be rooting for you.','応援しています。','phrase','日常英会話',4,1242
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ll be rooting for you.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Fingers crossed!','うまくいくといいですね！','phrase','日常英会話',4,1243
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Fingers crossed!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Better safe than sorry.','念には念を。','phrase','日常英会話',4,1244
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Better safe than sorry.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That''s the spirit!','その意気です！','phrase','日常英会話',4,1245
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That''s the spirit!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Well done!','よくできました！','phrase','日常英会話',5,1246
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Well done!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Congratulations!','おめでとうございます！','phrase','日常英会話',5,1247
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Congratulations!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m so proud of you.','誇りに思います。','phrase','日常英会話',4,1248
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m so proud of you.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You deserve it.','あなたにふさわしいです。','phrase','日常英会話',4,1249
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You deserve it.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That''s impressive!','すごいですね！','phrase','日常英会話',4,1250
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That''s impressive!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I can''t believe it!','信じられません！','phrase','日常英会話',5,1251
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I can''t believe it!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','No way!','まさか！','phrase','日常英会話',5,1252
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='No way!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You''re joking!','冗談でしょう！','phrase','日常英会話',5,1253
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You''re joking!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Are you serious?','本気ですか？','phrase','日常英会話',5,1254
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Are you serious?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I had no idea.','全く知りませんでした。','phrase','日常英会話',4,1255
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I had no idea.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That''s news to me.','それは初耳です。','phrase','日常英会話',4,1256
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That''s news to me.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m at a loss for words.','言葉がありません。','phrase','日常英会話',3,1257
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m at a loss for words.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Let''s change the subject.','話題を変えましょう。','phrase','日常英会話',4,1258
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Let''s change the subject.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Can I ask you something?','一つ聞いてもいいですか？','phrase','日常英会話',5,1259
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Can I ask you something?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I have a quick question.','簡単な質問があります。','phrase','日常英会話',5,1260
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I have a quick question.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','If you don''t mind me asking,...','差し支えなければ...','phrase','日常英会話',4,1261
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='If you don''t mind me asking,...');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That''s a tough question.','難しい質問ですね。','phrase','日常英会話',4,1262
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That''s a tough question.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m not sure about that.','それについてはわかりません。','phrase','日常英会話',5,1263
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m not sure about that.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Let me think about it.','考えさせてください。','phrase','日常英会話',5,1264
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Let me think about it.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Off the top of my head,...','すぐ思いつくのは...','phrase','日常英会話',4,1265
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Off the top of my head,...');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','As far as I know,...','私が知る限り...','phrase','日常英会話',5,1266
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='As far as I know,...');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','To the best of my knowledge,...','私の知る限りでは...','phrase','日常英会話',4,1267
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='To the best of my knowledge,...');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I could be wrong, but...','間違っているかもしれませんが...','phrase','日常英会話',4,1268
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I could be wrong, but...');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Don''t quote me on this, but...','確かではないですが...','phrase','日常英会話',3,1269
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Don''t quote me on this, but...');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It slipped my mind.','うっかり忘れていました。','phrase','日常英会話',4,1270
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It slipped my mind.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s on the tip of my tongue.','喉まで出かかっています。','phrase','日常英会話',4,1271
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s on the tip of my tongue.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I drew a blank.','思い出せません。','phrase','日常英会話',3,1272
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I drew a blank.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Let me get this straight.','確認させてください。','phrase','日常英会話',4,1273
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Let me get this straight.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Just to clarify,...','明確にするために...','phrase','日常英会話',4,1274
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Just to clarify,...');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Am I making sense?','理解していただけましたか？','phrase','日常英会話',4,1275
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Am I making sense?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Does that make sense?','意味がわかりますか？','phrase','日常英会話',5,1276
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Does that make sense?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Are we on the same page?','同じ認識でよいですか？','phrase','日常英会話',4,1277
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Are we on the same page?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','We''re on the same page.','同じ認識です。','phrase','日常英会話',4,1278
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='We''re on the same page.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Let''s agree to disagree.','見解の相違ということで。','phrase','日常英会話',4,1279
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Let''s agree to disagree.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','We''ll have to agree to disagree.','意見が合わないようです。','phrase','日常英会話',3,1280
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='We''ll have to agree to disagree.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I see your point.','おっしゃりたいことはわかります。','phrase','日常英会話',4,1281
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I see your point.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I beg to differ.','失礼ですが、違うと思います。','phrase','日常英会話',3,1282
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I beg to differ.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','With all due respect,...','失礼ながら...','phrase','日常英会話',4,1283
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='With all due respect,...');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s not a big deal.','大したことではありません。','phrase','日常英会話',5,1284
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s not a big deal.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Don''t make a big deal out of it.','大げさにしないでください。','phrase','日常英会話',4,1285
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Don''t make a big deal out of it.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It is what it is.','仕方がない。','phrase','日常英会話',4,1286
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It is what it is.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Things happen.','そういうこともあります。','phrase','日常英会話',4,1287
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Things happen.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You win some, you lose some.','勝つこともあれば負けることもある。','phrase','日常英会話',3,1288
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You win some, you lose some.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Every cloud has a silver lining.','禍転じて福となす。','phrase','日常英会話',3,1289
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Every cloud has a silver lining.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Look on the bright side.','明るい面を見てください。','phrase','日常英会話',4,1290
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Look on the bright side.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','When life gives you lemons, make lemonade.','逆境を活かしましょう。','phrase','日常英会話',3,1291
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='When life gives you lemons, make lemonade.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Let sleeping dogs lie.','藪をつついて蛇を出すな。','phrase','日常英会話',3,1292
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Let sleeping dogs lie.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Don''t cry over spilt milk.','後悔してもしかたない。','phrase','日常英会話',3,1293
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Don''t cry over spilt milk.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Let''s cross that bridge when we come to it.','問題が起きたらその時考えましょう。','phrase','日常英会話',3,1294
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Let''s cross that bridge when we come to it.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What goes around comes around.','因果応報。','phrase','日常英会話',3,1295
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What goes around comes around.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Hit the nail on the head.','的を射る。','phrase','日常英会話',4,1296
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Hit the nail on the head.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That hit the spot.','まさに求めていたものでした。','phrase','日常英会話',4,1297
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That hit the spot.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m on it.','今やっています。','phrase','日常英会話',5,1298
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m on it.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Leave it to me.','任せてください。','phrase','日常英会話',5,1299
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Leave it to me.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Count me in!','私も参加します！','phrase','日常英会話',5,1300
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Count me in!');
COMMIT;