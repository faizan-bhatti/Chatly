create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'New user',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_valid
    check (btrim(display_name) <> '' and char_length(display_name) <= 80),
  constraint profiles_avatar_url_valid
    check (avatar_url is null or (btrim(avatar_url) <> '' and char_length(avatar_url) <= 2048))
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  contact_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint contacts_not_self check (user_id <> contact_id),
  constraint contacts_unique_pair unique (user_id, contact_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  body text,
  image_path text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz,
  constraint messages_not_self check (sender_id <> receiver_id),
  constraint messages_have_content check (
    (body is not null and btrim(body) <> '' and char_length(body) <= 10000)
    or image_path is not null
  ),
  constraint messages_body_valid check (
    body is null or (btrim(body) <> '' and char_length(body) <= 10000)
  ),
  constraint messages_delivery_order check (
    delivered_at is null or delivered_at >= created_at
  ),
  constraint messages_read_order check (
    read_at is null or (delivered_at is not null and read_at >= delivered_at)
  ),
  constraint messages_image_path_owned check (
    image_path is null
    or (
      split_part(image_path, '/', 1) = sender_id::text
      and split_part(image_path, '/', 2) <> ''
      and split_part(image_path, '/', 3) = ''
    )
  )
);

create index contacts_user_created_at_idx
  on public.contacts (user_id, created_at desc);

create index messages_sender_receiver_created_at_idx
  on public.messages (sender_id, receiver_id, created_at desc);

create index messages_receiver_sender_created_at_idx
  on public.messages (receiver_id, sender_id, created_at desc);

create index messages_unread_receiver_idx
  on public.messages (receiver_id, created_at desc)
  where read_at is null;

create index messages_image_path_idx
  on public.messages (image_path)
  where image_path is not null;

alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.messages enable row level security;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy contacts_select_own
  on public.contacts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy contacts_insert_own
  on public.contacts for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select auth.uid()) <> contact_id
  );

create policy contacts_delete_own
  on public.contacts for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy messages_select_participant
  on public.messages for select to authenticated
  using (
    (select auth.uid()) = sender_id
    or (select auth.uid()) = receiver_id
  );

create policy messages_insert_sender
  on public.messages for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and (select auth.uid()) <> receiver_id
  );

create policy messages_update_recipient_status
  on public.messages for update to authenticated
  using ((select auth.uid()) = receiver_id)
  with check ((select auth.uid()) = receiver_id);

revoke all on table public.profiles, public.contacts, public.messages
  from public, anon, authenticated;

grant select, update (display_name, avatar_url)
  on table public.profiles to authenticated;

grant select, insert (user_id, contact_id), delete
  on table public.contacts to authenticated;

grant select, insert (sender_id, receiver_id, body, image_path),
  update (delivered_at, read_at)
  on table public.messages to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
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

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'chat-images',
  'chat-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy chat_images_read_owner_or_participant
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.messages as message
        where message.image_path = storage.objects.name
          and (
            message.sender_id = (select auth.uid())
            or message.receiver_id = (select auth.uid())
          )
      )
    )
  );

create policy chat_images_insert_owner_folder
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );