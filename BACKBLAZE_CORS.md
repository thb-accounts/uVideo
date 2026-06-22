# Backblaze B2 CORS setup for SimpliChill

SimpliChill uploads videos directly from the browser to Backblaze B2 using S3-compatible presigned PUT URLs. Configure CORS on the B2 bucket before production testing.

## Required origins

Do not use wildcard origins in production. Allow only:

- `https://simplichill.unrealcake8.site`
- `http://localhost:5173`
- `http://localhost:3000`

## Required method

- `PUT`

## Required headers

Allow the headers used by browser S3 presigned uploads:

- `content-type`
- `x-amz-content-sha256`
- `x-amz-date`
- `x-amz-security-token`
- `authorization`

## Example rule

```json
[
  {
    "corsRuleName": "simplichill-direct-video-uploads",
    "allowedOrigins": [
      "https://simplichill.unrealcake8.site",
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    "allowedOperations": ["s3_put"],
    "allowedHeaders": [
      "content-type",
      "x-amz-content-sha256",
      "x-amz-date",
      "x-amz-security-token",
      "authorization"
    ],
    "exposeHeaders": ["etag"],
    "maxAgeSeconds": 3600
  }
]
```

The app should show a small JSON `POST /api/backblaze/presign-upload`, then the actual video bytes in a direct `PUT` to the configured `BACKBLAZE_B2_S3_ENDPOINT`.
