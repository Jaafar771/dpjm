-- Planning centre: locations, preferences, messages, payroll and equipment.
-- All sensitive write operations remain restricted to administrators.

create table if not exists public.work_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  day_start time not null default '07:00',
  day_end time not null default '19:00',
  night_start time not null default '19:00',
  night_end time not null default '07:00',
  day_staff smallint not null default 2 check (day_staff between 0 and 20),
  night_staff smallint not null default 2 check (night_staff between 0 and 20),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.work_locations (name, code, day_staff, night_staff)
values
  ('Pav20', 'PAV20', 4, 2),
  ('Areal', 'AREAL', 2, 2)
on conflict (name) do update
set day_staff = excluded.day_staff,
    night_staff = excluded.night_staff,
    day_start = excluded.day_start,
    day_end = excluded.day_end,
    night_start = excluded.night_start,
    night_end = excluded.night_end,
    active = true,
    updated_at = now();

create table if not exists public.employee_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_locations text[] not null default '{}',
  preferred_shifts text[] not null default '{}',
  avoid_weekdays smallint[] not null default '{}',
  unavailable_dates date[] not null default '{}',
  max_monthly_hours smallint not null default 204 check (max_monthly_hours between 12 and 204),
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 140),
  body text not null check (char_length(body) between 1 and 5000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_no_self_message check (recipient_id is null or recipient_id <> sender_id)
);

create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  payroll_month date not null,
  document_path text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Allgemein',
  serial_number text,
  status text not null default 'ready' check (status in ('ready', 'attention', 'issue')),
  next_inspection_date date,
  assigned_to uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.schedules add column if not exists is_published boolean not null default false;

alter table public.employee_requests drop constraint if exists employee_requests_request_type_check;
alter table public.employee_requests add constraint employee_requests_request_type_check
  check (request_type in ('Erholungsurlaub', 'Zeitausgleich', 'Diensttausch', 'Sonderurlaub', 'Krankmeldung'));

alter table public.work_locations enable row level security;
alter table public.employee_preferences enable row level security;
alter table public.messages enable row level security;
alter table public.payslips enable row level security;
alter table public.equipment enable row level security;

create policy "All authenticated users can read active locations"
  on public.work_locations for select to authenticated using (active or public.current_user_is_admin());
create policy "Admins can manage locations"
  on public.work_locations for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "Employees can read their own preferences"
  on public.employee_preferences for select to authenticated
  using (user_id = auth.uid());
create policy "Employees can create their own preferences"
  on public.employee_preferences for insert to authenticated
  with check (user_id = auth.uid());
create policy "Employees can update their own preferences"
  on public.employee_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Admins can manage all preferences"
  on public.employee_preferences for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "Users can read received and sent messages"
  on public.messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid() or recipient_id is null or public.current_user_is_admin());
create policy "Users can send direct messages"
  on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and (recipient_id is not null or public.current_user_is_admin()));
create policy "Admins can manage messages"
  on public.messages for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "Employees can read their own payslips"
  on public.payslips for select to authenticated using (user_id = auth.uid());
create policy "Admins can manage payslips"
  on public.payslips for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "Employees can read their assigned equipment"
  on public.equipment for select to authenticated
  using (assigned_to = auth.uid());
create policy "Admins can manage equipment"
  on public.equipment for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "Admins can delete requests"
  on public.employee_requests for delete to authenticated
  using (public.current_user_is_admin());

create index if not exists messages_recipient_created_idx on public.messages (recipient_id, created_at desc);
create index if not exists messages_sender_created_idx on public.messages (sender_id, created_at desc);
create index if not exists payslips_user_month_idx on public.payslips (user_id, payroll_month desc);
create index if not exists equipment_assigned_to_idx on public.equipment (assigned_to);

-- Marking a message as read is deliberately a narrow RPC: recipients cannot edit its text.
create or replace function public.mark_message_read(p_message_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.messages
  set read_at = coalesce(read_at, now())
  where id = p_message_id and recipient_id = auth.uid();
end;
$$;

create or replace function public.notify_message_recipient()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.recipient_id is null then
    insert into public.notifications (user_id, kind, title, message, link)
    select id, 'message', new.subject, left(new.body, 240), '/nachrichten'
    from public.app_users
    where id <> new.sender_id;
  else
    insert into public.notifications (user_id, kind, title, message, link)
    values (new.recipient_id, 'message', new.subject, left(new.body, 240), '/nachrichten');
  end if;
  return new;
end;
$$;

drop trigger if exists on_message_created_notify_recipient on public.messages;
create trigger on_message_created_notify_recipient
  after insert on public.messages
  for each row execute procedure public.notify_message_recipient();

create or replace function public.notify_payslip_recipient()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, kind, title, message, link)
  values (new.user_id, 'payslip', 'Neuer Lohnzettel', new.title, '/gehalt');
  return new;
end;
$$;

drop trigger if exists on_payslip_created_notify_recipient on public.payslips;
create trigger on_payslip_created_notify_recipient
  after insert on public.payslips
  for each row execute procedure public.notify_payslip_recipient();

create or replace function public.notify_equipment_assignment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.assigned_to is not null and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    insert into public.notifications (user_id, kind, title, message, link)
    values (new.assigned_to, 'equipment', 'Ausrüstung zugeteilt', new.name || ' wurde dir zugeteilt.', '/ausruestung');
  end if;
  return new;
end;
$$;

drop trigger if exists on_equipment_assignment_notify_recipient on public.equipment;
create trigger on_equipment_assignment_notify_recipient
  after insert or update of assigned_to on public.equipment
  for each row execute procedure public.notify_equipment_assignment();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payslips', 'payslips', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "Users can read their own payslip documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payslips'
    and (public.current_user_is_admin() or name like auth.uid()::text || '/%')
  );
create policy "Admins can upload payslip documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'payslips' and public.current_user_is_admin());
create policy "Admins can update payslip documents"
  on storage.objects for update to authenticated
  using (bucket_id = 'payslips' and public.current_user_is_admin())
  with check (bucket_id = 'payslips' and public.current_user_is_admin());
create policy "Admins can delete payslip documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'payslips' and public.current_user_is_admin());

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.equipment;
exception when duplicate_object then null;
end $$;
