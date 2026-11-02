-- Public bucket for the downloadable APK (permanent link shared on WhatsApp).
-- Anyone can download; nobody can upload through the API (no insert policies),
-- uploads use the service role from the release script.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('apk', 'apk', true, 104857600, array['application/vnd.android.package-archive'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
