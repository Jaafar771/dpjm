create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  role text not null default 'employee' check (role in ('employee', 'admin')),
  name text not null,
  personal_number varchar,
  phone varchar,
  street varchar,
  zip varchar,
  city varchar,
  meldezettel varchar,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists app_users_username_unique_idx
  on public.app_users (lower(username));

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  ort text,
  shift_time text,
  shift_type text,
  hours numeric not null default 0 check (hours >= 0),
  is_night boolean not null default false,
  vacation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists schedules_user_date_idx
  on public.schedules (user_id, date);

alter table public.app_users enable row level security;
alter table public.schedules enable row level security;

create policy "Employees can read their own profile"
  on public.app_users for select to authenticated
  using (auth.uid() = id);

create policy "Employees can update their own profile"
  on public.app_users for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Employees can read their own schedule"
  on public.schedules for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.create_app_user_for_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.app_users (id, username, role, name)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))),
    case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'employee' end,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_app_user_for_auth_user();
