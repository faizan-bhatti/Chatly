alter table public.profiles
  add column profile_setup_completed_at timestamptz;

grant update (profile_setup_completed_at)
  on table public.profiles to authenticated;