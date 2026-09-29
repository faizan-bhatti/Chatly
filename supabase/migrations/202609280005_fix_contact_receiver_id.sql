create or replace function public.get_contact_list()
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
    contact.contact_id,
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