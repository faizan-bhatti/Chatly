create function public.search_profiles(search_query text)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $function$
  with query_value as (
    select
      pg_catalog.btrim(coalesce(search_query, '')) as raw_value,
      pg_catalog.regexp_replace(coalesce(search_query, ''), '[^0-9]', '', 'g') as digits
  )
  select profile.id, profile.display_name, profile.avatar_url
  from public.profiles as profile
  join auth.users as auth_user on auth_user.id = profile.id
  cross join query_value
  where (select auth.uid()) is not null
    and profile.id <> (select auth.uid())
    and (
      (
        pg_catalog.strpos(query_value.raw_value, '@') > 0
        and pg_catalog.lower(auth_user.email) = pg_catalog.lower(query_value.raw_value)
      )
      or (
        pg_catalog.char_length(query_value.digits) >= 7
        and pg_catalog.regexp_replace(
          coalesce(auth_user.phone, ''),
          '[^0-9]',
          '',
          'g'
        ) = query_value.digits
      )
    )
  limit 1;
$function$;

revoke all on function public.search_profiles(text) from public, anon, authenticated;
grant execute on function public.search_profiles(text) to authenticated;

create function public.get_contact_list()
returns table (
  contact_id uuid,
  display_name text,
  avatar_url text,
  last_message text,
  last_message_is_image boolean,
  last_message_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    contact.id,
    profile.display_name,
    profile.avatar_url,
    case
      when latest.image_path is not null and latest.body is null then 'Photo'
      else latest.body
    end,
    coalesce(latest.image_path is not null, false),
    latest.created_at,
    coalesce(unread.count, 0)
  from public.contacts as contact
  join public.profiles as profile on profile.id = contact.contact_id
  left join lateral (
    select message.body, message.image_path, message.created_at
    from public.messages as message
    where (
      message.sender_id = (select auth.uid())
      and message.receiver_id = contact.contact_id
    ) or (
      message.receiver_id = (select auth.uid())
      and message.sender_id = contact.contact_id
    )
    order by message.created_at desc
    limit 1
  ) as latest on true
  left join lateral (
    select pg_catalog.count(*) as count
    from public.messages as message
    where message.sender_id = contact.contact_id
      and message.receiver_id = (select auth.uid())
      and message.read_at is null
  ) as unread on true
  where contact.user_id = (select auth.uid())
  order by coalesce(latest.created_at, contact.created_at) desc,
    contact.created_at desc;
$function$;

revoke all on function public.get_contact_list() from public, anon, authenticated;
grant execute on function public.get_contact_list() to authenticated;

create policy chat_images_delete_owner_folder
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter publication supabase_realtime add table public.messages;