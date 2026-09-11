-- One round trip for the mobile client's local-first delta synchronization.
-- SECURITY INVOKER keeps every table read subject to the caller's RLS policies.
create or replace function public.sync_patient_data(since_timestamp timestamptz default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'server_time', clock_timestamp(),
    'medical_information', (
      select to_jsonb(mi)
      from (
        select encrypted_payload, updated_at
        from public.medical_information
        where user_id = auth.uid()
          and (since_timestamp is null or updated_at > since_timestamp)
        limit 1
      ) mi
    ),
    'allergies', coalesce((
      select jsonb_agg(to_jsonb(a)) from (
        select id, encrypted_payload, deleted_at, updated_at
        from public.allergies
        where user_id = auth.uid()
          and (since_timestamp is null or updated_at > since_timestamp)
      ) a
    ), '[]'::jsonb),
    'conditions', coalesce((
      select jsonb_agg(to_jsonb(c)) from (
        select id, encrypted_payload, deleted_at, updated_at
        from public.conditions
        where user_id = auth.uid()
          and (since_timestamp is null or updated_at > since_timestamp)
      ) c
    ), '[]'::jsonb),
    'diagnoses', coalesce((
      select jsonb_agg(to_jsonb(d)) from (
        select id, encrypted_payload, deleted_at, updated_at
        from public.diagnoses
        where user_id = auth.uid()
          and (since_timestamp is null or updated_at > since_timestamp)
      ) d
    ), '[]'::jsonb),
    'medications', coalesce((
      select jsonb_agg(to_jsonb(m)) from (
        select id, encrypted_payload, deleted_at, updated_at
        from public.medications
        where user_id = auth.uid()
          and (since_timestamp is null or updated_at > since_timestamp)
      ) m
    ), '[]'::jsonb),
    'emergency_contacts', coalesce((
      select jsonb_agg(to_jsonb(ec)) from (
        select id, encrypted_payload, deleted_at, updated_at
        from public.emergency_contacts
        where user_id = auth.uid()
          and (since_timestamp is null or updated_at > since_timestamp)
      ) ec
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.sync_patient_data(timestamptz) from public;
grant execute on function public.sync_patient_data(timestamptz) to authenticated;
