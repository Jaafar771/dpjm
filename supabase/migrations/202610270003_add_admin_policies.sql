create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.app_users
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Profile data is maintained through Auth metadata.  Do not let a regular
-- employee update the role column on their own app_users row.
drop policy if exists "Employees can update their own profile" on public.app_users;

create policy "Admins can read all employee profiles"
  on public.app_users for select to authenticated
  using (public.current_user_is_admin());

create policy "Admins can manage schedules"
  on public.schedules for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create policy "Admins can read all requests"
  on public.employee_requests for select to authenticated
  using (public.current_user_is_admin());

create policy "Admins can update all requests"
  on public.employee_requests for update to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());
