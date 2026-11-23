-- Student app sign-up data and seat-aware trip discovery.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, display_name, matric_number)
  values (
    new.id,
    'student',
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(upper(trim(new.raw_user_meta_data ->> 'matric_number')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create function public.available_trips(p_seats integer default 1)
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

create function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_booking public.bookings%rowtype;
begin
  if auth.uid() is null or public.current_role() <> 'student' then
    raise exception 'Only signed-in students can cancel their rides' using errcode = '42501';
  end if;
  select * into v_booking from public.bookings
    where id = p_booking_id and student_id = auth.uid() for update;
  if not found then
    raise exception 'Ride not found' using errcode = 'P0002';
  end if;
  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'This ride can no longer be cancelled' using errcode = 'P0001';
  end if;
  update public.bookings set status = 'cancelled' where id = p_booking_id returning * into v_booking;
  return v_booking;
end;
$$;
revoke all on function public.cancel_booking(uuid) from public;
grant execute on function public.cancel_booking(uuid) to authenticated;

alter publication supabase_realtime add table public.stops;
alter publication supabase_realtime add table public.bookings;
