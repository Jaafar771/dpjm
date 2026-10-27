-- Weekday and weekend coverage may differ while the site continues 24/7.
alter table public.work_locations
  add column if not exists weekend_day_staff smallint;

update public.work_locations
set weekend_day_staff = day_staff
where weekend_day_staff is null;

alter table public.work_locations
  alter column weekend_day_staff set default 2,
  alter column weekend_day_staff set not null;

alter table public.work_locations
  drop constraint if exists work_locations_weekend_day_staff_check;
alter table public.work_locations
  add constraint work_locations_weekend_day_staff_check
  check (weekend_day_staff between 0 and 20);

update public.work_locations
set day_staff = 4,
    weekend_day_staff = 3,
    night_staff = 2,
    updated_at = now()
where code = 'PAV20';
