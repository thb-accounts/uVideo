-- Allow creators to explicitly label uploads as Shorts. The Shorts feed filters
-- on this content type, rather than inferring it from topic, length, or layout.
alter table public.contents
  drop constraint if exists contents_type_check;

alter table public.contents
  add constraint contents_type_check
  check (type in ('video', 'short', 'lesson', 'mini'));

create index if not exists contents_short_feed_idx
  on public.contents (type, status, created_at desc)
  where type = 'short';
