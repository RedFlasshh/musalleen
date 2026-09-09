-- Musalleen core schema: profiles, content reference tables, per-day counts.
-- Every change to the live Supabase project must start as a migration file
-- like this one — no hand-run changes in the SQL Editor. (Mustaghfirin's
-- checked-in schema.sql drifted out of sync with its live database because
-- some changes were only ever run by hand; this rule exists to prevent that
-- happening again here.)

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  alias text not null,                        -- "Traveler-482" style, generated, never a real name by default
  display_name text,                          -- optional, private to the user
  country text,
  timezone text not null default 'UTC',
  preferred_format_id uuid,                   -- fk added in 0001 after salawat_formats exists, see below
  daily_goal int not null default 100,
  reminder_enabled boolean not null default false,
  reminder_time time,
  friday_reminder_enabled boolean not null default true,
  friday_reminder_time time,
  last_reminded_day date,
  last_reminded_friday_day date,
  streak_current int not null default 0,
  streak_longest int not null default 0,
  last_active_day date,
  grace_available boolean not null default true,
  grace_refilled_month date,
  total_lifetime_count bigint not null default 0,
  highest_level_celebrated int not null default 0,
  visibility_opt_in boolean not null default false,   -- anti-riya: leaderboard is opt-IN, not opt-out
  created_at timestamptz not null default now()
);

create table salawat_formats (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  arabic_text text not null,
  transliteration text,
  translation text,
  source_note text,
  category text not null check (category in ('tashahhud', 'short', 'extended', 'collection')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles
  add constraint profiles_preferred_format_id_fkey
  foreign key (preferred_format_id) references salawat_formats(id);

create table virtues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  source text not null,
  category text not null,          -- 'quran' | 'hadith' | 'scholar' | 'reflection' | 'friday'
  is_friday_special boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table counts_daily (
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  format_id uuid not null references salawat_formats(id),
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day, format_id)
);

create table daily_totals (
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  total int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- RLS ---------------------------------------------------------------------

alter table profiles enable row level security;
create policy "own profile rw" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "opted-in profiles readable for leaderboard" on profiles
  for select using (visibility_opt_in = true or auth.uid() = id);

alter table salawat_formats enable row level security;
create policy "public read" on salawat_formats for select using (true);
-- deliberately no insert/update/delete policy for anon/authenticated —
-- content is written only via migrations/seed under the service_role key.

alter table virtues enable row level security;
create policy "public read" on virtues for select using (true);

alter table counts_daily enable row level security;
create policy "own counts rw" on counts_daily
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table daily_totals enable row level security;
create policy "own totals rw" on daily_totals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
