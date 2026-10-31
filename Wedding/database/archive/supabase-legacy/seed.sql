-- Starter data. Safe to run more than once.
-- Contains no personal details — edit everything from /admin.

insert into public.wedding_settings (id) values (1) on conflict (id) do nothing;

insert into public.photo_albums (slug, title, description, sort_order, is_guest_uploads)
values
  ('couple', 'The Couple', 'Portraits of the two of us.', 10, false),
  ('pre-wedding', 'Pre-Wedding', 'Moments from our pre-wedding shoot.', 20, false),
  ('ceremony', 'Ceremony', 'Highlights from the big day.', 30, false),
  ('guest-memories', 'Guest Memories', 'Photos shared by our wonderful guests.', 40, true)
on conflict (slug) do nothing;

-- To make a user an administrator (after creating them in Authentication → Users):
--   insert into public.admin_profiles (user_id, display_name)
--   select id, 'Admin' from auth.users where email = 'you@example.com';
