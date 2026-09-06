-- Nothing stopped the same person reporting the same post or comment over and
-- over, so one user could flood the customer-care queue with duplicates of a
-- single item. One report per reporter per item; the app turns the resulting
-- unique violation into "you already reported this".
-- Verified beforehand that no duplicate rows exist.
create unique index if not exists content_reports_unique_reporter_item
  on public.content_reports (reporter_id, content_type, content_id);
