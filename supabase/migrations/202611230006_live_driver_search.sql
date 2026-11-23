-- Availability follows the driver's explicit online status. Background location timestamps
-- may lag on Android, so stale GPS alone must not hide an online shuttle.
create or replace function public.available_trips(p_seats integer default 1)
returns table (
  trip_id uuid,
  vehicle_id uuid,
  vehicle_name text,
  seats_total integer,
  seats_available integer,
  fare_per_seat numeric,
  solo_fare numeric,
  departs_at timestamptz,
  status public.trip_status
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_role() <> 'student' then
    raise exception 'Only signed-in students can search for shuttles' using errcode = '42501';
  end if;
  if p_seats is null or p_seats < 1 then
    raise exception 'Choose at least one seat' using errcode = '22023';
  end if;

  return query
  select t.id, v.id, v.name, v.seats_total,
    (v.seats_total - coalesce(used.seats_used, 0))::integer,
    v.fare_per_seat, v.solo_fare, t.departs_at, t.status
  from public.trips t
  join public.vehicles v on v.id = t.vehicle_id and v.enabled = true
  join public.driver_locations dl on dl.driver_id = v.driver_id
    -- Treat the driver's explicit online flag as the source of availability.
    -- Location timestamps can lag when Android suspends background updates;
    -- the driver app refreshes these while active and online.
    and dl.online = true
  left join lateral (
    select sum(b.seats)::integer as seats_used
    from public.bookings b
    where b.trip_id = t.id and b.status in ('pending', 'confirmed', 'picked_up')
  ) used on true
  where t.status in ('scheduled', 'active')
    and (t.departs_at is null or t.departs_at >= now())
    and v.seats_total - coalesce(used.seats_used, 0) >= p_seats
  order by t.departs_at nulls last, v.name;
end;
$$;
revoke all on function public.available_trips(integer) from public;
grant execute on function public.available_trips(integer) to authenticated;

