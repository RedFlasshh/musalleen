-- Phase 5: community features (leaderboard, groups, dedications).
--
-- Two real gaps found in the 0003 schema while wiring up the client:
-- group_invites had RLS enabled but zero policies (so it was silently
-- unreadable/unwritable by anyone, invites or not), and group_members'
-- insert policy let any authenticated user self-join ANY group by id --
-- including a 'private_invite' one -- since it only checked
-- user_id = auth.uid() with no group-visibility or invite condition.
-- Both are tightened here rather than papered over client-side, same
-- "RLS is the real boundary" discipline dedications already follows.

-- ---- leaderboard --------------------------------------------------
-- daily_totals has no cross-user select policy (by design -- it's someone's
-- own private counts table), so a global "who did the most today" view has
-- to go through a SECURITY DEFINER function. Anti-riya: only opted-in
-- profiles are eligible, the exact count is never returned (only a coarse
-- band), and ranking resets daily since it's scoped to one `day` -- not a
-- permanent hall of fame.
create or replace function get_leaderboard_today(p_day date)
returns table (alias text, band text, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.alias,
    case
      when dt.total >= 1000 then '1000+'
      when dt.total >= 500 then '500-999'
      when dt.total >= 250 then '250-499'
      when dt.total >= 100 then '100-249'
      when dt.total >= 50 then '50-99'
      else '1-49'
    end as band,
    (p.id = auth.uid()) as is_me
  from daily_totals dt
  join profiles p on p.id = dt.user_id
  where dt.day = p_day and p.visibility_opt_in = true and dt.total > 0
  order by dt.total desc
  limit 50;
$$;

revoke execute on function get_leaderboard_today(date) from public;
grant execute on function get_leaderboard_today(date) to authenticated;

-- ---- groups: atomic create (group row + owner membership row together) --
create or replace function create_group_with_owner(
  p_name text,
  p_description text,
  p_visibility text,
  p_show_exact_counts boolean,
  p_target_count bigint,
  p_target_format_id uuid,
  p_ends_at date
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  insert into groups (name, description, created_by, visibility, show_exact_counts, target_count, target_format_id, ends_at)
  values (
    p_name, p_description, auth.uid(),
    coalesce(p_visibility, 'private_invite'),
    coalesce(p_show_exact_counts, false),
    p_target_count, p_target_format_id, p_ends_at
  )
  returning id into v_group_id;

  insert into group_members (group_id, user_id, role) values (v_group_id, auth.uid(), 'owner');

  return v_group_id;
end;
$$;

grant execute on function create_group_with_owner(text, text, text, boolean, bigint, uuid, date) to authenticated;

-- ---- group_invites: was RLS-enabled with no policies at all -----------
create policy "owner invites members" on group_invites for insert
  with check (
    invited_by = auth.uid()
    and exists (select 1 from group_members gm where gm.group_id = group_invites.group_id and gm.user_id = auth.uid() and gm.role = 'owner')
  );

create policy "inviter or invitee can view" on group_invites for select
  using (invited_by = auth.uid() or invited_email = (auth.jwt() ->> 'email'));

-- ---- group_members: tighten self-join to public groups only -----------
-- Private-invite groups can now only be joined via accept_group_invite()
-- below, which checks the invite really was addressed to this email.
drop policy "self join or accept invite" on group_members;
create policy "self join public groups only" on group_members for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from groups g where g.id = group_members.group_id and g.visibility = 'public_joinable')
  );

create or replace function accept_group_invite(p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_email text;
begin
  v_email := auth.jwt() ->> 'email';

  select group_id into v_group_id
  from group_invites
  where id = p_invite_id and invited_email = v_email and status = 'pending';

  if v_group_id is null then
    raise exception 'accept_group_invite: invite not found or not addressed to you';
  end if;

  update group_invites set status = 'accepted' where id = p_invite_id;

  insert into group_members (group_id, user_id, role)
  values (v_group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return v_group_id;
end;
$$;

grant execute on function accept_group_invite(uuid) to authenticated;
