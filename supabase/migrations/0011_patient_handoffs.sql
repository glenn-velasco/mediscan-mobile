create table if not exists public.patient_handoffs (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  patient_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  encrypted_snapshot text not null,
  shared_by_name text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists patient_handoffs_token_idx on public.patient_handoffs(token_hash)
  where revoked_at is null;
create index if not exists patient_handoffs_expiry_idx on public.patient_handoffs(expires_at);

create table if not exists public.patient_handoff_accesses (
  id uuid primary key default gen_random_uuid(),
  handoff_id uuid not null references public.patient_handoffs(id) on delete cascade,
  accessed_by uuid not null references auth.users(id) on delete cascade,
  accessed_at timestamptz not null default now()
);

create index if not exists patient_handoff_accesses_handoff_idx
  on public.patient_handoff_accesses(handoff_id, accessed_at desc);

alter table public.patient_handoffs enable row level security;
alter table public.patient_handoff_accesses enable row level security;

-- Handoffs contain emergency medical snapshots. Access is only through the
-- privileged Edge Function, which verifies both professionals and records reads.
