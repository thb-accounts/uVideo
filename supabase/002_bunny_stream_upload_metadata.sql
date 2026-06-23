alter table public.contents add column if not exists storage_provider text default 'bunny_stream';
alter table public.contents add column if not exists storage_key text;
alter table public.contents add column if not exists bunny_video_id text;
alter table public.contents add column if not exists bunny_library_id text;
alter table public.contents add column if not exists cloudinary_public_id text;
alter table public.contents add column if not exists upload_status text default 'uploading';
alter table public.contents add column if not exists encoding_status text;
alter table public.contents add column if not exists processing_error text;
alter table public.contents add column if not exists uploaded_at timestamptz;
alter table public.contents add column if not exists ready_at timestamptz;

create unique index if not exists contents_bunny_video_id_unique on public.contents (bunny_video_id) where bunny_video_id is not null;
create index if not exists contents_storage_provider_idx on public.contents (storage_provider);
create index if not exists contents_upload_status_idx on public.contents (upload_status);

alter table public.contents drop constraint if exists contents_storage_provider_check;
alter table public.contents add constraint contents_storage_provider_check check (storage_provider in ('bunny_stream', 'cloudinary', 'external'));
alter table public.contents drop constraint if exists contents_single_video_provider_check;
alter table public.contents add constraint contents_single_video_provider_check check (
  (storage_provider = 'bunny_stream' and bunny_video_id is not null and cloudinary_public_id is null)
  or (storage_provider = 'cloudinary' and cloudinary_public_id is not null and bunny_video_id is null)
  or (storage_provider = 'external' and bunny_video_id is null and cloudinary_public_id is null)
  or storage_provider is null
);
