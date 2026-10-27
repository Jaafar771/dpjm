create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "Employees can read their own notifications"
  on public.notifications for select to authenticated
  using (auth.uid() = user_id);

create policy "Employees can mark their own notifications as read"
  on public.notifications for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.add_employee_notification(
  target_user_id uuid,
  notification_kind text,
  notification_title text,
  notification_message text,
  notification_link text default null,
  deduplicate_for interval default interval '5 minutes'
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if target_user_id is null then return; end if;

  if not exists (
    select 1 from public.notifications
    where user_id = target_user_id
      and kind = notification_kind
      and title = notification_title
      and created_at >= now() - deduplicate_for
  ) then
    insert into public.notifications (user_id, kind, title, message, link)
    values (target_user_id, notification_kind, notification_title, notification_message, notification_link);
  end if;
end;
$$;

create or replace function public.notify_schedule_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  employee_id uuid := coalesce(new.user_id, old.user_id);
begin
  perform public.add_employee_notification(
    employee_id,
    'schedule',
    'Dienstplan aktualisiert',
    'Dein Dienstplan wurde von der Verwaltung aktualisiert.',
    '/home'
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists schedule_change_notification on public.schedules;
create trigger schedule_change_notification
  after insert or update or delete on public.schedules
  for each row execute procedure public.notify_schedule_change();

create or replace function public.notify_request_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  status_label text;
begin
  if new.status is not distinct from old.status then return new; end if;

  status_label := case new.status
    when 'approved' then 'genehmigt'
    when 'rejected' then 'abgelehnt'
    else 'aktualisiert'
  end;

  perform public.add_employee_notification(
    new.user_id,
    'request',
    'Antrag ' || status_label,
    'Dein Antrag „' || new.request_type || '“ wurde ' || status_label || '.',
    '/antraege',
    interval '1 minute'
  );
  return new;
end;
$$;

drop trigger if exists request_status_notification on public.employee_requests;
create trigger request_status_notification
  after update of status on public.employee_requests
  for each row execute procedure public.notify_request_status_change();

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end;
$$;
