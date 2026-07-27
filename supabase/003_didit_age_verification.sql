-- Didit age assurance for creator uploads. The Didit workflow configured by
-- DIDIT_WORKFLOW_ID must approve only people who meet the 15+ age threshold.
alter table public.profiles add column if not exists didit_session_id text;
alter table public.profiles add column if not exists age_verification_status text not null default 'unverified';
alter table public.profiles add column if not exists age_verified_at timestamptz;
alter table public.profiles add column if not exists age_verification_provider text;
alter table public.profiles add column if not exists age_verification_minimum_age int;
alter table public.profiles add column if not exists age_verification_updated_at timestamptz;

alter table public.profiles drop constraint if exists profiles_age_verification_status_check;
alter table public.profiles add constraint profiles_age_verification_status_check check (
  age_verification_status in ('unverified', 'not_started', 'in_progress', 'in_review', 'approved', 'declined', 'abandoned', 'expired', 'pending')
);
create unique index if not exists profiles_didit_session_unique
  on public.profiles (didit_session_id) where didit_session_id is not null;

create or replace function public.protect_age_verification_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and (
    new.didit_session_id is distinct from old.didit_session_id or
    new.age_verification_status is distinct from old.age_verification_status or
    new.age_verified_at is distinct from old.age_verified_at or
    new.age_verification_provider is distinct from old.age_verification_provider or
    new.age_verification_minimum_age is distinct from old.age_verification_minimum_age or
    new.age_verification_updated_at is distinct from old.age_verification_updated_at
  ) then
    raise exception 'Age verification fields can only be updated by the verification service.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_age_verification on public.profiles;
create trigger profiles_protect_age_verification before update on public.profiles
  for each row execute function public.protect_age_verification_fields();

-- Identity state is webhook-owned. Users can still edit non-sensitive profile
-- fields through the application, but RLS prevents them from self-approving.
create or replace function public.has_verified_upload_age()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and age_verification_status = 'approved'
      and age_verification_minimum_age >= 15
  );
$$;

drop policy if exists "users insert own contents" on public.contents;
create policy "users insert own contents" on public.contents for insert to authenticated
  with check (auth.uid() = user_id and public.is_verified_auth_user() and public.has_verified_upload_age());
