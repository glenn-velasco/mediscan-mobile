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

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

## Web / iOS PWA Build & Deployment (`https://app.mediscan.cloud`)

MediScan can be exported as a static Single-Page Application (SPA) and installable Progressive Web App (PWA) for iOS Safari ("Add to Home Screen") and desktop/mobile browsers:

```sh
npm run build:web
```

Output: `dist/` (static routes + `wa-sqlite.wasm` WebAssembly worker + `public/manifest.json` + `public/_headers`).

### Required HTTP Headers for SQLite WASM

`expo-sqlite` on Web requires cross-origin isolation headers so the browser allows `SharedArrayBuffer` / OPFS worker execution. These are configured automatically in `vercel.json`, `public/_headers`, and `app.json`:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: credentialless`

### Deploy to Vercel

```sh
npx vercel --prod --yes
```

Ensure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are configured in the Vercel project environment variables (`maddators-projects/mediscan-mobile`), and add `https://app.mediscan.cloud/auth/callback` to Supabase Auth → URL Configuration → Redirect URLs.

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

### Unsigned iOS `.ipa` Build (`.github/workflows/ios-unsigned.yml`)

- **Triggers:** manual dispatch (`workflow_dispatch`)
- **Runner:** `macos-15` (GitHub Actions free macOS runner)
- **Output:** `MediScan-unsigned.ipa` artifact (14-day retention)
- **Status:** Working without a paid Apple Developer account (`CODE_SIGNING_ALLOWED=NO`). Can be sideloaded onto physical iPhones using **Sideloadly** or **AltStore** with a free Apple ID.

### Signed iOS Build (`.github/workflows/ios-build.yml`)

- **Triggers:** push to `main`, or manual dispatch
- **Runner:** macOS
- **Status:** Template for Apple Developer Program signed distribution when `.p12` and `.mobileprovision` certificates are added

### GitHub Repository Secrets

Configure these secrets in **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL (`https://<project-ref>.supabase.co`) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `ANDROID_KEYSTORE` | Base64 encoded keystore *(optional)* |
| `IOS_CERTIFICATE` | Base64 encoded `.p12` *(signed iOS build only)* |
| `IOS_CERTIFICATE_PASSWORD` | Certificate password *(signed iOS build only)* |
| `IOS_PROVISIONING_PROFILE` | Base64 encoded `.mobileprovision` *(signed iOS build only)* |

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
