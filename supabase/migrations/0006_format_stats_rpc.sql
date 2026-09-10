-- Per-format lifetime totals for the calling user (Duruds tab stats).
-- Not SECURITY DEFINER -- RLS on counts_daily already restricts rows to
-- auth.uid() = user_id, so this runs with the caller's own privileges.
create or replace function get_my_format_stats()
returns table (format_id uuid, total bigint)
language sql
stable
as $$
  select format_id, sum(count)::bigint as total
  from counts_daily
  where user_id = auth.uid()
  group by format_id;
$$;

grant execute on function get_my_format_stats() to authenticated;
