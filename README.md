# Landride

Landride is a campus shuttle booking and live tracking pilot for Landmark University. This repository starts with the responsive student web app and its Supabase data layer.

## Current project shape

- `src/` — public landing page with an illustrative animated campus route, Supabase student authentication, campus map, stop-based booking, and ride history
- `supabase/migrations/` — schema, row level security, seat reservation, and secure driver ride actions
- `mobile/driver/` — Expo Android driver app with sign-in, assigned ride queue, ride status actions, and background location sharing

## Start the student app

1. Install Node.js (LTS) if it is not already installed.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`, enter the Supabase project URL and anon key, and add a Google Maps Platform API key as `VITE_GOOGLE_MAPS_API_KEY`.
4. Run `npm run dev`.

The student web app includes a public landing page, Supabase email sign-in/sign-up, a clean campus-bounded Google map, pickup and destination selectors populated from the enabled `stops` table, seat-aware ride discovery, booking through a server-side capacity check, and a personal ride list with cancellation. The landing page simulator is illustrative; ride data and actions use Landride’s Supabase backend. Supabase credentials, enabled campus stops, trips, confirmed vehicle capacities, and a Google Maps API key are required for live use.

### Google Maps key

For a prototype, Google offers an eligible-account Maps Demo Key without billing. It is limited to testing and prototyping. Add the key to `VITE_GOOGLE_MAPS_API_KEY` in `.env.local` and restart Vite. For production, use a standard Maps Platform key with billing enabled and restrict it to the app's website referrers and Maps JavaScript API.

## Supabase setup

Apply the SQL files in `supabase/migrations/` to a new Supabase project, in filename order. For an existing project that already has migrations `202610310001`, `202610310002`, and `202610310003`, apply `202611010004_driver_trip_availability.sql` in Supabase SQL Editor to let drivers open a bookable trip when they go online. Create enabled stop rows with approved names and coordinates in `stops`, then create vehicle records and assign each driver to their vehicle. Assign driver and admin roles through a trusted admin process; public signup always creates a student profile.

Students select pickup and destination from the enabled campus stops. `request_booking` validates both stops against the campus boundary and checks shuttle capacity while locking the trip row. Configure `campus_settings` with the approved boundary before accepting ride requests.

## Android driver pilot

1. Install driver app dependencies with `npm install` from `mobile/driver/`. This installs the project-local EAS CLI too.
2. Copy `mobile/driver/.env.example` to `mobile/driver/.env` and set the Supabase project URL and anon key.
3. From `mobile/driver/`, run `npm run eas:init` to link the app to your Expo account and create its EAS project.
4. Build an internal APK with `npm run build:android` and install it on a real driver phone. The driver build script runs EAS without Git because this project sits inside a broader Windows home-directory repository. `.easignore` keeps dependencies and private files out of the upload; the local `.env` is included for the `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` client settings. Never put a service-role key in that file.

The driver app shows rides assigned to the driver's vehicle, with actions to accept, decline, start, complete, or mark a no-show. Going online opens (or reuses) an active/scheduled trip for the assigned vehicle; students see it while the driver's location is online and fresh. Online mode requests foreground and background location permission, then sends updates on a five-second interval with an Android foreground service notification. Use an Expo development build or EAS build for background tracking; Expo Go does not support all required native location behavior. Field-test screen-locked tracking and battery optimization settings on the actual driver phones before relying on them for a shift.

Next milestone: test the student and driver flows against your Supabase project, then field-test Android background tracking on a driver phone.

## Pilot constraints

- Keep student use browser based and responsive for laptops and Wi-Fi-only phones.
- Do not use a student's device location to choose pickup or destination.
- Keep the configured campus boundary aligned with the university-approved service area; out-of-boundary points are rejected server-side.
- Field test Android background tracking on the actual driver phones before relying on it for a full shift.
