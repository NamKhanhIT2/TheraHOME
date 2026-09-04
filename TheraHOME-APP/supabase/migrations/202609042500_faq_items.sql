-- FAQ shown on Hồ sơ → Trợ giúp. It lived in the i18n bundle (keys
-- faq*Question/faq*Answer), so answering a newly recurring customer question
-- meant a code change plus a store release — the content CSKH edits most
-- often. Now admin-owned.
--
-- Seeded with exactly the 4 current entries in all 3 languages, so users see
-- no change. An empty/erroring table makes the app fall back to its bundled
-- i18n strings, so the Help screen can never render an empty FAQ list.
create table if not exists public.faq_items (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null default 0,
  active boolean not null default true,
  question_vi text not null,
  answer_vi text not null,
  question_en text,
  answer_en text,
  question_ms text,
  answer_ms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.faq_items enable row level security;

create policy "authenticated read faq_items" on public.faq_items
  for select to authenticated using (true);

create policy "web staff write faq_items" on public.faq_items
  for all to authenticated
  using ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()))
  with check ('admin' = any(public.current_web_roles()) or 'cskh' = any(public.current_web_roles()));

insert into public.faq_items (sort_order, question_vi, answer_vi, question_en, answer_en, question_ms, answer_ms)
select * from (values
  (1,
   'Làm sao để mở khóa ngày tiếp theo?',
   'Các ngày trong lộ trình tự mở khoá theo thời gian: mỗi ngày mở một ngày mới vào 0h. Xem video bài tập để ghi nhận hoàn thành ngày hôm đó.',
   'How do I unlock the next day?',
   'Days unlock on a schedule: a new day opens at midnight. Watch the exercise video to mark that day complete.',
   'Bagaimana untuk membuka hari seterusnya?',
   'Hari dibuka mengikut jadual: satu hari baharu dibuka pada tengah malam. Tonton video senaman untuk menandakan hari itu selesai.'),
  (2,
   'Tôi có thể đổi vùng tập không?',
   'Có, vào Chỉnh sửa hồ sơ để thay đổi vùng đang tập bất cứ lúc nào.',
   'Can I change my training area?',
   'Yes — open Edit profile to change your training area at any time.',
   'Bolehkah saya menukar kawasan latihan?',
   'Boleh — buka Edit profil untuk menukar kawasan latihan pada bila-bila masa.'),
  (3,
   'Ứng dụng có thay thế bác sĩ không?',
   'Không. TheraHOME hỗ trợ vận động, không thay thế chẩn đoán hay điều trị y khoa.',
   'Does the app replace a doctor?',
   'No. TheraHOME supports movement and exercise; it does not replace medical diagnosis or treatment.',
   'Adakah aplikasi ini menggantikan doktor?',
   'Tidak. TheraHOME menyokong pergerakan dan senaman; ia tidak menggantikan diagnosis atau rawatan perubatan.'),
  (4,
   'Thiết bị TheraHOME là gì?',
   'TheraNECK/TheraBACK là dụng cụ hỗ trợ thư giãn cơ và tập luyện tại nhà, không phải thiết bị y tế. Thiết bị không đo lường chỉ số sức khỏe và không kết nối dữ liệu với ứng dụng; ứng dụng cung cấp video hướng dẫn tập luyện đi kèm thiết bị.',
   'What is the TheraHOME device?',
   'TheraNECK/TheraBACK are home exercise and muscle-relaxation aids, not medical devices. They do not measure health metrics and do not send data to the app; the app provides the guided exercise videos that go with them.',
   'Apakah peranti TheraHOME?',
   'TheraNECK/TheraBACK ialah alat bantu senaman dan relaksasi otot di rumah, bukan peranti perubatan. Ia tidak mengukur data kesihatan dan tidak menghantar data ke aplikasi; aplikasi menyediakan video panduan senaman yang disertakan.')
) as seed(sort_order, question_vi, answer_vi, question_en, answer_en, question_ms, answer_ms)
where not exists (select 1 from public.faq_items);
