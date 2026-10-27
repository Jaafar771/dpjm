-- The push endpoint receives only an opaque notification id. It looks up the
-- real, newly-created row with the service role and never trusts browser data.
create extension if not exists pg_net;

create or replace function public.dispatch_browser_push()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
begin
  perform net.http_post(
    url := 'https://olqlihdieaozyotdsipe.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('record', jsonb_build_object('id', new.id)),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists notification_browser_push on public.notifications;
create trigger notification_browser_push
  after insert on public.notifications
  for each row execute procedure public.dispatch_browser_push();
