-- Community features: private dedications, group challenges. Anti-riya
-- defaults are enforced here at the RLS layer, not left to the client to
-- respect — see the comments below on dedications in particular.

create table dedications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  recipient_type text not null check (recipient_type in ('self_intention', 'living_person', 'deceased', 'ummah', 'other')),
  recipient_label text,
  format_id uuid references salawat_formats(id),
  day date not null,
  count int not null,
  note text,
  created_at timestamptz not null default now()
);

alter table dedications enable row level security;
create policy "owner only" on dedications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Deliberately no select policy grants access to any other auth.uid(). This
-- is what makes dedications private-by-default: there is no code path by
-- which another user's client could read one, because the policy allowing
-- it doesn't exist — not because the UI merely chooses not to show it.

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references profiles(id),
  visibility text not null default 'private_invite' check (visibility in ('private_invite', 'public_joinable')),
  show_exact_counts boolean not null default false,   -- anti-riya default even inside a consented circle
  target_count bigint,
  target_format_id uuid references salawat_formats(id),
  starts_at date not null default current_date,
  ends_at date,
  created_at timestamptz not null default now()
);

create table group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  alias_in_group text,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  invited_by uuid not null references profiles(id),
  invited_email text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);

alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_invites enable row level security;

create policy "members see their groups" on groups for select
  using (
    visibility = 'public_joinable'
    or exists (select 1 from group_members gm where gm.group_id = groups.id and gm.user_id = auth.uid())
  );
create policy "owner updates" on groups for update using (created_by = auth.uid());
create policy "any authed user creates" on groups for insert with check (created_by = auth.uid());

create policy "members see membership" on group_members for select
  using (exists (
    select 1 from group_members gm2 where gm2.group_id = group_members.group_id and gm2.user_id = auth.uid()
  ));
create policy "self join or accept invite" on group_members for insert with check (user_id = auth.uid());

-- Group progress is intentionally NOT a separate ledger table — it's a
-- read-time aggregate over the existing counts_daily rows for the group's
-- members within its date range. A second write path for the same counts
-- would reintroduce exactly the class of duplicate-source-of-truth bug that
-- caused double-counting in Mustaghfirin's offline queue.
create or replace function get_group_progress(p_group_id uuid)
returns table (total bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from group_members where group_id = p_group_id and user_id = auth.uid()
  ) then
    raise exception 'get_group_progress: not a member of this group';
  end if;

  return query
  select coalesce(sum(cd.count), 0)::bigint
  from counts_daily cd
  join group_members gm on gm.user_id = cd.user_id and gm.group_id = p_group_id
  join groups g on g.id = p_group_id
  where cd.day >= g.starts_at
    and (g.ends_at is null or cd.day <= g.ends_at)
    and (g.target_format_id is null or cd.format_id = g.target_format_id);
end;
$$;

revoke execute on function get_group_progress(uuid) from public;
grant execute on function get_group_progress(uuid) to authenticated;
