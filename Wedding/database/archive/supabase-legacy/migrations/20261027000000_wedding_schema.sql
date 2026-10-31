-- =============================================================================
-- Wedding website schema
--
-- Security model
--   * Guests (anon role) can only READ published/approved content.
--   * Guests WRITE only through the SECURITY DEFINER functions below
--     (submit_greeting, submit_rsvp, get_invitation) which validate input,
--     de-duplicate and rate-limit. There are no INSERT policies for anon.
--   * Guest photo uploads go through the `guest-upload` Edge Function, which
--     uses the service role and calls consume_upload_quota().
--   * Administrators are rows in admin_profiles. Every admin policy checks
--     public.is_admin(); simply being signed in grants nothing.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Private schema (not exposed through the Data API)
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to postgres, service_role;

create table private.config (
  key text primary key,
  value text not null
);
insert into private.config (key, value)
values ('ip_salt', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

create table private.rate_limit_events (
  id bigint generated always as identity primary key,
  bucket text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_lookup_idx on private.rate_limit_events (bucket, key_hash, created_at desc);

-- Strips control characters and surrounding whitespace.
create or replace function private.clean_text(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(regexp_replace(coalesce(p, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), '');
$$;

create or replace function private.hash_ip(p_ip text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(
    extensions.digest(
      coalesce(nullif(btrim(p_ip), ''), 'unknown') || (select value from private.config where key = 'ip_salt'),
      'sha256'
    ),
    'hex'
  );
$$;

-- Salted hash of the caller's IP, taken from the API gateway's forwarded headers.
create or replace function private.request_ip_hash()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  headers json;
  ip text;
begin
  begin
    headers := current_setting('request.headers', true)::json;
  exception when others then
    headers := null;
  end;
  ip := coalesce(
    nullif(btrim(split_part(headers ->> 'x-forwarded-for', ',', 1)), ''),
    nullif(headers ->> 'cf-connecting-ip', ''),
    nullif(headers ->> 'x-real-ip', ''),
    'unknown'
  );
  return private.hash_ip(ip);
end;
$$;

-- Sliding-window limiter. Returns false when the caller is over the limit.
create or replace function private.consume_rate_limit(p_bucket text, p_key text, p_max integer, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_bucket || ':' || p_key));

  select count(*) into used
  from private.rate_limit_events
  where bucket = p_bucket and key_hash = p_key and created_at > now() - p_window;

  if used >= p_max then
    return false;
  end if;

  insert into private.rate_limit_events (bucket, key_hash) values (p_bucket, p_key);

  -- Occasional housekeeping so the table stays small.
  if random() < 0.02 then
    delete from private.rate_limit_events where created_at < now() - interval '2 days';
  end if;
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Administrators
-- -----------------------------------------------------------------------------
create table public.admin_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_profiles where user_id = (select auth.uid()));
$$;

-- -----------------------------------------------------------------------------
-- Site settings (single row)
-- -----------------------------------------------------------------------------
create table public.wedding_settings (
  id smallint primary key default 1 check (id = 1),
  wedding_date date,
  wedding_time time,
  timezone text not null default 'Asia/Kuala_Lumpur' check (char_length(timezone) between 1 and 64),
  rsvp_mode text not null default 'open' check (rsvp_mode in ('open', 'invite_only', 'closed')),
  rsvp_deadline date,
  greetings_enabled boolean not null default true,
  greetings_auto_approve boolean not null default false,
  photo_uploads_enabled boolean not null default true,
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object' and pg_column_size(content) < 256000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Events
-- -----------------------------------------------------------------------------
create table public.wedding_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  description text check (description is null or char_length(description) <= 2000),
  event_date date,
  start_time time,
  end_time time,
  venue_name text check (venue_name is null or char_length(venue_name) <= 150),
  address text check (address is null or char_length(address) <= 300),
  maps_url text check (maps_url is null or (char_length(maps_url) <= 600 and maps_url ~* '^https://')),
  dress_code text check (dress_code is null or char_length(dress_code) <= 300),
  programme jsonb not null default '[]'::jsonb check (jsonb_typeof(programme) = 'array'),
  rsvp_enabled boolean not null default true,
  capacity integer check (capacity is null or capacity > 0),
  max_party_size integer not null default 4 check (max_party_size between 1 and 20),
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index wedding_events_order_idx on public.wedding_events (sort_order, event_date, start_time);

-- -----------------------------------------------------------------------------
-- Invited guests / households
-- -----------------------------------------------------------------------------
create table public.invited_guests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text check (email is null or char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 40),
  max_party_size integer not null default 2 check (max_party_size between 1 and 20),
  notes text check (notes is null or char_length(notes) <= 1000),
  invite_token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invited_guests_name_idx on public.invited_guests (lower(name));

-- -----------------------------------------------------------------------------
-- RSVP responses (one row per party per event)
-- -----------------------------------------------------------------------------
create table public.rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.wedding_events (id) on delete cascade,
  guest_id uuid references public.invited_guests (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  email text check (email is null or char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 40),
  attending boolean not null,
  party_size integer not null default 1 check (party_size between 0 and 20),
  message text check (message is null or char_length(message) <= 1000),
  dedupe_key text not null check (char_length(dedupe_key) <= 300),
  source text not null default 'open' check (source in ('open', 'invite', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rsvp_party_matches_attendance check ((attending and party_size >= 1) or (not attending and party_size = 0)),
  constraint rsvp_unique_party_per_event unique (event_id, dedupe_key)
);
create index rsvp_responses_event_idx on public.rsvp_responses (event_id, attending);
create index rsvp_responses_guest_idx on public.rsvp_responses (guest_id);

-- -----------------------------------------------------------------------------
-- Guestbook
-- -----------------------------------------------------------------------------
create table public.guest_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  relationship text check (relationship is null or char_length(relationship) <= 60),
  message text not null check (char_length(message) between 2 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden', 'spam')),
  content_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guest_messages_status_idx on public.guest_messages (status, created_at desc);

-- -----------------------------------------------------------------------------
-- Photos
-- -----------------------------------------------------------------------------
create table public.photo_albums (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  title text not null check (char_length(title) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  is_public boolean not null default true,
  is_guest_uploads boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Only one album receives guest uploads.
create unique index photo_albums_one_guest_album on public.photo_albums (is_guest_uploads) where is_guest_uploads;

create table public.wedding_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid references public.photo_albums (id) on delete set null,
  storage_path text not null unique check (char_length(storage_path) <= 300),
  thumb_path text check (thumb_path is null or char_length(thumb_path) <= 300),
  caption text check (caption is null or char_length(caption) <= 300),
  uploader_name text check (uploader_name is null or char_length(uploader_name) <= 80),
  source text not null default 'official' check (source in ('official', 'guest')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  width integer check (width is null or width between 1 and 20000),
  height integer check (height is null or height between 1 and 20000),
  sort_order integer not null default 0,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_photos_need_consent check (source <> 'guest' or consent_at is not null)
);
create index wedding_photos_public_idx on public.wedding_photos (status, album_id, sort_order, created_at desc);
create index wedding_photos_thumb_idx on public.wedding_photos (thumb_path);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['wedding_settings', 'wedding_events', 'invited_guests', 'rsvp_responses',
                           'guest_messages', 'photo_albums', 'wedding_photos']
  loop
    execute format('create trigger %I_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.admin_profiles enable row level security;
alter table public.wedding_settings enable row level security;
alter table public.wedding_events enable row level security;
alter table public.invited_guests enable row level security;
alter table public.rsvp_responses enable row level security;
alter table public.guest_messages enable row level security;
alter table public.photo_albums enable row level security;
alter table public.wedding_photos enable row level security;
alter table private.config enable row level security;
alter table private.rate_limit_events enable row level security;

-- Table privileges: anon gets read-only access to public content tables only.
revoke all on all tables in schema public from anon;
grant select on public.wedding_settings, public.wedding_events, public.guest_messages,
                public.photo_albums, public.wedding_photos to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- admin_profiles: admins can see the list; no API writes (manage via SQL).
create policy "Admins read admin list" on public.admin_profiles
  for select to authenticated using ((select public.is_admin()));

-- wedding_settings
create policy "Anyone reads settings" on public.wedding_settings
  for select to anon, authenticated using (true);
create policy "Admins update settings" on public.wedding_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- wedding_events
create policy "Anyone reads published events" on public.wedding_events
  for select to anon, authenticated using (is_published or (select public.is_admin()));
create policy "Admins insert events" on public.wedding_events
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update events" on public.wedding_events
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete events" on public.wedding_events
  for delete to authenticated using ((select public.is_admin()));

-- invited_guests / rsvp_responses: admins only. Guests use the RPCs.
create policy "Admins manage guests" on public.invited_guests
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins manage rsvps" on public.rsvp_responses
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- guest_messages
create policy "Anyone reads approved messages" on public.guest_messages
  for select to anon, authenticated using (status = 'approved' or (select public.is_admin()));
create policy "Admins update messages" on public.guest_messages
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete messages" on public.guest_messages
  for delete to authenticated using ((select public.is_admin()));

-- photo_albums
create policy "Anyone reads public albums" on public.photo_albums
  for select to anon, authenticated using (is_public or (select public.is_admin()));
create policy "Admins insert albums" on public.photo_albums
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update albums" on public.photo_albums
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete albums" on public.photo_albums
  for delete to authenticated using ((select public.is_admin()));

-- wedding_photos
create policy "Anyone reads approved photos in public albums" on public.wedding_photos
  for select to anon, authenticated using (
    (status = 'approved' and (album_id is null or exists (
      select 1 from public.photo_albums a where a.id = album_id and a.is_public)))
    or (select public.is_admin())
  );
create policy "Admins insert photos" on public.wedding_photos
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update photos" on public.wedding_photos
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete photos" on public.wedding_photos
  for delete to authenticated using ((select public.is_admin()));

-- =============================================================================
-- Guest-facing functions
-- =============================================================================

-- Leave a wish in the guestbook.
create or replace function public.submit_greeting(
  p_name text,
  p_message text,
  p_relationship text default null,
  p_website text default null -- honeypot field; real guests never fill it
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := private.clean_text(p_name);
  v_message text := private.clean_text(p_message);
  v_relationship text := private.clean_text(p_relationship);
  v_settings public.wedding_settings;
  v_ip text := private.request_ip_hash();
  v_hash text;
  v_id uuid;
begin
  select * into v_settings from public.wedding_settings where id = 1;
  if v_settings.id is null or not v_settings.greetings_enabled then
    raise exception 'The guestbook is not accepting messages right now.';
  end if;

  -- Bots that fill the hidden field are silently ignored.
  if private.clean_text(p_website) is not null then
    return jsonb_build_object('status', 'pending');
  end if;

  if v_name is null or char_length(v_name) > 80 then
    raise exception 'Please enter your name (up to 80 characters).';
  end if;
  if v_message is null or char_length(v_message) < 2 or char_length(v_message) > 1000 then
    raise exception 'Please write a message between 2 and 1000 characters.';
  end if;
  if v_relationship is not null and char_length(v_relationship) > 60 then
    raise exception 'Please keep the relationship under 60 characters.';
  end if;
  if (select count(*) from regexp_matches(v_message, 'https?://', 'g')) > 2 then
    raise exception 'Please remove the links from your message.';
  end if;

  if not private.consume_rate_limit('greeting', v_ip, 5, interval '30 minutes')
     or not private.consume_rate_limit('greeting-day', v_ip, 20, interval '1 day')
     or not private.consume_rate_limit('greeting-global', 'all', 400, interval '1 hour') then
    raise exception 'You have sent several messages recently. Please try again a little later.';
  end if;

  v_hash := encode(extensions.digest(
    lower(v_name) || '|' || lower(regexp_replace(v_message, '\s+', ' ', 'g')), 'sha256'), 'hex');

  insert into public.guest_messages (name, relationship, message, status, content_hash)
  values (v_name, v_relationship, v_message,
          case when v_settings.greetings_auto_approve then 'approved' else 'pending' end, v_hash)
  on conflict (content_hash) do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('status', 'duplicate');
  end if;
  return jsonb_build_object('status', case when v_settings.greetings_auto_approve then 'approved' else 'pending' end);
end;
$$;

-- Look up a personal invitation. Returns only that guest's own data.
create or replace function public.get_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.invited_guests;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{24,64}$' then
    return null;
  end if;
  if not private.consume_rate_limit('invite-lookup', private.request_ip_hash(), 40, interval '10 minutes') then
    raise exception 'Too many attempts. Please wait a few minutes and try again.';
  end if;

  select * into v_guest from public.invited_guests where invite_token = p_token;
  if v_guest.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'name', v_guest.name,
    'email', v_guest.email,
    'phone', v_guest.phone,
    'max_party_size', v_guest.max_party_size,
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_id', r.event_id, 'attending', r.attending, 'party_size', r.party_size, 'message', r.message,
        'updated_at', r.updated_at))
      from public.rsvp_responses r where r.guest_id = v_guest.id), '[]'::jsonb)
  );
end;
$$;

-- Submit or update an RSVP.
--   p_token     : personal invite token (optional). With a token, responses are upserted.
--   p_responses : [{ "event_id": uuid, "attending": bool, "party_size": int }]
create or replace function public.submit_rsvp(
  p_name text,
  p_responses jsonb,
  p_email text default null,
  p_phone text default null,
  p_message text default null,
  p_token text default null,
  p_website text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.wedding_settings;
  v_guest public.invited_guests;
  v_name text := private.clean_text(p_name);
  v_email text := lower(private.clean_text(p_email));
  v_phone text := private.clean_text(p_phone);
  v_message text := private.clean_text(p_message);
  v_ip text := private.request_ip_hash();
  v_dedupe text;
  v_item jsonb;
  v_event public.wedding_events;
  v_attending boolean;
  v_party integer;
  v_limit integer;
  v_taken integer;
  v_existing integer := 0;
  v_count integer := 0;
begin
  select * into v_settings from public.wedding_settings where id = 1;
  if v_settings.id is null or v_settings.rsvp_mode = 'closed' then
    raise exception 'RSVPs are currently closed.';
  end if;
  if v_settings.rsvp_deadline is not null
     and now() > ((v_settings.rsvp_deadline + 1)::timestamp at time zone v_settings.timezone) then
    raise exception 'The RSVP deadline has passed. Please contact the couple directly.';
  end if;

  if private.clean_text(p_website) is not null then
    return jsonb_build_object('status', 'saved', 'events', 0);
  end if;

  if not private.consume_rate_limit('rsvp', v_ip, 10, interval '15 minutes')
     or not private.consume_rate_limit('rsvp-global', 'all', 600, interval '1 hour') then
    raise exception 'Too many RSVP attempts. Please wait a few minutes and try again.';
  end if;

  -- Identify the party.
  if p_token is not null and btrim(p_token) <> '' then
    select * into v_guest from public.invited_guests where invite_token = btrim(p_token);
    if v_guest.id is null then
      raise exception 'This invitation link is not valid. Please check the link or contact the couple.';
    end if;
    v_name := coalesce(v_name, v_guest.name);
    v_dedupe := 'guest:' || v_guest.id::text;
  else
    if v_settings.rsvp_mode = 'invite_only' then
      raise exception 'Please use the personal RSVP link from your invitation.';
    end if;
    v_dedupe := case
      when v_email is not null then 'email:' || v_email
      when v_phone is not null then 'phone:' || regexp_replace(v_phone, '[^0-9]', '', 'g')
      else 'name:' || lower(regexp_replace(coalesce(v_name, ''), '\s+', ' ', 'g'))
    end;
  end if;

  -- Validate fields.
  if v_name is null or char_length(v_name) > 120 then
    raise exception 'Please enter your name.';
  end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$') then
    raise exception 'Please enter a valid email address.';
  end if;
  if v_phone is not null and v_phone !~ '^[+()0-9[:space:]-]{6,40}$' then
    raise exception 'Please enter a valid phone number.';
  end if;
  if v_message is not null and char_length(v_message) > 1000 then
    raise exception 'Please keep your message under 1000 characters.';
  end if;
  if p_responses is null or jsonb_typeof(p_responses) <> 'array'
     or jsonb_array_length(p_responses) = 0 or jsonb_array_length(p_responses) > 20 then
    raise exception 'Please choose at least one event.';
  end if;

  -- Open RSVPs cannot overwrite an existing response (prevents tampering with others' RSVPs).
  if v_guest.id is null then
    select count(*) into v_existing
    from public.rsvp_responses r
    where r.dedupe_key = v_dedupe
      and r.event_id in (select (e ->> 'event_id')::uuid from jsonb_array_elements(p_responses) e);
    if v_existing > 0 then
      return jsonb_build_object('status', 'duplicate');
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_responses)
  loop
    begin
      v_attending := (v_item ->> 'attending')::boolean;
      v_party := coalesce((v_item ->> 'party_size')::integer, 0);
      -- Lock the event row so concurrent capacity checks are serialised.
      select * into v_event from public.wedding_events
      where id = (v_item ->> 'event_id')::uuid
      for update;
    exception when others then
      raise exception 'Your RSVP contained an invalid choice. Please refresh and try again.';
    end;

    if v_event.id is null or not v_event.is_published or not v_event.rsvp_enabled or v_attending is null then
      raise exception 'One of the selected events is not accepting RSVPs.';
    end if;

    if v_attending then
      v_limit := least(v_event.max_party_size, coalesce(v_guest.max_party_size, v_event.max_party_size));
      if v_party < 1 or v_party > v_limit then
        raise exception 'For %, you can reply for up to % guest(s).', v_event.title, v_limit;
      end if;
      if v_event.capacity is not null then
        select coalesce(sum(party_size), 0) into v_taken
        from public.rsvp_responses
        where event_id = v_event.id and attending and dedupe_key <> v_dedupe;
        if v_taken + v_party > v_event.capacity then
          raise exception 'Sorry, % has reached its guest capacity. Please contact the couple.', v_event.title;
        end if;
      end if;
    else
      v_party := 0;
    end if;

    insert into public.rsvp_responses
      (event_id, guest_id, name, email, phone, attending, party_size, message, dedupe_key, source)
    values
      (v_event.id, v_guest.id, v_name, v_email, v_phone, v_attending, v_party, v_message, v_dedupe,
       case when v_guest.id is null then 'open' else 'invite' end)
    on conflict (event_id, dedupe_key) do update
      set name = excluded.name,
          email = excluded.email,
          phone = excluded.phone,
          attending = excluded.attending,
          party_size = excluded.party_size,
          message = excluded.message
      where public.rsvp_responses.guest_id is not distinct from excluded.guest_id
        and excluded.guest_id is not null;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('status', 'saved', 'events', v_count);
end;
$$;

-- Called only by the guest-upload Edge Function (service role).
create or replace function public.consume_upload_quota(p_ip text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := private.hash_ip(p_ip);
begin
  return private.consume_rate_limit('upload', v_key, 40, interval '1 hour')
     and private.consume_rate_limit('upload-day', v_key, 150, interval '1 day')
     and private.consume_rate_limit('upload-global', 'all', 1500, interval '1 hour');
end;
$$;

-- =============================================================================
-- Admin functions
-- =============================================================================
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'invited_parties', (select count(*) from public.invited_guests),
    'invited_seats', (select coalesce(sum(max_party_size), 0) from public.invited_guests),
    'responding_parties', (select count(distinct dedupe_key) from public.rsvp_responses),
    'responses', (select count(*) from public.rsvp_responses),
    'attending_responses', (select count(*) from public.rsvp_responses where attending),
    'declined_responses', (select count(*) from public.rsvp_responses where not attending),
    'expected_attendees', (select coalesce(sum(party_size), 0) from public.rsvp_responses where attending),
    'pending_greetings', (select count(*) from public.guest_messages where status = 'pending'),
    'pending_photos', (select count(*) from public.wedding_photos where status = 'pending'),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'title', e.title, 'event_date', e.event_date, 'capacity', e.capacity,
        'attending', (select coalesce(sum(r.party_size), 0) from public.rsvp_responses r where r.event_id = e.id and r.attending),
        'declined', (select count(*) from public.rsvp_responses r where r.event_id = e.id and not r.attending),
        'responses', (select count(*) from public.rsvp_responses r where r.event_id = e.id)
      ) order by e.sort_order, e.event_date)
      from public.wedding_events e), '[]'::jsonb)
  );
end;
$$;

-- Function privileges -------------------------------------------------------
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.consume_upload_quota(text) from public, anon, authenticated;
grant execute on function public.consume_upload_quota(text) to service_role;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.submit_greeting(text, text, text, text) to anon, authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, jsonb, text, text, text, text, text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- =============================================================================
-- Storage
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('wedding-photos', 'wedding-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('site-assets', 'site-assets', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Private photo bucket: a file is readable (via signed URL) only once its
-- database row is approved and visible. Pending uploads are never public.
create policy "Read approved wedding photos" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'wedding-photos' and exists (
      select 1 from public.wedding_photos p
      where (p.storage_path = storage.objects.name or p.thumb_path = storage.objects.name)
        and p.status = 'approved'
    )
  );

create policy "Admins manage wedding photos" on storage.objects
  for all to authenticated
  using (bucket_id in ('wedding-photos', 'site-assets') and (select public.is_admin()))
  with check (bucket_id in ('wedding-photos', 'site-assets') and (select public.is_admin()));
