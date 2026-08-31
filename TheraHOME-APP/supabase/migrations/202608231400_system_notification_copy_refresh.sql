-- Refresh system-notification copy (morning/evening reminders + inactivity
-- win-back) with new content, and add 3 new inactivity tiers (4/10/14 days)
-- alongside the existing 2/3/5/7. See TheraHOME-APP/CLAUDE.md.

alter table public.system_notification_templates drop constraint if exists system_notification_templates_template_key_check;
alter table public.system_notification_templates add constraint system_notification_templates_template_key_check
  check (template_key in (
    'daily_workout', 'evening_reminder',
    'inactive_2', 'inactive_3', 'inactive_4', 'inactive_5', 'inactive_7', 'inactive_10', 'inactive_14'
  ));

insert into public.system_notification_templates (template_key, title, body)
values
  ('daily_workout', 'Đã đến giờ tập luyện', 'Hôm nay là ngày thứ {{day}} trong lộ trình của bạn. Bài tập hôm nay đã sẵn sàng — cùng tiếp tục nhé!'),
  ('evening_reminder', 'Đã đến giờ tập luyện', 'Buổi tối hôm nay chúng ta sẽ tập lại bài lúc sáng nhé!'),
  ('inactive_2', 'Bạn đã nghỉ 2 ngày rồi', 'Lộ trình của bạn vẫn đang chờ. Hôm nay chỉ cần vài phút để tiếp tục.'),
  ('inactive_3', 'Hôm nay mình quay lại nhé?', 'Chúng tôi đã giữ nguyên tiến độ và chuẩn bị phần tiếp theo dành cho bạn.'),
  ('inactive_4', 'Chỉ cần 3 phút hôm nay', 'Không cần bắt đầu lại từ đầu. Hãy tiếp tục từ chính nơi bạn đã dừng lại.'),
  ('inactive_5', 'Lộ trình của bạn đang tạm dừng', 'Bạn đã đi được một đoạn rồi. Cùng tiếp tục thêm một bước nhỏ hôm nay nhé.'),
  ('inactive_7', 'Một tuần rồi, cơ thể bạn hôm nay thế nào?', 'Check-in nhanh để chúng tôi điều chỉnh nội dung phù hợp với bạn hiện tại.'),
  ('inactive_10', 'Có thể cơ thể bạn đã thay đổi', 'Hãy cập nhật tình trạng hôm nay để nhận lại bài tập phù hợp với nhịp sống hiện tại của bạn.'),
  ('inactive_14', 'Lộ trình của bạn vẫn ở đây', 'Không cần bắt đầu lại. Khi bạn sẵn sàng, chúng tôi sẽ tiếp tục đồng hành từ bước gần nhất.')
on conflict (template_key) do update
  set title = excluded.title,
      body = excluded.body,
      updated_at = now();
