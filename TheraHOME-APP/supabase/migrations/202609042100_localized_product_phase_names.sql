-- Product/phase names for EN + MS used to live in a HARDCODED lookup table
-- (src/lib/adminContent.ts) keyed by the Vietnamese string. Renaming a phase
-- in WEB Admin silently broke that key, so EN/MS users suddenly saw the
-- Vietnamese name with no warning anywhere. Move the translations into the
-- rows themselves so admin owns them (per explicit request 2026-09-04).
-- Mobile keeps the old lookup as a last-resort fallback, then the VN name.
alter table public.products
  add column if not exists name_en text,
  add column if not exists name_ms text;

alter table public.program_phases
  add column if not exists name_en text,
  add column if not exists name_ms text;

-- Backfill exactly what the hardcoded table said, so nothing changes for
-- users at this point — only the source of truth moves.
update public.products set
  name_en = case id
    when 'neck-plus' then 'Neck support device · TheraNECK+'
    when 'neck-pro'  then 'Neck support device · TheraNECK PRO'
    when 'back-plus' then 'Back support device · TheraBACK+'
    when 'back-pro'  then 'Back support device · TheraBACK PRO'
  end,
  name_ms = case id
    when 'neck-plus' then 'Peranti sokongan leher · TheraNECK+'
    when 'neck-pro'  then 'Peranti sokongan leher · TheraNECK PRO'
    when 'back-plus' then 'Peranti sokongan belakang · TheraBACK+'
    when 'back-pro'  then 'Peranti sokongan belakang · TheraBACK PRO'
  end
where id in ('neck-plus', 'neck-pro', 'back-plus', 'back-pro')
  and (name_en is null or name_ms is null);

update public.program_phases set
  name_en = case name
    when 'Giai đoạn 1 · Giảm khó chịu & làm quen'   then 'Phase 1 · Reduce discomfort & adapt'
    when 'Giai đoạn 2 · Tăng cường vận động cổ'     then 'Phase 2 · Improve neck mobility'
    when 'Giai đoạn 2 · Tăng cường sức bền cột sống' then 'Phase 2 · Improve spinal endurance'
    when 'Giai đoạn 3 · Duy trì'                     then 'Phase 3 · Maintain progress'
    when 'Giai đoạn 3 · Mở rộng toàn diện'           then 'Phase 3 · Comprehensive expansion'
  end,
  name_ms = case name
    when 'Giai đoạn 1 · Giảm khó chịu & làm quen'   then 'Fasa 1 · Kurangkan ketidakselesaan & penyesuaian'
    when 'Giai đoạn 2 · Tăng cường vận động cổ'     then 'Fasa 2 · Tingkatkan pergerakan leher'
    when 'Giai đoạn 2 · Tăng cường sức bền cột sống' then 'Fasa 2 · Tingkatkan daya tahan tulang belakang'
    when 'Giai đoạn 3 · Duy trì'                     then 'Fasa 3 · Kekalkan kemajuan'
    when 'Giai đoạn 3 · Mở rộng toàn diện'           then 'Fasa 3 · Peluasan menyeluruh'
  end
where name_en is null or name_ms is null;
