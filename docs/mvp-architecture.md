# UVideo MVP Architecture

UVideo stays named UVideo until final branding is chosen. The MVP optimizes for creation, learning, sharing, and healthy usage rather than popularity contests.

## Backend architecture

- Express API with Prisma/PostgreSQL persistence.
- Users are created with `verificationStatus = unverified` and can be upgraded only by Didit webhook results.
- S3 presigned uploads keep AWS credentials on the server. Browsers receive a single-use HTTPS upload URL, never AWS secret keys.
- CloudFront is the only public playback path for approved videos.
- Moderator APIs review videos, quick chat phrase suggestions, audio submissions, and reports. Audit logs record moderator actions.

## Didit integration

1. User signs up as unverified.
2. `/api/verification/didit/start` returns a Didit redirect URL with UVideo's user id as external metadata.
3. Didit verifies age and posts to `/api/verification/didit/webhook`.
4. UVideo stores only `verificationStatus`, `verificationProvider = didit`, and `verifiedAt`.
5. UVideo never stores passports, IDs, selfies, birth dates, or verification documents.

## API endpoints

- `POST /api/auth/register` creates an unverified account with a generated avatar seed.
- `POST /api/videos/uploads/presign` creates a pending video row and S3 presigned PUT URL.
- `POST /api/videos/:videoId/uploads/complete` confirms browser upload completion.
- `GET /api/videos/moderation/pending` lists pending videos for moderators.
- `POST /api/videos/:videoId/moderation` approves or rejects a video.
- `GET /api/quick-chat/phrases` lists approved phrases.
- `POST /api/quick-chat/suggestions` submits a phrase for human review.
- `POST /api/quick-chat/suggestions/:id/review` approves or rejects a phrase.

## Frontend components to ship

- Upload wizard: select file, request presigned URL, PUT directly to S3, show awaiting-review state.
- Generated avatar component based on `generatedAvatarSeed` and `generatedAvatarVariant` using animal, abstract icon, and color-pair palettes.
- Quick Chat panel that renders approved phrases only for verified 15+ users.
- Healthy Shorts interruption card after extended viewing with facts, coding tips, science facts, geography challenges, history facts, or MathArt visual prompts.
- Moderator dashboard tabs for videos, audio, reports, quick chat suggestions, and audit logs.

## Security considerations

- Do not expose AWS credentials to clients.
- Presigned URLs should expire quickly and be scoped to one `pending/user-id/video-id.ext` object.
- Validate content type and file size at API and S3 policy layers.
- Do not store Didit documents or exact birth dates.
- Apply profanity and bypass detection before accepting usernames, video titles, quick chat suggestions, and audio submissions.
- Use moderator override through review endpoints, not by disabling automated filters.
