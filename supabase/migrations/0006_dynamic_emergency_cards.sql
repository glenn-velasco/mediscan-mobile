-- Permanent printed-card references. The QR bearer token is never stored verbatim.
create table if not exists public.dynamic_emergency_cards (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  snapshot_payload text,
  snapshot_generated_at timestamptz,
  issued_at timestamptz not null default now(),
  published_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dynamic_emergency_cards_one_active_per_patient
  on public.dynamic_emergency_cards(patient_id) where revoked_at is null;
create index if not exists dynamic_emergency_cards_token_hash_idx
  on public.dynamic_emergency_cards(token_hash) where revoked_at is null;

-- Stores only digests for abuse control; raw card tokens and medical data are excluded.
create table if not exists public.dynamic_emergency_card_lookup_attempts (
  id bigint generated always as identity primary key,
  requester_hash text not null,
  token_prefix_hash text not null,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists dynamic_card_attempts_rate_idx
  on public.dynamic_emergency_card_lookup_attempts(requester_hash, created_at desc);

alter table public.dynamic_emergency_cards enable row level security;
alter table public.dynamic_emergency_card_lookup_attempts enable row level security;

drop policy if exists dynamic_emergency_cards_owner_read on public.dynamic_emergency_cards;
create policy dynamic_emergency_cards_owner_read on public.dynamic_emergency_cards
  for select using (patient_id = auth.uid());

revoke all on public.dynamic_emergency_cards from anon, authenticated;
grant select on public.dynamic_emergency_cards to authenticated;
revoke all on public.dynamic_emergency_card_lookup_attempts from anon, authenticated;

-- Lookup-attempt records are short-lived operational security metadata.
create or replace function public.prune_dynamic_emergency_card_attempts()
returns void language sql security definer set search_path = public as $$
  delete from public.dynamic_emergency_card_lookup_attempts
  where created_at < now() - interval '24 hours';
$$;
revoke all on function public.prune_dynamic_emergency_card_attempts() from public, anon, authenticated;
