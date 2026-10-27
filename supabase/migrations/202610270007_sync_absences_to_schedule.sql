-- Approved leave and sickness must be visible in the same calendar as shifts.
alter table public.schedules
  add column if not exists absence_request_id uuid references public.employee_requests(id) on delete cascade;

create index if not exists schedules_absence_request_idx
  on public.schedules (absence_request_id)
  where absence_request_id is not null;

create or replace function public.sync_approved_absence_to_schedule()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.schedules where absence_request_id = old.id;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    delete from public.schedules where absence_request_id = new.id;
  end if;

  if new.status = 'approved'
     and new.request_type in ('Erholungsurlaub', 'Sonderurlaub', 'Krankmeldung') then
    delete from public.schedules
    where user_id = new.user_id
      and date between new.start_date and new.end_date;

    insert into public.schedules (
      user_id, date, ort, shift_time, shift_type, hours,
      is_night, vacation, is_published, absence_request_id
    )
    select
      new.user_id,
      calendar_day::date,
      case when new.request_type = 'Krankmeldung' then 'Krank' else 'Urlaub' end,
      null,
      case when new.request_type = 'Krankmeldung' then 'KRANK' else 'URLAUB' end,
      0,
      false,
      true,
      new.id
    from generate_series(new.start_date, new.end_date, interval '1 day') as calendar_day;
  end if;

  return new;
end;
$$;

drop trigger if exists on_employee_request_sync_schedule on public.employee_requests;
create trigger on_employee_request_sync_schedule
  after insert or update or delete on public.employee_requests
  for each row execute procedure public.sync_approved_absence_to_schedule();

-- Also materialize leave that was approved before this migration was added.
insert into public.schedules (
  user_id, date, ort, shift_time, shift_type, hours,
  is_night, vacation, is_published, absence_request_id
)
select
  request_row.user_id,
  calendar_day::date,
  case when request_row.request_type = 'Krankmeldung' then 'Krank' else 'Urlaub' end,
  null,
  case when request_row.request_type = 'Krankmeldung' then 'KRANK' else 'URLAUB' end,
  0,
  false,
  true,
  request_row.id
from public.employee_requests as request_row
cross join lateral generate_series(request_row.start_date, request_row.end_date, interval '1 day') as calendar_day
where request_row.status = 'approved'
  and request_row.request_type in ('Erholungsurlaub', 'Sonderurlaub', 'Krankmeldung')
on conflict (user_id, date) do update
set ort = excluded.ort,
    shift_time = excluded.shift_time,
    shift_type = excluded.shift_type,
    hours = excluded.hours,
    is_night = excluded.is_night,
    vacation = true,
    is_published = true,
    absence_request_id = excluded.absence_request_id,
    updated_at = now();
