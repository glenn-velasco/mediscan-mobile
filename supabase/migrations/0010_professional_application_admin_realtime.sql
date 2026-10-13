-- Realtime applies the table's SELECT policies before delivering a Postgres
-- change. Application owners already have access; this policy lets authenticated
-- administrators receive queue changes without exposing them to other users.
drop policy if exists applications_admin_read on public.professional_applications;
create policy applications_admin_read
  on public.professional_applications
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- The application table was added in 0002. Keep this migration safe for projects
-- whose publication was changed manually, and publish profile updates so a newly
-- verified user's permissions also refresh immediately on their other devices.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'professional_applications'
  ) then
    alter publication supabase_realtime add table public.professional_applications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
