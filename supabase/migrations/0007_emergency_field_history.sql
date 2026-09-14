-- Append-only, server-encrypted patient-entered emergency field history.
-- The Edge Function is the only writer and stores AES-GCM ciphertext, never plaintext values.
create table if not exists public.emergency_field_history (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  field_key text not null check (field_key in ('date_of_birth', 'blood_type', 'no_blood_transfusion')),
  encrypted_value text not null,
  changed_at_local timestamptz not null,
  server_recorded_at timestamptz not null default now()
);

create index if not exists emergency_field_history_user_time_idx
  on public.emergency_field_history (user_id, server_recorded_at desc);

alter table public.emergency_field_history enable row level security;
revoke all on public.emergency_field_history from anon, authenticated;

-- Service-role Edge Function access is intentional. The client cannot directly
-- insert, alter, delete, or read history rows, even for its own account.
