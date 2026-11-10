-- App Releases table & storage bucket for MediScan Landing Page APK distribution
create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  file_size text not null default '261 MB',
  download_url text not null,
  release_notes text,
  is_active boolean not null default true,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists app_releases_active_created_idx
  on public.app_releases(is_active, created_at desc);

alter table public.app_releases enable row level security;

drop policy if exists app_releases_public_read on public.app_releases;
create policy app_releases_public_read
  on public.app_releases
  for select
  using (true);

drop policy if exists app_releases_admin_write on public.app_releases;
create policy app_releases_admin_write
  on public.app_releases
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Public bucket for hosting APK binaries when within Supabase Storage size limits
insert into storage.buckets (id, name, public)
values ('apk-releases', 'apk-releases', true)
on conflict (id) do update set public = true;

drop policy if exists apk_releases_public_read on storage.objects;
create policy apk_releases_public_read
  on storage.objects
  for select
  using (bucket_id = 'apk-releases');

drop policy if exists apk_releases_admin_insert on storage.objects;
create policy apk_releases_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'apk-releases'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists apk_releases_admin_update on storage.objects;
create policy apk_releases_admin_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'apk-releases'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists apk_releases_admin_delete on storage.objects;
create policy apk_releases_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'apk-releases'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
