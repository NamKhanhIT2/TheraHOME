-- Seeded with EXACTLY the wording bundled in TheraHOME-APP/src/lib/
-- mockData.ts today, so users see no change — this only moves ownership.
-- WEB Admin reads the structure (option count per question) from here, which
-- avoids duplicating the question list into the web repo.
insert into public.onboarding_question_texts (question_key, language, title, subtitle, options) values
-- Vietnamese
('goal_main','vi','Mục tiêu chính của bạn là gì?','Chọn mục tiêu phù hợp nhất để chúng tôi cá nhân hóa lộ trình cho bạn.',array['Ngủ ngon hơn','Làm việc đỡ mỏi hơn','Xây dựng thói quen chăm sóc cột sống','Tất cả – Lộ trình toàn diện']),
('priority_zone','vi','Khu vực bạn muốn ưu tiên?','Chọn 1 khu vực để cá nhân hoá bài tập phù hợp nhất cho bạn.',array['Cổ – vai – gáy','Lưng & tư thế','Toàn thân']),
('home_reason','vi','Điều gì khiến bạn chọn chăm sóc tại nhà?',null,array['Tiết kiệm thời gian và chi phí','Muốn có người hướng dẫn mỗi ngày','Muốn chủ động chăm sóc cơ thể tại nhà']),
('tension_level','vi','Cơ thể bạn thường cảm thấy thế nào?',null,array['Thoải mái, ít căng mỏi','Thỉnh thoảng căng mỏi','Thường xuyên căng mỏi','Khó chịu gần như mỗi ngày']),
('tension_timing','vi','Khi nào bạn thường cảm thấy căng mỏi nhất?',null,array['Sau khi ngủ dậy','Khi ngồi hoặc làm việc lâu','Vào cuối ngày','Cả ngày']),
('age_group','vi','Bạn thuộc nhóm tuổi nào?',null,array['Dưới 25','25–34','35–44','45–54','55+']),
('daily_activity','vi','Một ngày của bạn thường vận động như thế nào?','Chọn mức phù hợp nhất với thói quen và lối sống hiện tại của bạn.',array['Ngồi, cúi làm việc nhiều','Đứng hoặc đi lại nhiều','Lao động/vận động thể chất nhiều','Kết hợp cả ngồi và vận động']),
('daily_time','vi','Bạn có thể dành bao nhiêu thời gian mỗi ngày để chăm sóc cơ thể?','Thời gian phù hợp sẽ giúp bạn duy trì thói quen và đạt hiệu quả tốt nhất.',array['10 - 20 phút','20 - 30 phút','30 phút trở lên']),
-- English
('goal_main','en','What is your main goal?','Choose the goal that best fits you so we can personalize your roadmap.',array['Sleep better','Feel less tired at work','Build a spine-care habit','All of it – A complete roadmap']),
('priority_zone','en','Which area would you like to prioritize?','Choose one area so we can personalize the exercises that suit you best.',array['Neck – shoulders','Back & posture','Whole body']),
('home_reason','en','What made you choose home care?',null,array['Save time and money','Want daily guidance','Want to proactively care for my body at home']),
('tension_level','en','How does your body usually feel?',null,array['Comfortable, rarely tense','Occasionally tense','Frequently tense','Uncomfortable almost every day']),
('tension_timing','en','When do you feel the most tension?',null,array['After waking up','While sitting or working for long periods','At the end of the day','All day']),
('age_group','en','Which age group are you in?',null,array['Under 25','25–34','35–44','45–54','55+']),
('daily_activity','en','How active is your typical day?','Choose the level that best matches your current habits and lifestyle.',array['Mostly sitting or bending over for work','Mostly standing or walking','Physical labor / lots of movement','A mix of sitting and movement']),
('daily_time','en','How much time can you spend on body care each day?','A suitable amount of time helps you stay consistent and get better results.',array['10–20 minutes','20–30 minutes','30+ minutes']),
-- Malay
('goal_main','ms','Apakah matlamat utama anda?','Pilih matlamat yang paling sesuai supaya kami dapat memperibadikan pelan anda.',array['Tidur lebih lena','Kurang lenguh semasa bekerja','Membina tabiat menjaga tulang belakang','Semua – Pelan menyeluruh']),
('priority_zone','ms','Bahagian mana yang ingin anda utamakan?','Pilih satu bahagian supaya kami dapat memperibadikan senaman yang paling sesuai untuk anda.',array['Leher – bahu','Belakang & postur','Seluruh badan']),
('home_reason','ms','Apa yang mendorong anda memilih penjagaan di rumah?',null,array['Menjimatkan masa dan kos','Mahukan panduan setiap hari','Mahu menjaga tubuh secara proaktif di rumah']),
('tension_level','ms','Bagaimana keadaan tubuh anda biasanya?',null,array['Selesa, jarang lenguh','Kadangkala lenguh','Kerap lenguh','Tidak selesa hampir setiap hari']),
('tension_timing','ms','Bilakah anda paling berasa lenguh?',null,array['Selepas bangun tidur','Semasa duduk atau bekerja lama','Pada penghujung hari','Sepanjang hari']),
('age_group','ms','Anda tergolong dalam kumpulan umur yang mana?',null,array['Bawah 25','25–34','35–44','45–54','55+']),
('daily_activity','ms','Bagaimana pergerakan harian anda?','Pilih tahap yang paling sesuai dengan tabiat dan gaya hidup anda sekarang.',array['Duduk, membongkok bekerja banyak','Berdiri atau berjalan banyak','Kerja fizikal / pergerakan banyak','Gabungan duduk dan bergerak']),
('daily_time','ms','Berapa lama masa yang anda boleh luangkan setiap hari untuk menjaga tubuh?','Tempoh yang sesuai membantu anda kekal konsisten dan mendapat hasil terbaik.',array['10–20 minit','20–30 minit','30 minit ke atas'])
on conflict (question_key, language) do nothing;
