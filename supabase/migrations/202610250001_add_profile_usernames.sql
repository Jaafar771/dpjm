alter table public.app_users
  add column if not exists username text;

create unique index if not exists app_users_username_unique_idx
  on public.app_users (lower(username))
  where username is not null;

comment on column public.app_users.username is
  'Unique username used for password login. Use lowercase letters, numbers, dots, hyphens or underscores.';
