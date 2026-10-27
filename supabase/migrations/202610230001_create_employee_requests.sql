create table if not exists public.employee_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('Erholungsurlaub', 'Zeitausgleich', 'Diensttausch', 'Sonderurlaub')),
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_requests_valid_date_range check (end_date >= start_date)
);

alter table public.employee_requests enable row level security;

create policy "Employees can read their own requests"
  on public.employee_requests
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Employees can create their own requests"
  on public.employee_requests
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Employees can update their pending requests"
  on public.employee_requests
  for update
  to authenticated
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'pending');

create index if not exists employee_requests_user_created_at_idx
  on public.employee_requests (user_id, created_at desc);
