create table if not exists public.professional_encounters (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete restrict,
  encrypted_payload text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists professional_encounters_patient_idx on public.professional_encounters(patient_id, updated_at desc);
create index if not exists professional_encounters_professional_idx on public.professional_encounters(professional_id, updated_at desc);

alter table public.professional_encounters enable row level security;
create policy professional_encounters_participant_read on public.professional_encounters
  for select using (patient_id = auth.uid() or professional_id = auth.uid());

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'professional_encounters') then
    alter publication supabase_realtime add table public.professional_encounters;
  end if;
end $$;
