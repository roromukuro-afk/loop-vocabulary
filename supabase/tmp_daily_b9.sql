BEGIN;
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That''s music to my ears.','それはうれしい話ですね。','phrase','日常英会話',4,901
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That''s music to my ears.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m over the moon.','飛び上がるほど嬉しいです。','phrase','日常英会話',3,902
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m over the moon.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m head over heels.','首ったけです。夢中です。','phrase','日常英会話',3,903
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m head over heels.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Calm down.','落ち着いて。','phrase','日常英会話',5,904
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Calm down.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Don''t get upset.','落ち込まないで。','phrase','日常英会話',4,905
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Don''t get upset.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Take a deep breath.','深呼吸して。','phrase','日常英会話',4,906
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Take a deep breath.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m at a loss.','途方に暮れています。','phrase','日常英会話',3,907
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m at a loss.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I feel let down.','がっかりしています。','phrase','日常英会話',4,908
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I feel let down.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m disappointed.','がっかりしました。','phrase','日常英会話',5,909
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m disappointed.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That''s a relief.','ほっとしました。','phrase','日常英会話',5,910
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That''s a relief.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m relieved.','安心しました。','phrase','日常英会話',5,911
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m relieved.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I had butterflies.','緊張して胃がムカムカしました。','phrase','日常英会話',3,912
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I had butterflies.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m on edge.','ピリピリしています。','phrase','日常英会話',3,913
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m on edge.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I got cold feet.','怖じ気づきました。','phrase','日常英会話',3,914
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I got cold feet.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','My heart is racing.','胸がどきどきしています。','phrase','日常英会話',4,915
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='My heart is racing.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That blew my mind.','それには驚きました。','phrase','日常英会話',4,916
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That blew my mind.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m speechless.','言葉が出ません。','phrase','日常英会話',4,917
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m speechless.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m choked up.','感極まっています。','phrase','日常英会話',3,918
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m choked up.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m touched.','感動しています。','phrase','日常英会話',4,919
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m touched.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That means a lot.','それはとても重要なことです。','phrase','日常英会話',4,920
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That means a lot.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Long time no see!','久しぶりですね！','phrase','日常英会話',5,921
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Long time no see!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','You haven''t changed a bit!','全然変わっていませんね！','phrase','日常英会話',4,922
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='You haven''t changed a bit!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What have you been up to?','最近どうしていましたか？','phrase','日常英会話',5,923
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What have you been up to?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Same old, same old.','相変わらずです。','phrase','日常英会話',4,924
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Same old, same old.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Not much is going on.','特に何も変わりありません。','phrase','日常英会話',4,925
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Not much is going on.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Things are going well.','物事がうまくいっています。','phrase','日常英会話',4,926
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Things are going well.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ve been keeping busy.','忙しくしていました。','phrase','日常英会話',4,927
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ve been keeping busy.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ve got a lot going on.','いろいろなことがあって大変です。','phrase','日常英会話',4,928
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ve got a lot going on.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','How are things at work?','仕事の方はどうですか？','phrase','日常英会話',5,929
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='How are things at work?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Business is picking up.','仕事が忙しくなってきました。','phrase','日常英会話',4,930
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Business is picking up.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Business is slow right now.','今は仕事が落ち着いています。','phrase','日常英会話',4,931
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Business is slow right now.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I got a promotion.','昇進しました。','phrase','日常英会話',4,932
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I got a promotion.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I got laid off.','解雇されました。','phrase','日常英会話',4,933
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I got laid off.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m taking a gap year.','ギャップイヤーを取っています。','phrase','日常英会話',3,934
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m taking a gap year.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m studying for my degree.','学位のために勉強しています。','phrase','日常英会話',4,935
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m studying for my degree.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I graduated last year.','昨年卒業しました。','phrase','日常英会話',4,936
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I graduated last year.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m thinking of changing careers.','転職を考えています。','phrase','日常英会話',4,937
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m thinking of changing careers.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What are you passionate about?','どんなことに情熱を注いでいますか？','phrase','日常英会話',4,938
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What are you passionate about?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m into cooking lately.','最近料理にはまっています。','phrase','日常英会話',4,939
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m into cooking lately.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I just picked up painting.','最近絵を始めました。','phrase','日常英会話',3,940
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I just picked up painting.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I used to play guitar.','以前はギターを弾いていました。','phrase','日常英会話',4,941
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I used to play guitar.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m trying to get in shape.','体を鍛えようとしています。','phrase','日常英会話',4,942
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m trying to get in shape.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I hit the gym every day.','毎日ジムに行っています。','phrase','日常英会話',4,943
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I hit the gym every day.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m training for a marathon.','マラソンに向けてトレーニング中です。','phrase','日常英会話',3,944
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m training for a marathon.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m on a diet.','ダイエット中です。','phrase','日常英会話',5,945
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m on a diet.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m watching what I eat.','食事に気をつけています。','phrase','日常英会話',4,946
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m watching what I eat.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I try to eat healthy.','健康的に食べるようにしています。','phrase','日常英会話',4,947
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I try to eat healthy.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I skipped breakfast.','朝食を抜きました。','phrase','日常英会話',4,948
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I skipped breakfast.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What do you usually have for lunch?','昼食には普段何を食べますか？','phrase','日常英会話',4,949
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What do you usually have for lunch?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I tend to eat out a lot.','外食が多いです。','phrase','日常英会話',4,950
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I tend to eat out a lot.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I prefer home-cooked meals.','家で作る食事の方が好きです。','phrase','日常英会話',4,951
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I prefer home-cooked meals.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Do you have any dietary restrictions?','食事制限はありますか？','phrase','日常英会話',4,952
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Do you have any dietary restrictions?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m cutting back on sugar.','砂糖を控えています。','phrase','日常英会話',4,953
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m cutting back on sugar.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ve been craving ramen.','ラーメンが食べたくて仕方ない。','phrase','日常英会話',4,954
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ve been craving ramen.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','This hits the spot.','これはまさにぴったりです。','phrase','日常英会話',4,955
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='This hits the spot.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Let''s get dessert.','デザートを食べましょう。','phrase','日常英会話',4,956
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Let''s get dessert.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m going to pass on dessert.','デザートは遠慮しておきます。','phrase','日常英会話',4,957
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m going to pass on dessert.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','That was a great meal.','とても美味しい食事でした。','phrase','日常英会話',4,958
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='That was a great meal.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Who did the cooking?','誰が料理したのですか？','phrase','日常英会話',4,959
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Who did the cooking?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Could I get the recipe?','レシピを教えてもらえますか？','phrase','日常英会話',4,960
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Could I get the recipe?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','What''s the weather like today?','今日の天気はどうですか？','phrase','日常英会話',5,961
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='What''s the weather like today?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s going to rain later.','後で雨が降りそうです。','phrase','日常英会話',5,962
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s going to rain later.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Did you catch the forecast?','天気予報を見ましたか？','phrase','日常英会話',4,963
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Did you catch the forecast?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s scorching hot outside.','外は焼けるように暑いです。','phrase','日常英会話',4,964
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s scorching hot outside.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s freezing cold.','凍えるほど寒いです。','phrase','日常英会話',4,965
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s freezing cold.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','The weather is perfect.','気候が最高です。','phrase','日常英会話',4,966
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='The weather is perfect.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s a bit nippy today.','今日は少し肌寒いです。','phrase','日常英会話',3,967
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s a bit nippy today.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','We might get a storm.','嵐が来るかもしれません。','phrase','日常英会話',4,968
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='We might get a storm.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','There''s a chance of snow.','雪が降るかもしれません。','phrase','日常英会話',4,969
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='There''s a chance of snow.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Dress warmly today.','今日は暖かくして出かけてください。','phrase','日常英会話',4,970
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Dress warmly today.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Don''t forget your umbrella.','傘を忘れないでください。','phrase','日常英会話',5,971
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Don''t forget your umbrella.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','The cherry blossoms are out.','桜が咲いています。','phrase','日常英会話',4,972
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='The cherry blossoms are out.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','The leaves are turning.','葉が色づいてきました。','phrase','日常英会話',3,973
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='The leaves are turning.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It''s peak season.','ピークシーズンです。','phrase','日常英会話',4,974
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It''s peak season.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Where are you headed?','どこに行くところですか？','phrase','日常英会話',4,975
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Where are you headed?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''m heading to the office.','オフィスに向かっています。','phrase','日常英会話',5,976
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''m heading to the office.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Do you take this route often?','このルートをよく使いますか？','phrase','日常英会話',3,977
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Do you take this route often?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','The train was packed.','電車が満員でした。','phrase','日常英会話',5,978
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='The train was packed.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ll take the express.','急行に乗ります。','phrase','日常英会話',4,979
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ll take the express.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Which exit should I take?','どの出口を使えばいいですか？','phrase','日常英会話',5,980
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Which exit should I take?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Excuse me, is this the right platform?','すみません、このホームで合っていますか？','phrase','日常英会話',4,981
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Excuse me, is this the right platform?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','How much is a one-way ticket?','片道いくらですか？','phrase','日常英会話',5,982
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='How much is a one-way ticket?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Is there a night bus?','夜行バスはありますか？','phrase','日常英会話',4,983
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Is there a night bus?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Can I park here?','ここに駐車していいですか？','phrase','日常英会話',4,984
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Can I park here?');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Don''t miss the last train.','終電に乗り遅れないで。','phrase','日常英会話',5,985
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Don''t miss the last train.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ll see you around.','またどこかで会いましょう。','phrase','日常英会話',4,986
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ll see you around.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Take care of yourself.','体に気をつけてください。','phrase','日常英会話',5,987
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Take care of yourself.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Stay safe.','お気をつけて。','phrase','日常英会話',5,988
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Stay safe.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Drive safely.','安全に運転してください。','phrase','日常英会話',5,989
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Drive safely.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Have a safe trip.','道中お気をつけて。','phrase','日常英会話',5,990
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Have a safe trip.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Keep in touch.','連絡を取り合いましょう。','phrase','日常英会話',5,991
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Keep in touch.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Don''t be a stranger.','またいつでも来てください。','phrase','日常英会話',4,992
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Don''t be a stranger.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','I''ll miss you.','寂しくなります。','phrase','日常英会話',5,993
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='I''ll miss you.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','It was nice meeting you.','お会いできてよかったです。','phrase','日常英会話',5,994
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='It was nice meeting you.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Until next time.','また次の機会に。','phrase','日常英会話',5,995
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Until next time.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','All the best.','お元気で。幸運を。','phrase','日常英会話',5,996
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='All the best.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Wishing you all the best.','ご多幸をお祈りしています。','phrase','日常英会話',4,997
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Wishing you all the best.');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Best of luck!','頑張ってください！','phrase','日常英会話',5,998
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Best of luck!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Have a great one!','良い一日を！','phrase','日常英会話',5,999
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Have a great one!');
INSERT INTO material_words (material_id, word, meaning, pos, level, importance, display_order)
SELECT '00000000-0000-0000-0000-000000000036','Cheers!','乾杯！ありがとう！','phrase','日常英会話',5,1000
WHERE NOT EXISTS (SELECT 1 FROM material_words WHERE material_id='00000000-0000-0000-0000-000000000036' AND word='Cheers!');
COMMIT;