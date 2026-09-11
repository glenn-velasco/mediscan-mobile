create table if not exists public.patient_professional_relationships (
  id uuid primary key default gen_random_uuid(), patient_id uuid not null references auth.users(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade, permissions jsonb not null default '{}'::jsonb,
  active boolean not null default true, created_at timestamptz not null default now(), unique(patient_id, professional_id)
);
create table if not exists public.professional_applications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  id_type text not null, issuing_country text not null, profession text, full_name_on_id text, license_number text,
  license_expiry date, document_paths jsonb not null default '[]'::jsonb, status text not null default 'pending_review',
  rejection_reason text, role_granted text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.registration_matches (
  id uuid primary key default gen_random_uuid(), candidate_user_id uuid not null references auth.users(id) on delete cascade,
  pending_email text not null, status text not null default 'pending', expires_at timestamptz not null,
  created_at timestamptz not null default now(), decided_at timestamptz
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, payload jsonb not null default '{}'::jsonb, read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.scan_events (
  id uuid primary key default gen_random_uuid(), patient_id uuid not null references auth.users(id) on delete cascade,
  professional_id uuid references auth.users(id) on delete set null, action text not null, context text,
  created_at timestamptz not null default now()
);
create table if not exists public.scan_notes (
  id uuid primary key default gen_random_uuid(), patient_id uuid not null references auth.users(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade, notes text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(patient_id, professional_id)
);
create table if not exists public.verification_records (
  id uuid primary key default gen_random_uuid(), patient_id uuid not null references auth.users(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade, envelope_type text not null,
  item_identifier text not null, verified boolean not null, verified_at timestamptz not null default now(),
  unique(patient_id, professional_id, envelope_type, item_identifier)
);
create table if not exists public.account_retrieval_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.patient_professional_relationships enable row level security;
alter table public.professional_applications enable row level security;
alter table public.registration_matches enable row level security;
alter table public.notifications enable row level security;
alter table public.scan_events enable row level security;
alter table public.scan_notes enable row level security;
alter table public.verification_records enable row level security;
alter table public.account_retrieval_requests enable row level security;

drop policy if exists relationships_participant_read on public.patient_professional_relationships;
drop policy if exists applications_owner_read on public.professional_applications;
drop policy if exists applications_owner_insert on public.professional_applications;
drop policy if exists registration_candidate_read on public.registration_matches;
drop policy if exists notifications_owner on public.notifications;
drop policy if exists notifications_owner_update on public.notifications;
drop policy if exists scan_events_patient_read on public.scan_events;
drop policy if exists scan_notes_participant_read on public.scan_notes;
drop policy if exists verification_patient_read on public.verification_records;
drop policy if exists retrieval_owner_read on public.account_retrieval_requests;
create policy relationships_participant_read on public.patient_professional_relationships for select using (patient_id = auth.uid() or professional_id = auth.uid());
create policy applications_owner_read on public.professional_applications for select using (user_id = auth.uid());
create policy applications_owner_insert on public.professional_applications for insert with check (user_id = auth.uid());
create policy registration_candidate_read on public.registration_matches for select using (candidate_user_id = auth.uid());
create policy notifications_owner on public.notifications for select using (user_id = auth.uid());
create policy notifications_owner_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy scan_events_patient_read on public.scan_events for select using (patient_id = auth.uid());
create policy scan_notes_participant_read on public.scan_notes for select using (patient_id = auth.uid() or professional_id = auth.uid());
create policy verification_patient_read on public.verification_records for select using (patient_id = auth.uid());
create policy retrieval_owner_read on public.account_retrieval_requests for select using (user_id = auth.uid());

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false), ('professional-applications', 'professional-applications', false) on conflict (id) do nothing;
drop policy if exists avatar_owner_read on storage.objects;
drop policy if exists avatar_owner_write on storage.objects;
drop policy if exists avatar_owner_update on storage.objects;
drop policy if exists application_owner_write on storage.objects;
create policy avatar_owner_read on storage.objects for select using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatar_owner_write on storage.objects for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatar_owner_update on storage.objects for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy application_owner_write on storage.objects for insert with check (bucket_id = 'professional-applications' and (storage.foldername(name))[1] = auth.uid()::text);

do $$
declare t text;
begin
  foreach t in array array['notifications','professional_applications','registration_matches','encrypted_envelopes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
