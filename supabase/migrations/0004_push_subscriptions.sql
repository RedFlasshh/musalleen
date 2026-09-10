-- Web Push subscriptions, one row per device a user has enabled reminders on
-- (a user can have several: phone, another phone, a desktop browser tab).
-- Written to by the client via RLS; read by the send-reminders edge function
-- using the service_role key, which bypasses RLS entirely.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
create policy "own subscriptions rw" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
