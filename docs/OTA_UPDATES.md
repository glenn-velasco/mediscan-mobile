# OTA Updates (EAS Update) — Setup to Shipping

How to push JS/asset changes to installed builds without a new store submission or APK install, from zero to a published update. This repo already has most of the setup done (see "Current state in this repo" below) — the steps are included anyway so this doc stands alone.

## What this can and can't do

- **Can**: push changed JS, assets, and other OTA-updatable content to devices running an existing native build.
- **Can't**: change native code, native config (`app.json` native fields), or add/upgrade native dependencies/SDK modules. Any of those require a new build via `eas build` (and, for production, a new store release or APK install).

## 0. Prerequisites

- An Expo account: `eas login` (or `npx eas-cli login`). Check who's logged in with `eas whoami`.
- `eas-cli` available — this repo already depends on it via `expo`/`eas.json`'s `cli.version`, so `npx eas-cli <command>` works without a global install.
- The project already linked to an EAS project — confirm via `extra.eas.projectId` in [app.json](../app.json). This repo has one: `536d2ff6-5e5f-4e00-8afb-35584d94b29f`.

## 1. Install and configure `expo-updates`

```sh
npx expo install expo-updates
npx eas update:configure
```

`eas update:configure` is idempotent — safe to (re)run any time. It writes/verifies:
- `updates.url` and `runtimeVersion.policy` in `app.json`
- a `channel` field per build profile in `eas.json`
- the corresponding channels registered on the EAS Update backend

## 2. Map build profiles to channels

Every build profile in `eas.json` needs a `channel` so installed builds know which update stream to poll. One channel per environment, matching the profile name:

```jsonc
// eas.json
"build": {
  "development": { "channel": "development", ... },
  "preview":     { "channel": "preview", ... },
  "production":  { "channel": "production", ... }
}
```

A build only ever polls the channel baked in at build time — changing the channel later requires a new build.

## 3. Add update-check/apply logic to the app

`expo-updates` checks for updates automatically on launch by default (`checkAutomatically: "ON_LOAD"`), downloads them in the background, and applies them on the *next* cold start. To let users apply a downloaded update immediately instead of waiting for a relaunch, use the `useUpdates()` hook:

```ts
import * as Updates from 'expo-updates';

const { isUpdatePending, isDownloading, downloadError } = Updates.useUpdates();
// isUpdatePending === true once a new bundle has finished downloading
// call Updates.reloadAsync() to apply it right away
```

## 4. Build once per channel

Before OTA updates can reach a device, that device needs a native build carrying the right channel + a compatible `runtimeVersion`:

```sh
eas build --profile development --platform android
eas build --profile preview --platform android
eas build --profile production --platform android
```

(swap `--platform` for `ios` as needed). Install that build on the test device once — after that, OTA updates land in-place.

## 5. Publish an update

Publish to the branch matching the channel you want to update (branch and channel share the same name in this repo):

```sh
eas update --branch production --message "short description of the change"
eas update --branch preview --message "short description of the change"
eas update --branch development --message "short description of the change"
```

Only devices running a build whose channel matches, **and** whose runtime version matches the update's runtime version, will receive it.

## `runtimeVersion.policy: "fingerprint"`

Update compatibility is scoped by runtime version. This repo uses the `"fingerprint"` policy: instead of a manually-maintained version string, `eas-cli` hashes the actual native project (config + native files + dependencies) and uses that hash as the runtime version — automatically, every build and every publish. Practically:

- Any change that actually affects native output (new permission, native module, config plugin change, SDK bump) changes the fingerprint automatically → a new build is required before that channel can receive further OTA updates. No manual version bump needed or expected.
- Pure JS/asset changes don't change the fingerprint → they can go out as OTA updates indefinitely against the same build.
- To inspect the current fingerprint locally: `npx expo-updates fingerprint:generate` (or check the `Computing project fingerprints` step's output during `eas update`/`eas build`).
- Chosen over the simpler `"appVersion"` policy specifically because this project anticipates multiple developers touching native config — fingerprinting removes the human-error case of someone forgetting to bump `expo.version` after a native change, at the cost of the compatibility marker being an opaque hash instead of a human-readable version number.

## Rollout / rollback

- `eas update:list --branch <branch>` — see published update groups on a branch.
- `eas update:republish` — republish an earlier update to "roll back" a channel to a previous JS bundle without a new build.

## Current state in this repo

- `expo-updates@~57.0.6` installed; `app.json` has `updates.url` and `runtimeVersion.policy: "appVersion"` set.
- `eas.json` build profiles each have a matching channel (`development`, `preview`, `production`), and the `preview` channel is confirmed registered on the EAS backend.
- [src/hooks/use-app-updates.ts](../src/hooks/use-app-updates.ts) wraps `Updates.useUpdates()` and **silently** applies a downloaded update the next time the app returns to the foreground (via `AppState`) — no user-facing button. It also logs `[updates] running updateId=...` and reload events to the JS console for verification (`adb logcat | grep ReactNativeJS`).
- Verified end-to-end on a physical device: publish → silent background download → auto-reload on next foreground, confirmed via device logs.
- **Note**: publishing with `eas update` (no `--platform` filter) currently fails during web bundling due to an unrelated `expo-sqlite` web/wasm resolution bug — scope publishes with `--platform android` (or `android,ios`) until that's fixed.

## Verify before relying on flags/behavior

Expo SDK/CLI behavior shifts between versions (see [AGENTS.md](../AGENTS.md)). Re-check exact flags and hook shapes against the versioned docs for the SDK in [package.json](../package.json) (currently `~57.0.x`): https://docs.expo.dev/versions/v57.0.0/sdk/updates/
