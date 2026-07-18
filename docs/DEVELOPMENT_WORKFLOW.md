# Development → Deployment Workflow

## The one thing to internalize first

**`android/` and `ios/` are gitignored and disposable.** This project uses Expo's Continuous Native Generation (CNG): those folders are regenerated on demand by `expo prebuild` (which `eas build` always runs internally, and `expo run:android`/`expo run:ios` typically re-sync too) from `app.json` config and the plugins in [plugins/](../plugins/). Anything hand-edited directly inside `android/`/`ios/` — a manifest permission, a native `.kt`/`.swift` file, a gradle tweak — will be **silently wiped** the next time those folders are regenerated. If you ever catch yourself editing a file under `android/` or `ios/` directly, stop and ask whether it should be config instead.

Confirm this anytime with `git ls-files android` — it should return nothing.

## Day-to-day JS/UI work

Use whatever's fastest for the loop you're in:
```sh
npm run android   # or npm run ios
```
or open the project in Android Studio / Xcode and hit Run. Both drive the same underlying Gradle/Xcode build against the locally-generated native folders — no config-plugin discipline needed for pure JS, component, or asset changes.

## Any change that touches native behavior

Examples: a new permission, a native module, a manifest tweak, a gradle change, a custom native resource.

- **Simple permission additions**: use the `android.permissions` array in [app.json](../app.json) — Expo's built-in permissions plugin merges these into the manifest automatically. No custom plugin needed (this is how `SYSTEM_ALERT_WINDOW`, `VIBRATE`, and `RECORD_AUDIO` are declared here).
- **Anything else** (manifest structure, native source edits, resource/style changes): write a config plugin under [plugins/](../plugins/) using `@expo/config-plugins` mods (`withAndroidManifest`, `withMainActivity`, `withAndroidStyles`, etc.), and register it in `app.json`'s `"plugins"` array. Follow the existing examples:
  - [plugins/withUserLeaveHintFix.js](../plugins/withUserLeaveHintFix.js) — patches `MainActivity.kt`
  - [plugins/withSplashWindowBackground.js](../plugins/withSplashWindowBackground.js) — patches `styles.xml`

**Verify a native/config change lands correctly:**
```sh
npx expo prebuild --clean --platform android
```
This wipes and regenerates `android/` from scratch — re-inspect the relevant generated file to confirm your plugin/config applied as expected before relying on it.

## Testing native changes locally (no cloud, no EAS usage)

For quickly verifying a native/permission/config change on your own device without touching EAS at all:

```sh
adb devices -l                      # list connected devices, confirm yours shows up
npm run android                     # builds a debug APK and installs+launches it on a connected device
```
If multiple devices are connected, this prompts you to pick one interactively.

**Caveat**: a debug build from this command has no update channel embedded, so it can never receive `eas update` OTA updates — it's for verifying native behavior only (permissions, layout, splash/window background, etc.), not for testing the update mechanism.

**If a different app build (e.g. a previous `eas build` APK) is already installed on the device**, installing a debug build over it will fail with a signing mismatch (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`) since debug and EAS-signed builds use different keys. Fix by uninstalling first — **this wipes that app's local data on the device**:
```sh
adb -s <device-serial> uninstall com.application.mediscanmobile
npm run android
```
Get `<device-serial>` from the `adb devices -l` output (e.g. `192.168.254.147:38811`).

**Building a release variant via Android Studio** (Build → Generate Signed Bundle/APK) works the same way, fully local — but note `android/app/build.gradle`'s `release` build type currently points `signingConfig` at the same debug keystore as `debug` (no dedicated release keystore is configured yet in this project), so a "release" build here is an optimized build for local testing, not a Play-Store-ready signed artifact.

## Testing OTA-only (JS/asset) changes

No rebuild needed — publish straight to a channel:
```sh
eas update --branch preview --message "..." --platform android
```
See [docs/OTA_UPDATES.md](OTA_UPDATES.md) for the full setup, channel mapping, and verification workflow (silent auto-apply is already wired up via [src/hooks/use-app-updates.ts](../src/hooks/use-app-updates.ts)).

## Testing native changes / SDK bumps

OTA cannot carry native changes or SDK upgrades under any circumstances — always requires a new build:
```sh
eas build --profile preview --platform android
```
Local Android builds (`eas build --local`) aren't supported on Windows; use the cloud build, or a Linux/WSL environment if you specifically need `--local`.

## Shipping to users, end to end

1. Native/config change → `eas build --profile preview` → install and verify on a test device.
2. Once confirmed, `eas build --profile production` → `eas submit` to the app store (this is the only point a store release/APK reinstall is required).
3. From then on, pure JS/asset iterations ship via `eas update --branch production` — no store submission, no reinstall — until the next native change or SDK bump forces another `eas build` + `eas submit` cycle.
