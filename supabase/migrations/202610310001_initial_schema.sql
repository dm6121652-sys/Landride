-- Landride pilot schema. Apply through the Supabase CLI or SQL editor.
create extension if not exists pgcrypto;

create type public.user_role as enum ('student', 'driver', 'admin');
create type public.trip_status as enum ('scheduled', 'active', 'completed', 'cancelled');
create type public.booking_status as enum ('pending', 'confirmed', 'picked_up', 'completed', 'cancelled', 'no_show');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'student',
  matric_number text unique,
  display_name text,
  created_at timestamptz not null default now()
);

-- Role is deliberately assigned by trusted administrators, never from signup metadata.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, display_name)
  values (new.id, 'student', coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  seats_total integer not null check (seats_total > 0),
  fare_per_seat numeric(10,2) check (fare_per_seat is null or fare_per_seat >= 0),
  solo_fare numeric(10,2) check (solo_fare is null or solo_fare >= 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.stops (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- The owner fills these four values after the university confirms the campus boundary.
create table public.campus_settings (
  singleton boolean primary key default true check (singleton),
  sw_lat double precision,
  sw_lng double precision,
  ne_lat double precision,
  ne_lng double precision,
  updated_at timestamptz not null default now(),
  check (
    (sw_lat is null and sw_lng is null and ne_lat is null and ne_lng is null)
    or (sw_lat is not null and sw_lng is not null and ne_lat is not null and ne_lng is not null
      and sw_lat between -90 and 90 and ne_lat between -90 and 90
      and sw_lng between -180 and 180 and ne_lng between -180 and 180
      and sw_lat < ne_lat and sw_lng < ne_lng)
  )
);
insert into public.campus_settings (singleton) values (true);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id),
  status public.trip_status not null default 'scheduled',
  departs_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id),
  student_id uuid not null references auth.users(id),
  seats integer not null check (seats > 0),
  pickup_stop uuid not null references public.stops(id),
  dropoff_stop uuid not null references public.stops(id),
  status public.booking_status not null default 'pending',
  sharing_ok boolean not null default true,
  created_at timestamptz not null default now(),
  check (pickup_stop <> dropoff_stop)
);
create index bookings_trip_status_idx on public.bookings (trip_id, status);
create index bookings_student_created_idx on public.bookings (student_id, created_at desc);

create table public.driver_locations (
  driver_id uuid primary key references auth.users(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  updated_at timestamptz not null default now(),
  online boolean not null default true
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount numeric(10,2) not null default 5000 check (amount >= 0),
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  unique (driver_id, period)
);

create function public.current_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;

-- The trip row lock serializes capacity checks for each trip.
create function public.request_booking(
  p_trip_id uuid,
  p_seats integer,
  p_pickup_stop uuid,
  p_dropoff_stop uuid,
  p_sharing_ok boolean default true
) returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_student uuid := auth.uid();
  v_trip public.trips%rowtype;
  v_capacity integer;
  v_used integer;
  v_bounds public.campus_settings%rowtype;
  v_pickup public.stops%rowtype;
  v_dropoff public.stops%rowtype;
  v_booking public.bookings%rowtype;
begin
  if v_student is null or public.current_role() <> 'student' then
    raise exception 'Only signed-in students can request a ride' using errcode = '42501';
  end if;
  if p_seats is null or p_seats < 1 then
    raise exception 'Choose at least one seat' using errcode = '22023';
  end if;
  if p_pickup_stop = p_dropoff_stop then
    raise exception 'Choose different pickup and drop-off stops' using errcode = '22023';
  end if;

  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found or v_trip.status not in ('scheduled', 'active') then
    raise exception 'This shuttle is no longer accepting bookings' using errcode = 'P0001';
  end if;
  select seats_total into v_capacity from public.vehicles
    where id = v_trip.vehicle_id and enabled = true;
  if not found then
    raise exception 'This shuttle is unavailable' using errcode = 'P0001';
  end if;
  select * into v_bounds from public.campus_settings where singleton = true;
  if v_bounds.sw_lat is null then
    raise exception 'Campus boundary has not been configured' using errcode = 'P0001';
  end if;
  select * into v_pickup from public.stops where id = p_pickup_stop and enabled = true;
  select * into v_dropoff from public.stops where id = p_dropoff_stop and enabled = true;
  if not found or v_pickup.id is null or v_dropoff.id is null then
    raise exception 'Choose active campus stops' using errcode = '22023';
  end if;
  if v_pickup.lat < v_bounds.sw_lat or v_pickup.lat > v_bounds.ne_lat
     or v_pickup.lng < v_bounds.sw_lng or v_pickup.lng > v_bounds.ne_lng
     or v_dropoff.lat < v_bounds.sw_lat or v_dropoff.lat > v_bounds.ne_lat
     or v_dropoff.lng < v_bounds.sw_lng or v_dropoff.lng > v_bounds.ne_lng then
    raise exception 'Pickup and drop-off must be inside the campus boundary' using errcode = '22023';
  end if;

  select coalesce(sum(seats), 0)::integer into v_used from public.bookings
    where trip_id = p_trip_id and status in ('pending', 'confirmed', 'picked_up');
  if p_seats > v_capacity - v_used then
    raise exception 'Only % seats left', greatest(v_capacity - v_used, 0) using errcode = 'P0001';
  end if;

  insert into public.bookings (trip_id, student_id, seats, pickup_stop, dropoff_stop, sharing_ok)
  values (p_trip_id, v_student, p_seats, p_pickup_stop, p_dropoff_stop, coalesce(p_sharing_ok, true))
  returning * into v_booking;
  return v_booking;
end;
$$;
revoke all on function public.request_booking(uuid, integer, uuid, uuid, boolean) from public;
grant execute on function public.request_booking(uuid, integer, uuid, uuid, boolean) to authenticated;

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.stops enable row level security;
alter table public.trips enable row level security;
alter table public.bookings enable row level security;
alter table public.driver_locations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.campus_settings enable row level security;

create policy "Profiles readable by self or admin" on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.current_role() = 'admin');
create policy "Users update own profile details" on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()) and role = (select public.current_role()));

create policy "Authenticated users read enabled vehicles" on public.vehicles for select to authenticated
using (enabled or public.current_role() = 'admin' or driver_id = (select auth.uid()));
create policy "Admins manage vehicles" on public.vehicles for all to authenticated
using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "Authenticated users read enabled stops" on public.stops for select to authenticated
using (enabled or public.current_role() = 'admin');
create policy "Admins manage stops" on public.stops for all to authenticated
using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "Authenticated users read campus boundary" on public.campus_settings for select to authenticated using (true);
create policy "Admins manage campus boundary" on public.campus_settings for all to authenticated
using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy "Authenticated users read trips" on public.trips for select to authenticated using (true);
create policy "Admins manage trips" on public.trips for all to authenticated
using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "Students and assigned drivers read bookings" on public.bookings for select to authenticated
using (
  student_id = (select auth.uid()) or public.current_role() = 'admin' or exists (
    select 1 from public.trips t join public.vehicles v on v.id = t.vehicle_id
    where t.id = bookings.trip_id and v.driver_id = (select auth.uid())
  )
);
create policy "Students read shuttle locations" on public.driver_locations for select to authenticated using (true);
create policy "Drivers write own location" on public.driver_locations for insert to authenticated
with check (driver_id = (select auth.uid()) and public.current_role() = 'driver');
create policy "Drivers update own location" on public.driver_locations for update to authenticated
using (driver_id = (select auth.uid()) and public.current_role() = 'driver')
with check (driver_id = (select auth.uid()) and public.current_role() = 'driver');
create policy "Drivers and admins read subscriptions" on public.subscriptions for select to authenticated
using (driver_id = (select auth.uid()) or public.current_role() = 'admin');
create policy "Admins manage subscriptions" on public.subscriptions for all to authenticated
using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- Realtime is used by the student map to receive driver location updates.
alter publication supabase_realtime add table public.driver_locations;
