-- Give assigned drivers a secure ride queue and controlled status transitions.
create function public.driver_rides()
returns table (
  booking_id uuid,
  booking_status public.booking_status,
  seats integer,
  sharing_ok boolean,
  requested_at timestamptz,
  trip_id uuid,
  trip_status public.trip_status,
  departs_at timestamptz,
  vehicle_name text,
  pickup_name text,
  dropoff_name text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_role() <> 'driver' then
    raise exception 'Only signed-in drivers can view assigned rides' using errcode = '42501';
  end if;

  return query
  select b.id, b.status, b.seats, b.sharing_ok, b.created_at,
    t.id, t.status, t.departs_at, v.name, pickup.name, dropoff.name
  from public.bookings b
  join public.trips t on t.id = b.trip_id
  join public.vehicles v on v.id = t.vehicle_id and v.driver_id = auth.uid()
  join public.stops pickup on pickup.id = b.pickup_stop
  join public.stops dropoff on dropoff.id = b.dropoff_stop
  order by case b.status when 'pending' then 0 when 'confirmed' then 1 when 'picked_up' then 2 else 3 end,
    t.departs_at nulls last, b.created_at desc;
end;
$$;
revoke all on function public.driver_rides() from public;
grant execute on function public.driver_rides() to authenticated;

create function public.driver_update_booking(
  p_booking_id uuid,
  p_next_status public.booking_status
) returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_driver uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_allowed boolean := false;
begin
  if v_driver is null or public.current_role() <> 'driver' then
    raise exception 'Only signed-in drivers can update assigned rides' using errcode = '42501';
  end if;

  select b.* into v_booking
  from public.bookings b
  join public.trips t on t.id = b.trip_id
  join public.vehicles v on v.id = t.vehicle_id and v.driver_id = v_driver
  where b.id = p_booking_id
  for update of b;
  if not found then
    raise exception 'Ride not found for this driver' using errcode = 'P0002';
  end if;

  v_allowed := (v_booking.status = 'pending' and p_next_status in ('confirmed', 'cancelled'))
    or (v_booking.status = 'confirmed' and p_next_status in ('picked_up', 'cancelled', 'no_show'))
    or (v_booking.status = 'picked_up' and p_next_status = 'completed');
  if not v_allowed then
    raise exception 'This ride cannot move from % to %', v_booking.status, p_next_status using errcode = '22023';
  end if;

  update public.bookings set status = p_next_status where id = p_booking_id returning * into v_booking;
  return v_booking;
end;
$$;
revoke all on function public.driver_update_booking(uuid, public.booking_status) from public;
grant execute on function public.driver_update_booking(uuid, public.booking_status) to authenticated;
