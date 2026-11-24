-- Landride's platform fee ledger. Insert only after a ride payment is verified
-- by the payment provider webhook; never create fee rows from a client app.
create table if not exists public.service_fee_ledger (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  student_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(10,2) not null default 50.00 check (amount = 50.00),
  provider text not null,
  provider_reference text not null unique,
  collected_at timestamptz not null default now()
);

create index if not exists service_fee_ledger_collected_idx
  on public.service_fee_ledger (collected_at desc);

alter table public.service_fee_ledger enable row level security;
revoke all on public.service_fee_ledger from anon, authenticated;
grant select on public.service_fee_ledger to authenticated;

drop policy if exists "Admins read service fee ledger" on public.service_fee_ledger;
create policy "Admins read service fee ledger" on public.service_fee_ledger
  for select to authenticated using (public.current_role() = 'admin');

-- No client insert/update/delete policies are intentionally provided. A trusted
-- Edge Function using the service role should insert after verifying payment.
comment on table public.service_fee_ledger is
  'Verified Landride ₦50 fee per paid booking. Write only from trusted payment webhook.';
