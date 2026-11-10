-- Web Admin RBAC Console RPCs for managing Users, Verified Professionals, Admins, and Applications
create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  full_name text,
  phone_number text,
  is_professional boolean,
  professional_verified_at timestamptz,
  is_admin boolean,
  is_active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
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
    u.id as user_id,
    coalesce(u.email::text, '') as email,
    trim(concat_ws(' ', nullif(p.first_name, ''), nullif(p.middle_name, ''), nullif(p.last_name, ''), nullif(p.suffix, ''))) as full_name,
    coalesce(p.phone_number, '') as phone_number,
    coalesce(p.is_professional, false) as is_professional,
    p.professional_verified_at,
    coalesce((u.raw_app_meta_data ->> 'role') = 'admin', false) as is_admin,
    coalesce(p.is_active, true) as is_active,
    u.created_at,
    u.last_sign_in_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc
  limit 500;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_update_user_roles(
  p_target_user_id uuid,
  p_is_professional boolean,
  p_is_admin boolean,
  p_is_active boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_was_professional boolean;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Admin access required';
  end if;

  if p_target_user_id = v_caller_id and not p_is_admin then
    raise exception 'You cannot remove your own admin role';
  end if;

  select is_professional into v_was_professional
  from public.profiles
  where id = p_target_user_id;

  -- Update profile flags (insert a minimal profile row if missing)
  insert into public.profiles (id, first_name, last_name, is_professional, professional_verified_at, is_active, updated_at)
  values (
    p_target_user_id,
    '',
    '',
    p_is_professional,
    case when p_is_professional then now() else null end,
    p_is_active,
    now()
  )
  on conflict (id) do update
  set
    is_professional = excluded.is_professional,
    professional_verified_at = case
      when excluded.is_professional then coalesce(public.profiles.professional_verified_at, now())
      else null
    end,
    is_active = excluded.is_active,
    updated_at = now();

  -- Update auth.users.raw_app_meta_data role
  if p_is_admin then
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb,
        updated_at = now()
    where id = p_target_user_id;
  else
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'role',
        updated_at = now()
    where id = p_target_user_id;
  end if;

  -- Send notification if professional verification changed
  if coalesce(v_was_professional, false) is distinct from p_is_professional then
    insert into public.notifications (user_id, type, payload)
    values (
      p_target_user_id,
      'professional_application_status',
      jsonb_build_object('status', case when p_is_professional then 'approved' else 'denied' end)
    );
  end if;
end;
$$;

revoke all on function public.admin_update_user_roles(uuid, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_update_user_roles(uuid, boolean, boolean, boolean) to authenticated;

create or replace function public.admin_list_professional_applications()
returns table (
  id uuid,
  user_id uuid,
  applicant_name text,
  applicant_email text,
  id_type text,
  issuing_country text,
  profession text,
  full_name_on_id text,
  license_number text,
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
    pa.id_type,
    pa.issuing_country,
    pa.profession,
    pa.full_name_on_id,
    pa.license_number,
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
