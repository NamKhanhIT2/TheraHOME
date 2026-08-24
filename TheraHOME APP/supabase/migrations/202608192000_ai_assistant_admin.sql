-- Backs the WEB "AI Prompts" admin screen with real tables, and lets
-- chat-ai-reply read its system prompt from the DB instead of a hardcoded
-- constant. Also backs the AI chat's suggestion chips (previously a
-- hardcoded 3-string array in app/chat/ai.tsx) so admins can curate them.

-- Singleton row holding the live system prompt for chat-ai-reply. The
-- boolean-PK-with-check trick keeps this to exactly one row without a
-- separate uniqueness index.
create table if not exists public.ai_prompts (
  id boolean primary key default true,
  system_prompt text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint ai_prompts_singleton check (id)
);

insert into public.ai_prompts (id, system_prompt)
values (
  true,
  'Bạn là Trợ lý AI của TheraHOME, một ứng dụng đồng hành cho các thiết bị hỗ trợ phục hồi chức năng TheraNECK/TheraBACK (lộ trình tập luyện 28 ngày, video hướng dẫn mỗi ngày, theo dõi mức đau 0-10, uống nước).

Vai trò của bạn:
- Trả lời ngắn gọn, thân thiện, bằng tiếng Việt, tập trung vào lộ trình tập luyện, cách dùng thiết bị, và động viên tinh thần người dùng.
- KHÔNG chẩn đoán bệnh lý, KHÔNG kê đơn hay thay thế tư vấn y tế chuyên môn. Nếu người dùng mô tả triệu chứng nghiêm trọng, đau tăng dần, hoặc dấu hiệu bất thường, hãy khuyên họ nhấn "Chat với Chuyên gia TheraHOME" để được hỗ trợ trực tiếp, hoặc gặp bác sĩ nếu cần thiết.
- Nếu được hỏi những chủ đề không liên quan đến phục hồi chức năng hoặc sản phẩm TheraHOME, hãy lịch sự từ chối và đưa cuộc trò chuyện quay lại chủ đề chính.
- Giữ câu trả lời dưới 4-5 câu trừ khi người dùng yêu cầu chi tiết hơn.'
)
on conflict (id) do nothing;

alter table public.ai_prompts enable row level security;

create policy "web staff read ai prompt" on public.ai_prompts
  for select
  using ('admin' = any(current_web_roles()) or 'cskh' = any(current_web_roles()));

create policy "web staff update ai prompt" on public.ai_prompts
  for update
  using ('admin' = any(current_web_roles()) or 'cskh' = any(current_web_roles()))
  with check ('admin' = any(current_web_roles()) or 'cskh' = any(current_web_roles()));

revoke all on table public.ai_prompts from anon, authenticated;
grant select, update on table public.ai_prompts to authenticated;

-- Suggestion chips shown in the empty AI chat state on mobile — was a
-- hardcoded 3-string array, now admin-curated.
create table if not exists public.ai_suggested_replies (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 200),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.ai_suggested_replies enable row level security;

create policy "authenticated read active suggested replies" on public.ai_suggested_replies
  for select
  using (active or 'admin' = any(current_web_roles()) or 'cskh' = any(current_web_roles()));

create policy "web staff insert suggested replies" on public.ai_suggested_replies
  for insert
  with check ('admin' = any(current_web_roles()) or 'cskh' = any(current_web_roles()));

create policy "web staff update suggested replies" on public.ai_suggested_replies
  for update
  using ('admin' = any(current_web_roles()) or 'cskh' = any(current_web_roles()))
  with check ('admin' = any(current_web_roles()) or 'cskh' = any(current_web_roles()));

create policy "web staff delete suggested replies" on public.ai_suggested_replies
  for delete
  using ('admin' = any(current_web_roles()) or 'cskh' = any(current_web_roles()));

revoke all on table public.ai_suggested_replies from anon, authenticated;
grant select on table public.ai_suggested_replies to authenticated;
grant insert, update, delete on table public.ai_suggested_replies to authenticated;

insert into public.ai_suggested_replies (text, sort_order) values
  ('Tôi bị đau khi tập', 0),
  ('Đổi lịch nhắc tập', 1),
  ('Lộ trình của tôi thế nào?', 2);
