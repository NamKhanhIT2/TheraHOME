-- The app's support-tools button was a fixed "Dụng cụ hỗ trợ tập luyện".
-- Admins want to name it per day (a mat, a resistance band, a foam roller…).
-- Per market, matching the URL columns and the market tabs in the editor, so
-- each region can label it in its own language; a blank one falls back to the
-- app's translated default.
alter table public.program_days
  add column if not exists support_tools_label_vn text,
  add column if not exists support_tools_label_us text,
  add column if not exists support_tools_label_malay text;
