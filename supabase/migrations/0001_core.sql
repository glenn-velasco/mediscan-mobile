-- Mediscan Supabase replacement schema. Apply in a fresh Supabase project.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  middle_name text,
  last_name text not null,
  suffix text,
  dob date,
  gender text,
  address jsonb,
  phone_number text,
  phone_country_code text,
  avatar_path text,
  is_active boolean not null default true,
  is_professional boolean not null default false,
  professional_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medical_information (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  encrypted_payload text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.allergies (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_payload text not null, deleted_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.conditions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_payload text not null, deleted_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.diagnoses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_payload text not null, deleted_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_payload text not null, deleted_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_payload text not null, is_primary boolean not null default false, deleted_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.device_keys (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  public_key text not null, label text, revoked_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.encrypted_envelopes (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade, envelope_type text not null,
  ciphertext text not null, expires_at timestamptz not null, acknowledged_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists encrypted_envelopes_recipient_idx on public.encrypted_envelopes(recipient_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.medical_information enable row level security;
alter table public.allergies enable row level security;
alter table public.conditions enable row level security;
alter table public.diagnoses enable row level security;
alter table public.medications enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.device_keys enable row level security;
alter table public.encrypted_envelopes enable row level security;

drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
do $$ declare t text; begin
  foreach t in array array['medical_information','allergies','conditions','diagnoses','medications','emergency_contacts','device_keys'] loop
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format('create policy %I on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_owner', t);
  end loop;
end $$;
drop policy if exists envelopes_sender on public.encrypted_envelopes;
drop policy if exists envelopes_recipient on public.encrypted_envelopes;
drop policy if exists envelopes_ack on public.encrypted_envelopes;
create policy envelopes_sender on public.encrypted_envelopes for insert with check (sender_id = auth.uid());
create policy envelopes_recipient on public.encrypted_envelopes for select using (recipient_id = auth.uid() or sender_id = auth.uid());
create policy envelopes_ack on public.encrypted_envelopes for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, middle_name, last_name, suffix, dob, gender, address, phone_number, phone_country_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name',''),
    new.raw_user_meta_data->>'middle_name',
    coalesce(new.raw_user_meta_data->>'last_name',''),
    new.raw_user_meta_data->>'suffix',
    nullif(new.raw_user_meta_data->>'dob','')::date,
    new.raw_user_meta_data->>'gender',
    case when new.raw_user_meta_data ? 'address' then jsonb_build_object('formatted', new.raw_user_meta_data->>'address') else null end,
    new.raw_user_meta_data->>'phone_number',
    new.raw_user_meta_data->>'phone_country_code'
  );
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
