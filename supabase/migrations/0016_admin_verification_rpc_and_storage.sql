-- Allow authenticated admins to read PRC & liveness evidence from professional-applications bucket
-- and call admin_review_professional_application directly via RPC
drop policy if exists application_admin_read on storage.objects;
create policy application_admin_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'professional-applications'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create or replace function public.admin_review_professional_application(
  p_application_id uuid,
  p_decision text,
  p_reason text default null
)
returns public.professional_applications
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Admin access required';
  end if;

  return public.review_professional_application(
    p_application_id,
    auth.uid(),
    p_decision,
    p_reason
  );
end;
$$;

revoke all on function public.admin_review_professional_application(uuid, text, text) from public, anon;
grant execute on function public.admin_review_professional_application(uuid, text, text) to authenticated;

drop function if exists public.admin_list_professional_applications();
create or replace function public.admin_list_professional_applications()
returns table (
  id uuid,
  user_id uuid,
  applicant_name text,
  applicant_email text,
  applicant_dob date,
  id_type text,
  issuing_country text,
  profession text,
  full_name_on_id text,
  license_number text,
  document_paths jsonb,
  status text,
  screening_status text,
  screening_result jsonb,
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Admin access required';
  end if;

  return query
  select
    pa.id,
    pa.user_id,
    coalesce(
      nullif(trim(concat_ws(' ', nullif(p.first_name, ''), nullif(p.middle_name, ''), nullif(p.last_name, ''), nullif(p.suffix, ''))), ''),
      nullif(pa.full_name_on_id, ''),
      'Applicant'
    ) as applicant_name,
    coalesce(u.email::text, '') as applicant_email,
    p.dob as applicant_dob,
    pa.id_type,
    pa.issuing_country,
    pa.profession,
    pa.full_name_on_id,
    pa.license_number,
    pa.document_paths,
    pa.status,
    pa.screening_status,
    pa.screening_result,
    pa.rejection_reason,
    pa.reviewed_at,
    pa.created_at
  from public.professional_applications pa
  left join public.profiles p on p.id = pa.user_id
  left join auth.users u on u.id = pa.user_id
  order by
    case when pa.status = 'pending_review' then 0 else 1 end,
    pa.created_at desc
  limit 200;
end;
$$;

revoke all on function public.admin_list_professional_applications() from public, anon;
grant execute on function public.admin_list_professional_applications() to authenticated;
