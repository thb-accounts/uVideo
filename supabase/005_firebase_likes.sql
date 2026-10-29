-- Replace legacy auth.uid() policies: Firebase subjects are not UUIDs.
-- mplace_current_user_uuid() is the existing shared MPlace identity helper.
begin;
drop policy if exists "user manage own likes" on public.liked_videos;
drop policy if exists "users manage own likes" on public.liked_videos;
create policy "users manage own likes" on public.liked_videos
for all to authenticated
using (user_id = (select public.mplace_current_user_uuid()))
with check (user_id = (select public.mplace_current_user_uuid()));
commit;
