-- Run in the Supabase SQL editor before enabling MPlace video ads.
create table if not exists public.video_ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  media_url text not null,
  destination_url text,
  skippable boolean not null default true,
  skip_after integer not null default 5 check (skip_after between 0 and 120),
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.video_ad_events (
  id bigint generated always as identity primary key,
  ad_id uuid not null references public.video_ads(id) on delete cascade,
  event text not null check (event in ('play', 'skip', 'click')),
  created_at timestamptz not null default now()
);
alter table public.video_ads enable row level security;
alter table public.video_ad_events enable row level security;
revoke all on public.video_ads, public.video_ad_events from anon, authenticated;
-- Only the server's service-role client can access these tables.
