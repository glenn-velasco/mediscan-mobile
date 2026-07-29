# Build Guide

## Local Builds (Android)

### Prerequisites

- JDK 17
- Android SDK (`ANDROID_HOME` set)
- Expo prebuild: `npx expo prebuild --platform android --clean`

### Debug Build

```sh
npm run build:debug
# or
cd android && ./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Release Build (with production env)

```sh
npm run build:preview
```

This copies `.env.production` → `.env`, builds, then restores the original `.env`.

Output: `android/app/build/outputs/apk/release/app-release.apk`

### Install on Device

```sh
adb install android/app/build/outputs/apk/release/app-release.apk
```

## Environment Variables

| File | Purpose |
|---|---|
| `.env` | Local development (gitignored) |
| `.env.production` | Production build values |
| `.env.example` | Template for required variables |

All variables must be prefixed with `EXPO_PUBLIC_` to be readable from app code.

### Required Variables

```
EXPO_PUBLIC_API_URL=https://app.mediscan.cloud
EXPO_PUBLIC_REVERB_APP_KEY=your-key
EXPO_PUBLIC_REVERB_HOST=app.mediscan.cloud
EXPO_PUBLIC_REVERB_PORT=443
EXPO_PUBLIC_REVERB_SCHEME=wss
```

## Versioning

Versions are stored in 3 places and updated together:

- `package.json` → `"version"`
- `app.json` → `"expo.version"`
- `android/app/build.gradle` → `versionName` + `versionCode`

### Bump Version

```sh
npm run bump:patch    # 1.0.0 → 1.0.1
npm run bump:minor    # 1.0.0 → 1.1.0
npm run bump:major    # 1.0.0 → 2.0.0
npm run version 1.5.0 # set exact version
```

Always bump version before building a release APK.

## GitHub Actions

Workflows are in `.github/workflows/`.

### Android Preview Build

- **Triggers:** push to `main`/`develop`, or manual dispatch
- **Runner:** Ubuntu (Linux)
- **Output:** APK artifact (14-day retention)
- **Status:** Fully working

### iOS Build

- **Triggers:** push to `main`, or manual dispatch
- **Runner:** macOS
- **Status:** Placeholder until Apple certificates are added

### GitHub Environments

Create a `preview` environment in **Settings → Environments**:

1. Click **New environment** → name it `preview`
2. Add **secrets**:

| Secret | Description |
|---|---|
| `API_URL` | Backend API URL |
| `REVERB_APP_KEY` | Reverb/broadcasting key |
| `REVERB_HOST` | Reverb host |
| `REVERB_PORT` | Reverb port |
| `REVERB_SCHEME` | `ws` or `wss` |
| `ANDROID_KEYSTORE` | Base64 encoded keystore *(optional)* |
| `IOS_CERTIFICATE` | Base64 encoded `.p12` *(iOS only)* |
| `IOS_CERTIFICATE_PASSWORD` | Certificate password *(iOS only)* |
| `IOS_PROVISIONING_PROFILE` | Base64 encoded `.mobileprovision` *(iOS only)* |

### iOS Certificate Setup (when ready)

1. Export your distribution certificate as `.p12`
2. Export your provisioning profile as `.mobileprovision`
3. Base64 encode both:
   ```sh
   base64 -i certificate.p12 | pbcopy
   base64 -i profile.mobileprovision | pbcopy
   ```
4. Add as secrets in the `preview` environment
5. Uncomment the build steps in `.github/workflows/ios-build.yml`

## Build Workflow Summary

```
┌─────────────────────────────────────────────────┐
│  Version Bump                                   │
│  npm run bump:patch                             │
├─────────────────────────────────────────────────┤
│  Local Build                                    │
│  npm run build:preview                          │
├─────────────────────────────────────────────────┤
│  CI Build (auto on push)                        │
│  Android: GitHub Actions → APK artifact         │
│  iOS: waiting for certificates                  │
├─────────────────────────────────────────────────┤
│  Install on Device                              │
│  adb install app-release.apk                    │
└─────────────────────────────────────────────────┘
```
