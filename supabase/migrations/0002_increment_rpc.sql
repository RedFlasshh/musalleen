-- The single write path for counting salawat. One SECURITY DEFINER function
-- does the counts_daily upsert, the daily_totals rollup, and the streak/
-- grace computation in one transaction, so a partial client failure can
-- never leave counts_daily and daily_totals out of sync with each other.
-- The client's offline-queue re-entrancy guard (see hooks/useOfflineCountQueue)
-- is what prevents this function from ever being double-invoked for the same
-- delta — this function itself does not attempt to detect duplicate calls.

create or replace function increment_salawat_count(
  p_format_id uuid,
  p_day date,
  p_delta int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_new_total int;
  v_profile profiles%rowtype;
  v_gap int;
begin
  if v_user_id is null then
    raise exception 'increment_salawat_count: no authenticated user';
  end if;

  -- 1) per-format delta
  insert into counts_daily (user_id, day, format_id, count)
  values (v_user_id, p_day, p_format_id, greatest(p_delta, 0))
  on conflict (user_id, day, format_id)
    do update set count = greatest(counts_daily.count + p_delta, 0),
                  updated_at = now();

  -- 2) same-day rollup across all formats
  select coalesce(sum(count), 0) into v_new_total
  from counts_daily
  where user_id = v_user_id and day = p_day;

  insert into daily_totals (user_id, day, total)
  values (v_user_id, p_day, v_new_total)
  on conflict (user_id, day)
    do update set total = v_new_total, updated_at = now();

  -- 3) streak/grace + lifetime total, only recomputed off *today's* delta —
  --    a backfill/correction to a past day intentionally does not replay
  --    streak history.
  select * into v_profile from profiles where id = v_user_id for update;

  if p_day = current_date then
    if v_profile.last_active_day is null or v_profile.last_active_day <> current_date then
      v_gap := case when v_profile.last_active_day is null then null
                     else current_date - v_profile.last_active_day end;

      if v_gap is null then
        v_profile.streak_current := 1;
      elsif v_gap = 1 then
        v_profile.streak_current := v_profile.streak_current + 1;
      elsif v_gap = 2 and v_profile.grace_available then
        v_profile.grace_available := false;
        v_profile.streak_current := v_profile.streak_current + 1;
      else
        v_profile.streak_current := 1;
      end if;

      v_profile.streak_longest := greatest(v_profile.streak_longest, v_profile.streak_current);
      v_profile.last_active_day := current_date;
    end if;

    -- monthly grace refill, calendar-component comparison (not elapsed-time)
    if v_profile.grace_refilled_month is null
       or date_trunc('month', current_date) > date_trunc('month', v_profile.grace_refilled_month) then
      v_profile.grace_available := true;
      v_profile.grace_refilled_month := date_trunc('month', current_date);
    end if;
  end if;

  v_profile.total_lifetime_count := v_profile.total_lifetime_count + p_delta;

  update profiles set
    streak_current = v_profile.streak_current,
    streak_longest = v_profile.streak_longest,
    last_active_day = v_profile.last_active_day,
    grace_available = v_profile.grace_available,
    grace_refilled_month = v_profile.grace_refilled_month,
    total_lifetime_count = v_profile.total_lifetime_count
  where id = v_user_id;
end;
$$;

revoke execute on function increment_salawat_count(uuid, date, int) from public;
grant execute on function increment_salawat_count(uuid, date, int) to authenticated;
