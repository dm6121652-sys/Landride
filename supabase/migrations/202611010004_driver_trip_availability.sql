-- Drivers need an active/scheduled trip in addition to sharing a live location
-- before students can request seats from their shuttle.
create or replace function public.driver_open_trip()
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_driver uuid := auth.uid();
  v_vehicle uuid;
  v_trip uuid;
begin
  if v_driver is null or public.current_role() <> 'driver' then
    raise exception 'Only signed-in drivers can open a shuttle trip' using errcode = '42501';
  end if;

  select id into v_vehicle
  from public.vehicles
  where driver_id = v_driver and enabled = true
  for update;
  if not found then
    raise exception 'Assign an enabled shuttle to this driver first' using errcode = 'P0001';
  end if;

  select id into v_trip
  from public.trips
  where vehicle_id = v_vehicle
    and status in ('scheduled', 'active')
    and (departs_at is null or departs_at >= now())
  order by case status when 'active' then 0 else 1 end, departs_at nulls last, created_at desc
  limit 1
  for update;
  if found then
    return v_trip;
  end if;

  insert into public.trips (vehicle_id, status, departs_at)
  values (v_vehicle, 'active', now())
  returning id into v_trip;
  return v_trip;
end;
$$;
revoke all on function public.driver_open_trip() from public;
grant execute on function public.driver_open_trip() to authenticated;

-- A shuttle only appears in student search while its driver's location is live.
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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trips'
  ) then
    alter publication supabase_realtime add table public.trips;
  end if;
end;
$$;
