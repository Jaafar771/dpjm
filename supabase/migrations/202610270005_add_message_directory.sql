-- A minimal directory for messaging. It deliberately exposes no addresses,
-- phone numbers or other personnel details.
create or replace function public.message_recipients()
returns table (id uuid, name text, role text)
language plpgsql
security definer set search_path = public
as $$
begin
  if public.current_user_is_admin() then
    return query
      select app_users.id, app_users.name, app_users.role
      from public.app_users
      where app_users.id <> auth.uid()
      order by app_users.role desc, app_users.name;
  end if;

  return query
    select app_users.id, app_users.name, app_users.role
    from public.app_users
    where app_users.role = 'admin'
    order by app_users.name;
end;
$$;

revoke all on function public.message_recipients() from public;
grant execute on function public.message_recipients() to authenticated;
