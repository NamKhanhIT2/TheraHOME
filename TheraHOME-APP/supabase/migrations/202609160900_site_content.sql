-- Nội dung website — the marketing pages' editable content.
--
-- Until now every price, stat, FAQ answer and contact detail on /, /san-pham,
-- /ung-dung and /gioi-thieu was hard-coded TSX: changing "990.000₫" meant a
-- code change and a deploy. This table is the admin-editable source for the
-- parts that actually change.
--
-- Why not reuse `app_config`: its SELECT policy is `TO authenticated`, and the
-- marketing site is read by anonymous visitors. It is also the mobile app's
-- remote config — mixing website copy into it would blur which surface a row
-- belongs to. Values are jsonb because two of these are lists (the results
-- stats, the FAQ), not scalars.
--
-- Seeded with EXACTLY what the pages render today, so applying this migration
-- changes nothing visible; the web keeps the same strings as its fallback if
-- the table is ever unreachable.
create table if not exists public.site_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

-- Public read: this is marketing copy on pages that do not require a login.
drop policy if exists "anyone reads site_content" on public.site_content;
create policy "anyone reads site_content"
  on public.site_content for select
  to anon, authenticated
  using (true);

-- Admin write, same shape as app_config / legal_documents.
drop policy if exists "web admin writes site_content" on public.site_content;
create policy "web admin writes site_content"
  on public.site_content for all
  to authenticated
  using ('admin' = any (current_web_roles()))
  with check ('admin' = any (current_web_roles()));

insert into public.site_content (key, value) values
  ('pricing', jsonb_build_object(
     'current', '990.000₫',
     'original', '1.690.000₫',
     'note', 'Giảm 41% cho người mới',
     'ratingLine', '4.8/5 — 1.186 đánh giá'
   )),
  ('stats_hero', jsonb_build_array(
     jsonb_build_object('value', '+10.000', 'label', 'khách hàng Việt Nam'),
     jsonb_build_object('value', '4.8/5', 'label', '1.186 đánh giá'),
     jsonb_build_object('value', '14 ngày', 'label', 'lộ trình cá nhân hoá')
   )),
  ('stats_results', jsonb_build_array(
     jsonb_build_object('stat', '93%', 'body', 'Người dùng cho biết đã giảm đau cổ ngay từ buổi đầu tiên.'),
     jsonb_build_object('stat', '91%', 'body', 'Người dùng đã hoàn toàn hết đau cổ sau lộ trình 14 ngày do AI thiết lập, mỗi ngày chỉ 15–20 phút.'),
     jsonb_build_object('stat', '88%', 'body', 'Người dùng đã cải thiện được các triệu chứng đi kèm như tê tay, châm chích, đau đầu.'),
     jsonb_build_object('stat', '79%', 'body', 'Người dùng đã thoát khỏi vùng có nguy cơ phải phẫu thuật.')
   )),
  ('faq', jsonb_build_array(
     jsonb_build_object('q', 'Tôi không rành công nghệ, có dùng được không?', 'a', 'Có. TheraNECK + TheraAI dễ dùng, trực quan, có hướng dẫn bằng video và đội ngũ chăm sóc khách hàng đồng hành suốt lộ trình.'),
     jsonb_build_object('q', 'Tôi đau lâu năm rồi, có phù hợp không?', 'a', 'Nhiều người đau kéo dài không thiếu cố gắng, mà thiếu một lộ trình rõ ràng và đúng hơn với cơ thể mình.'),
     jsonb_build_object('q', 'Bao lâu thì tôi bắt đầu thấy khác đi?', 'a', 'Mỗi người sẽ khác nhau. Có người thấy dễ chịu hơn từ những ngày đầu, có người cần thêm thời gian.'),
     jsonb_build_object('q', 'Nếu không phù hợp thì sao?', 'a', 'Bạn có 14 ngày trải nghiệm để tự cảm nhận mức độ phù hợp. Nếu không hài lòng, bạn có thể yêu cầu hoàn trả.'),
     jsonb_build_object('q', 'Chống chỉ định với ai?', 'a', 'Chống chỉ định với người đặt máy tim nhân tạo. Người mới phẫu thuật cột sống cổ cần tham khảo ý kiến bác sĩ trước khi dùng.'),
     jsonb_build_object('q', 'TheraHome có bán ở Shopee hay TikTok không?', 'a', 'Chúng tôi tạm thời không kinh doanh ở TikTok và Shopee vì phí sàn 30% quá cao. Chúng tôi dành phần đó cho sản phẩm và dịch vụ chăm sóc.')
   )),
  ('contact', jsonb_build_object(
     'address', 'Tầng 11, toà RoxCenter, số 136 Hồ Tùng Mậu, Phú Diễn, Hà Nội',
     'phone', '0364.263.552',
     'phoneHref', 'tel:+84364263552',
     'email', 'support@therahomeai.com',
     'hours', 'Thứ Hai – Thứ Sáu, 9:00 – 17:00'
   )),
  ('social', jsonb_build_object(
     'facebook', 'https://www.facebook.com/profile.php?id=61580995314862',
     'youtube', 'https://www.youtube.com/@bacsilong1974'
   )),
  ('app_links', jsonb_build_object(
     'appStore', 'https://apps.apple.com/',
     'playStore', 'https://play.google.com/store/apps/details?id=ai.therahome'
   ))
on conflict (key) do nothing;
