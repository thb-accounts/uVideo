# Backblaze B2 setup for SimpliChill

SimpliChill uploads videos to Backblaze B2 through the server API (`POST /api/backblaze/upload`). The browser no longer receives a presigned Backblaze URL, so Backblaze bucket CORS is not required for the app upload flow.

## Required environment variables

Configure these values on the server before enabling Backblaze uploads:

```bash
BACKBLAZE_B2_KEY_ID=""
BACKBLAZE_B2_APPLICATION_KEY=""
BACKBLAZE_B2_BUCKET_ID=""
BACKBLAZE_B2_BUCKET_NAME=""
BACKBLAZE_B2_UPLOAD_FOLDER="simplichill/videos"
MAX_VIDEO_UPLOAD_BYTES="524288000"
```

The API authorizes with Backblaze, requests a native B2 upload URL server-side, uploads the file bytes, and returns the resulting download URL to the client.
