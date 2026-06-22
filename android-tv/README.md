# SimpliChill Android TV

Native Android TV client for the existing SimpliChill/UVideo API.

## API

The API origin is centralized in `app/src/main/java/site/unrealcake8/simplichilltv/data/ApiConfig.kt`:

```kotlin
https://simplichill.unrealcake8.site/api/
```

The app calls `GET videos/feed`, which maps to the existing Express route mounted at `/api/videos/feed` and consumes the existing `{ "videos": [...] }` response. Models accept both the Express fields (`videoUrl`, `caption`, `thumbnail`, `author`, `_count`) and existing content-style fields (`media_url`, `thumbnail_url`, `title`, `username`, `created_at`). Playback uses the resolved `media_url`/`mediaUrl`/`videoUrl` directly.

## Build and run in Android Studio

1. Open Android Studio.
2. Select **File > Open** and choose the repository root (`uVideo`). Android Studio will detect the `:android-tv:app` Gradle module.
3. Let Gradle sync complete. If you prefer opening only the TV app, you can open the `android-tv` folder directly.
4. Create or select an Android TV emulator, such as **Android TV (1080p)**.
5. Select the `app` run configuration.
6. Click **Run**.

## Debug APK command

From the repository root:

```bash
gradle :android-tv:app:assembleDebug
```

The APK will be written to:

```text
android-tv/app/build/outputs/apk/debug/app-debug.apk
```
