create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    pg_catalog.left(
      coalesce(
        nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(
          pg_catalog.split_part(coalesce(new.email, new.phone, ''), '@', 1),
          ''
        ),
        'New user'
      ),
      80
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

do $migration$
begin
  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_record
    where trigger_record.tgrelid = pg_catalog.to_regclass('auth.users')
      and trigger_record.tgname = 'on_auth_user_created_profile'
      and not trigger_record.tgisinternal
  ) then
    execute 'create trigger on_auth_user_created_profile
      after insert on auth.users
      for each row execute function public.handle_new_auth_user()';
  end if;
end;
$migration$;

insert into public.profiles (id, display_name)
select
  auth_user.id,
  pg_catalog.left(
    coalesce(
      nullif(pg_catalog.btrim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
      nullif(
        pg_catalog.split_part(coalesce(auth_user.email, auth_user.phone, ''), '@', 1),
        ''
      ),
      'New user'
    ),
    80
  )
from auth.users as auth_user
left join public.profiles as profile on profile.id = auth_user.id
where profile.id is null
on conflict (id) do nothing;

do $verification$
begin
  if exists (
    select 1
    from auth.users as auth_user
    left join public.profiles as profile on profile.id = auth_user.id
    where profile.id is null
  ) then
    raise exception 'Profile repair incomplete: one or more auth users have no public.profiles row';
  end if;
end;
$verification$;