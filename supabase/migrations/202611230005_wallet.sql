-- Student wallet schema and a demo top-up RPC for the current pilot UI.
-- IMPORTANT: fund_wallet simulates a top-up. Do not use it for real money;
-- replace its crediting logic with a verified payment-provider webhook first.

create table if not exists public.wallets (
  student_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric(12, 2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  type text not null check (type in ('credit', 'debit')),
  description text not null,
  reference text,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_student_created_idx
  on public.wallet_transactions (student_id, created_at desc);

alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

drop policy if exists "Students read own wallet" on public.wallets;
create policy "Students read own wallet" on public.wallets
  for select to authenticated
  using (student_id = (select auth.uid()));

drop policy if exists "Students read own wallet transactions" on public.wallet_transactions;
create policy "Students read own wallet transactions" on public.wallet_transactions
  for select to authenticated
  using (student_id = (select auth.uid()));

revoke all on table public.wallets from anon, authenticated;
revoke all on table public.wallet_transactions from anon, authenticated;
grant select on table public.wallets to authenticated;
grant select on table public.wallet_transactions to authenticated;

-- Give existing and future student profiles a zero-balance wallet.
insert into public.wallets (student_id)
select p.id
from public.profiles p
where p.role = 'student'
on conflict (student_id) do nothing;

create or replace function public.create_student_wallet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'student' then
    insert into public.wallets (student_id)
    values (new.id)
    on conflict (student_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists create_wallet_for_student on public.profiles;
create trigger create_wallet_for_student
  after insert or update of role on public.profiles
  for each row
  when (new.role = 'student')
  execute function public.create_student_wallet();

-- Demo-only top-up: students can only modify their own wallet, within the
-- same limits enforced by the current UI. This does not verify a payment.
create or replace function public.fund_wallet(
  p_student_id uuid,
  p_amount numeric,
  p_reference text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_student_id is distinct from auth.uid() then
    raise exception 'You may only fund your own wallet' using errcode = '42501';
  end if;

  if public.current_role() is distinct from 'student'::public.user_role then
    raise exception 'Only student accounts can fund a wallet' using errcode = '42501';
  end if;

  if p_amount is null or p_amount < 100 or p_amount > 100000 then
    raise exception 'Top-up amount must be between 100 and 100000' using errcode = '22023';
  end if;

  insert into public.wallets (student_id)
  values (p_student_id)
  on conflict (student_id) do nothing;

  update public.wallets
  set balance = balance + round(p_amount, 2), updated_at = now()
  where student_id = p_student_id;

  insert into public.wallet_transactions
    (student_id, amount, type, description, reference)
  values
    (p_student_id, round(p_amount, 2), 'credit', 'Wallet top-up', p_reference);
end;
$$;

revoke all on function public.fund_wallet(uuid, numeric, text) from public, anon;
grant execute on function public.fund_wallet(uuid, numeric, text) to authenticated;

-- Keep the wallet UI's Supabase Realtime subscriptions in sync when balances
-- or transactions change. Ignore tables already in the publication.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wallets'
    ) then
      alter publication supabase_realtime add table public.wallets;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wallet_transactions'
    ) then
      alter publication supabase_realtime add table public.wallet_transactions;
    end if;
  end if;
end;
$$;
