-- Prevent new duplicate phone numbers without changing existing profile data.
-- Existing duplicates (from before this migration) must be resolved separately.
create index if not exists profiles_phone_number_lookup_idx
  on public.profiles (phone_number)
  where phone_number is not null and phone_number <> '';

create or replace function public.enforce_unique_profile_phone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.phone_number is null or new.phone_number = '' then return new; end if;
  if tg_op = 'UPDATE' and new.phone_number is not distinct from old.phone_number then return new; end if;

  -- Serialize writes for the same number, including simultaneous registrations.
  perform pg_advisory_xact_lock(hashtextextended(new.phone_number, 0));
  if exists (
    select 1 from public.profiles
    where phone_number = new.phone_number and id <> new.id
  ) then
    raise exception 'Phone number is already registered' using errcode = '23505';
  end if;
  return new;
end; $$;
revoke execute on function public.enforce_unique_profile_phone() from public, anon, authenticated;

drop trigger if exists profiles_unique_phone on public.profiles;
create trigger profiles_unique_phone
  before insert or update of phone_number on public.profiles
  for each row execute function public.enforce_unique_profile_phone();

-- The registration screen checks availability before calling Auth signUp.
-- Only a boolean is returned; profile details remain protected by RLS.
create or replace function public.phone_number_available(candidate text)
returns boolean language sql stable security definer set search_path = public as $$
  select candidate ~ '^\+[1-9][0-9]{7,14}$'
    and not exists (select 1 from public.profiles where phone_number = candidate);
$$;
revoke all on function public.phone_number_available(text) from public;
grant execute on function public.phone_number_available(text) to anon, authenticated;
