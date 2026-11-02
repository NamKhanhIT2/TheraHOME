-- Four config rows, and all four are empty.
--
-- Neither store tells a customer an update exists. iOS has no such
-- notification at all, and both stores lean on the phone's own auto-update
-- setting — on by default, but it runs overnight on Wi-Fi while charging,
-- so a release reaches most people within a day or two and reaches the rest
-- never. Someone who switched auto-update off keeps the build they
-- installed in September for as long as they own the phone.
--
-- That is fine until the server moves. Edge functions, RPCs and this schema
-- go on changing; an old binary eventually calls something that is no
-- longer there, and the customer hits a failure nobody can reproduce. So
-- the app now asks on every launch whether it is still a version this
-- backend wants to talk to, and these rows are the answer.
--
--   *_min_version     below this, the app shows a wall with no way past it
--   *_latest_version  below this, a card with a "Để sau"
--
-- EMPTY MEANS OFF, and empty is how they ship. The app treats every
-- unknown — a blank row, a missing row, a string that is not a version — as
-- "no update needed" (src/lib/appUpdate.ts, tests in
-- tests/app-update.test.cjs). A version gate that fails closed would take
-- every customer's app away over a typo in a web form, and the person who
-- made the typo is the only one who could undo it.
--
-- Per platform because the two stores release on their own clock: Apple
-- approves in about a day, Play rolls a release out over several. One
-- shared threshold raised the moment Apple approves would block every
-- Android customer whose update has not been offered to them yet.
--
-- Editing lives in WEB Admin → "Nội dung ứng dụng". Nothing here needs a
-- store release to change, which is the entire point: the gate has to be
-- loosenable faster than it can be shipped.
insert into public.app_config (key, value_vi, value_en, value_ms) values
  ('ios_min_version', '', '', ''),
  ('ios_latest_version', '', '', ''),
  ('android_min_version', '', '', ''),
  ('android_latest_version', '', '', '')
on conflict (key) do nothing;
