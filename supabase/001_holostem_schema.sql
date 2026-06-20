-- HoloStem core schema
-- Run in the Supabase SQL editor. Safe to re-run; it creates/updates the
-- database objects required by profiles, follows, comments, moderation, and
-- video pinning.

create extension if not exists "pgcrypto";

-- ─── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  display_name text,
  username text,
  avatar_url text,
  bio text,
  age_group text default 'all',
  role text default 'user' check (role in ('user', 'moderator', 'admin')),
  verification_status text default 'pending' check (verification_status in ('pending', 'verified')),
  verified_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists age_group text default 'all';
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists verification_status text default 'pending';
alter table public.profiles add column if not exists verified_at timestamptz;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();
create unique index if not exists profiles_username_unique on public.profiles (username) where username is not null;

-- ─── Content / Videos ────────────────────────────────────────────────────────
create table if not exists public.contents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  username text,
  title text not null,
  description text not null,
  type text not null default 'video' check (type in ('video', 'lesson', 'mini', 'short', 'slim')),
  category text,
  media_url text,
  caption_url text,
  difficulty text,
  points int not null default 10,
  recommended boolean default false,
  is_trending boolean default false,
  is_pinned boolean default false,
  pinned_at timestamptz,
  like_count int not null default 0,
  comment_count int not null default 0,
  status text default 'published' check (status in ('published', 'needs_review', 'removed')),
  moderation_method text,
  moderation_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  moderation_requested_at timestamptz,
  moderation_completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.contents add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.contents add column if not exists username text;
alter table public.contents add column if not exists title text;
alter table public.contents add column if not exists description text;
alter table public.contents add column if not exists type text default 'video';
alter table public.contents drop constraint if exists contents_type_check;
alter table public.contents add constraint contents_type_check check (type in ('video', 'lesson', 'mini', 'short', 'slim'));
alter table public.contents add column if not exists category text;
alter table public.contents add column if not exists media_url text;
alter table public.contents add column if not exists caption_url text;
alter table public.contents add column if not exists difficulty text;
alter table public.contents add column if not exists points int not null default 10;
alter table public.contents add column if not exists recommended boolean default false;
alter table public.contents add column if not exists is_trending boolean default false;
alter table public.contents add column if not exists is_pinned boolean default false;
alter table public.contents add column if not exists pinned_at timestamptz;
alter table public.contents add column if not exists like_count int not null default 0;
alter table public.contents add column if not exists comment_count int not null default 0;
alter table public.contents add column if not exists status text default 'published';
alter table public.contents add column if not exists moderation_method text;
alter table public.contents add column if not exists moderation_reason text;
alter table public.contents add column if not exists reviewed_by uuid references public.profiles(id);
alter table public.contents add column if not exists reviewed_at timestamptz;
alter table public.contents add column if not exists moderation_requested_at timestamptz;
alter table public.contents add column if not exists moderation_completed_at timestamptz;
alter table public.contents add column if not exists created_at timestamptz default now();
alter table public.contents add column if not exists updated_at timestamptz default now();

create index if not exists contents_user_id_idx on public.contents (user_id);
create index if not exists contents_username_idx on public.contents (username);
create index if not exists contents_status_created_idx on public.contents (status, created_at desc);
create index if not exists contents_pinned_idx on public.contents (username, is_pinned desc, pinned_at desc, created_at desc);

-- ─── Engagement ──────────────────────────────────────────────────────────────
create table if not exists public.liked_videos (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.contents(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, content_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.contents(id) on delete cascade,
  user_handle text not null,
  username text,
  body text not null check (char_length(body) > 0),
  status text default 'published' check (status in ('published', 'needs_review', 'removed')),
  moderation_method text,
  moderation_reason text,
  moderation_requested_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.comments add column if not exists username text;
alter table public.comments add column if not exists status text default 'published';
alter table public.comments add column if not exists moderation_method text;
alter table public.comments add column if not exists moderation_reason text;
alter table public.comments add column if not exists moderation_requested_at timestamptz;
alter table public.comments add column if not exists updated_at timestamptz default now();
create index if not exists liked_videos_content_idx on public.liked_videos (content_id);
create index if not exists comments_content_created_idx on public.comments (content_id, created_at);
create index if not exists comments_status_idx on public.comments (status, created_at desc);

-- ─── Follows / Social Lists ──────────────────────────────────────────────────
create table if not exists public.user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists user_follows_follower_idx on public.user_follows (follower_id, created_at desc);
create index if not exists user_follows_following_idx on public.user_follows (following_id, created_at desc);

-- ─── Progress / Views ────────────────────────────────────────────────────────
create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points int not null default 0,
  completed_count int not null default 0,
  level int not null default 1,
  updated_at timestamptz default now()
);

create table if not exists public.user_views (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.contents(id) on delete cascade,
  viewed_at timestamptz default now(),
  primary key (user_id, content_id)
);

create index if not exists user_views_user_viewed_idx on public.user_views (user_id, viewed_at desc);

-- ─── Moderation / Reports ────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('content', 'comment', 'profile')),
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_moderation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  strike_count int not null default 0,
  is_banned boolean not null default false,
  notes text,
  updated_at timestamptz default now()
);

create index if not exists reports_target_idx on public.reports (target_type, target_id);
create index if not exists reports_status_created_idx on public.reports (status, created_at desc);

-- ─── Shared helper functions/triggers ────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('moderator', 'admin')
  );
$$;

create or replace function public.is_verified_auth_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and email_confirmed_at is not null
  );
$$;

create or replace function public.sync_like_count()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    update public.contents set like_count = like_count + 1 where id = new.content_id;
  elsif (tg_op = 'DELETE') then
    update public.contents set like_count = greatest(like_count - 1, 0) where id = old.content_id;
  end if;
  return null;
end;
$$;

create or replace function public.sync_comment_count()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' and coalesce(new.status, 'published') = 'published') then
    update public.contents set comment_count = comment_count + 1 where id = new.content_id;
  elsif (tg_op = 'DELETE' and coalesce(old.status, 'published') = 'published') then
    update public.contents set comment_count = greatest(comment_count - 1, 0) where id = old.content_id;
  elsif (tg_op = 'UPDATE') then
    if coalesce(old.status, 'published') <> 'published' and coalesce(new.status, 'published') = 'published' then
      update public.contents set comment_count = comment_count + 1 where id = new.content_id;
    elsif coalesce(old.status, 'published') = 'published' and coalesce(new.status, 'published') <> 'published' then
      update public.contents set comment_count = greatest(comment_count - 1, 0) where id = old.content_id;
    end if;
  end if;
  return null;
end;
$$;

create or replace function public.add_user_strike(p_user_id uuid, p_increment int default 1, p_notes text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can add user strikes.';
  end if;

  insert into public.user_moderation (user_id, strike_count, is_banned, notes, updated_at)
  values (p_user_id, p_increment, p_increment >= 3, p_notes, now())
  on conflict (user_id) do update
  set strike_count = public.user_moderation.strike_count + excluded.strike_count,
      is_banned = (public.user_moderation.strike_count + excluded.strike_count) >= 3,
      notes = excluded.notes,
      updated_at = now();
end;
$$;

create or replace function public.block_banned_users()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.user_moderation where user_id = new.user_id and is_banned) then
    raise exception 'Banned users cannot create content.';
  end if;
  return new;
end;
$$;

create or replace function public.escalate_on_three_reports()
returns trigger
language plpgsql
as $$
declare
  report_count int;
begin
  select count(*) into report_count
  from public.reports
  where target_type = new.target_type
    and target_id = new.target_id
    and status in ('open', 'reviewing');

  if report_count >= 3 and new.target_type = 'content' then
    update public.contents
    set status = 'needs_review',
        moderation_method = 'user_reports',
        moderation_requested_at = coalesce(moderation_requested_at, now())
    where id = new.target_id;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();

drop trigger if exists contents_touch_updated_at on public.contents;
create trigger contents_touch_updated_at before update on public.contents for each row execute function public.touch_updated_at();

drop trigger if exists comments_touch_updated_at on public.comments;
create trigger comments_touch_updated_at before update on public.comments for each row execute function public.touch_updated_at();

drop trigger if exists reports_touch_updated_at on public.reports;
create trigger reports_touch_updated_at before update on public.reports for each row execute function public.touch_updated_at();

drop trigger if exists liked_videos_sync_like_count on public.liked_videos;
create trigger liked_videos_sync_like_count after insert or delete on public.liked_videos for each row execute function public.sync_like_count();

drop trigger if exists comments_sync_comment_count on public.comments;
create trigger comments_sync_comment_count after insert or update or delete on public.comments for each row execute function public.sync_comment_count();

drop trigger if exists contents_block_banned_users on public.contents;
create trigger contents_block_banned_users before insert on public.contents for each row execute function public.block_banned_users();

drop trigger if exists reports_escalate_on_three_reports on public.reports;
create trigger reports_escalate_on_three_reports after insert on public.reports for each row execute function public.escalate_on_three_reports();

-- Backfill cached counts after migrations or manual edits.
update public.contents c
set like_count = (select count(*) from public.liked_videos l where l.content_id = c.id);

update public.contents c
set comment_count = (
  select count(*)
  from public.comments cm
  where cm.content_id = c.id
    and coalesce(cm.status, 'published') = 'published'
);

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.contents enable row level security;
alter table public.liked_videos enable row level security;
alter table public.comments enable row level security;
alter table public.user_follows enable row level security;
alter table public.user_progress enable row level security;
alter table public.user_views enable row level security;
alter table public.reports enable row level security;
alter table public.user_moderation enable row level security;

drop policy if exists "profiles are public readable" on public.profiles;
create policy "profiles are public readable" on public.profiles for select using (true);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "published contents are public readable" on public.contents;
create policy "published contents are public readable" on public.contents for select using (coalesce(status, 'published') = 'published' or auth.uid() = user_id or public.is_moderator());

drop policy if exists "users insert own contents" on public.contents;
create policy "users insert own contents" on public.contents for insert to authenticated with check (auth.uid() = user_id and public.is_verified_auth_user());

drop policy if exists "users update own contents" on public.contents;
create policy "users update own contents" on public.contents for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete own contents" on public.contents;
create policy "users delete own contents" on public.contents for delete to authenticated using (auth.uid() = user_id or public.is_moderator());

drop policy if exists "moderators update contents" on public.contents;
create policy "moderators update contents" on public.contents for update to authenticated using (public.is_moderator()) with check (public.is_moderator());

drop policy if exists "likes are public readable" on public.liked_videos;
create policy "likes are public readable" on public.liked_videos for select using (true);

drop policy if exists "users manage own likes" on public.liked_videos;
create policy "users manage own likes" on public.liked_videos for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "published comments are public readable" on public.comments;
create policy "published comments are public readable" on public.comments for select using (coalesce(status, 'published') = 'published' or auth.uid() = user_id or public.is_moderator());

drop policy if exists "users create own comments" on public.comments;
create policy "users create own comments" on public.comments for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users delete own comments" on public.comments;
create policy "users delete own comments" on public.comments for delete to authenticated using (auth.uid() = user_id or public.is_moderator());

drop policy if exists "moderators update comments" on public.comments;
create policy "moderators update comments" on public.comments for update to authenticated using (public.is_moderator()) with check (public.is_moderator());

drop policy if exists "follows are public readable" on public.user_follows;
create policy "follows are public readable" on public.user_follows for select using (true);

drop policy if exists "users follow others" on public.user_follows;
create policy "users follow others" on public.user_follows for insert to authenticated with check (auth.uid() = follower_id);

drop policy if exists "users unfollow others" on public.user_follows;
create policy "users unfollow others" on public.user_follows for delete to authenticated using (auth.uid() = follower_id);

drop policy if exists "users read own progress" on public.user_progress;
create policy "users read own progress" on public.user_progress for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users write own progress" on public.user_progress;
create policy "users write own progress" on public.user_progress for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users read own views" on public.user_views;
create policy "users read own views" on public.user_views for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users write own views" on public.user_views;
create policy "users write own views" on public.user_views for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users create reports" on public.reports;
create policy "users create reports" on public.reports for insert to authenticated with check (auth.uid() = reporter_id);

drop policy if exists "users read own reports or moderators read all" on public.reports;
create policy "users read own reports or moderators read all" on public.reports for select to authenticated using (auth.uid() = reporter_id or public.is_moderator());

drop policy if exists "moderators update reports" on public.reports;
create policy "moderators update reports" on public.reports for update to authenticated using (public.is_moderator()) with check (public.is_moderator());

drop policy if exists "users read own moderation or moderators read all" on public.user_moderation;
create policy "users read own moderation or moderators read all" on public.user_moderation for select to authenticated using (auth.uid() = user_id or public.is_moderator());

drop policy if exists "moderators manage user moderation" on public.user_moderation;
create policy "moderators manage user moderation" on public.user_moderation for all to authenticated using (public.is_moderator()) with check (public.is_moderator());

-- ─── Starter content for local smoke testing ─────────────────────────────────
insert into public.contents (title, description, type, category, media_url, points, recommended, is_trending, status)
values
  ('Solar Systems in 60 Seconds', 'A fast visual introduction to planets and orbits.', 'video', 'Science', 'https://www.youtube.com/embed/libKVRa01L8', 20, true, true, 'published'),
  ('Build Better Study Habits', 'Interactive tips for daily progress and focus.', 'lesson', 'Learning', 'https://www.youtube.com/embed/IlU-zDU6aQ0', 15, true, false, 'published'),
  ('Reaction Mini Experience', 'Tap quickly to train your reaction timing.', 'mini', 'Experience', '', 30, false, true, 'published')
on conflict do nothing;
