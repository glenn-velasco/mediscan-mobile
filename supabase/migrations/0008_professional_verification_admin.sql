alter table public.professional_applications
  add column if not exists screening_status text not null default 'not_started',
  add column if not exists screening_result jsonb not null default '{}'::jsonb,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.professional_applications
  drop constraint if exists professional_applications_status_check;
alter table public.professional_applications
  add constraint professional_applications_status_check
  check (status in ('processing', 'pending_review', 'approved', 'auto_rejected', 'denied'));

alter table public.professional_applications
  drop constraint if exists professional_applications_screening_status_check;
alter table public.professional_applications
  add constraint professional_applications_screening_status_check
  check (screening_status in ('not_started', 'processing', 'passed', 'failed', 'unavailable'));

create table if not exists public.professional_application_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.professional_applications(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved', 'denied')),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.professional_application_reviews enable row level security;
-- Reviews and application evidence are intentionally accessible only through the
-- service-role Edge Function after it verifies app_metadata.role = 'admin'.

create index if not exists professional_applications_review_queue_idx
  on public.professional_applications(status, created_at);
create index if not exists professional_application_reviews_application_idx
  on public.professional_application_reviews(application_id, created_at);

create or replace function public.review_professional_application(
  p_application_id uuid, p_reviewer_id uuid, p_decision text, p_reason text
) returns public.professional_applications
language plpgsql security definer set search_path = public
as $$
declare reviewed public.professional_applications;
begin
  if p_decision not in ('approved', 'denied') then raise exception 'Invalid review decision'; end if;
  if p_decision = 'denied' and nullif(trim(p_reason), '') is null then raise exception 'A denial reason is required'; end if;

  update public.professional_applications
  set status = p_decision, rejection_reason = case when p_decision = 'denied' then trim(p_reason) else null end,
      role_granted = case when p_decision = 'approved' then 'professional' else null end,
      reviewed_by = p_reviewer_id, reviewed_at = now(), updated_at = now()
  where id = p_application_id and status = 'pending_review'
  returning * into reviewed;
  if reviewed.id is null then raise exception 'Application is no longer pending review'; end if;

  insert into public.professional_application_reviews(application_id, reviewer_id, decision, reason)
  values (reviewed.id, p_reviewer_id, p_decision, nullif(trim(p_reason), ''));
  if p_decision = 'approved' then
    update public.profiles set is_professional = true, professional_verified_at = now() where id = reviewed.user_id;
  end if;
  insert into public.notifications(user_id, type, payload)
  values (reviewed.user_id, 'professional_application_status', jsonb_build_object('application_id', reviewed.id, 'status', p_decision));
  return reviewed;
end;
$$;
revoke all on function public.review_professional_application(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_professional_application(uuid, uuid, text, text) to service_role;
