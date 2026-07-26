# Developer Onboarding

## Prerequisites

- Node.js, whichever LTS release Expo SDK 57 currently supports
- JDK 17
- Android Studio, which provides the Android SDK, `adb`, and the Virtual Device Manager
- `ANDROID_HOME` set to `%LOCALAPPDATA%\Android\Sdk`, with its `platform-tools` and `emulator` folders added to `PATH`
- A physical Android device, connected either way:
  - USB cable, with USB debugging enabled (Developer options → USB debugging) — simplest option if you have a cable and matching driver
  - Wireless debugging (Developer options → Wireless debugging), useful if you're without a cable — see [Connecting a Device Wirelessly](#connecting-a-device-wirelessly) below
- Or an emulator created in Android Studio's Virtual Device Manager, if your machine can handle running one

## Installation

```
git clone <repo-url>
cd mediscan-mobile
npm install
```

`expo-dev-client` and `app.json` are already configured — no reconfiguration needed after install.

## Connecting a Device Wirelessly

If you don't have a USB cable handy, Android 11+ supports pairing over Wi-Fi:

1. On the phone: Developer options → Wireless debugging → Pair device with pairing code. This shows an IP, a port, and a 6-digit code.
2. On the laptop: `adb pair <ip>:<port>`, then enter the code.
3. Back on the Wireless debugging screen, note the separate IP and port shown for connecting.
4. `adb connect <ip>:<port>`, then confirm with `adb devices`.

Pairing only needs to happen once per network; after that, `adb connect` alone reconnects you.

## Running the App

Confirm a device or emulator is connected:

```
adb devices
```

Build and install the dev client:

```
npx expo run:android
```

The first run builds the native project from scratch, so it's noticeably slower than every run after it. Once installed, use Metro for everyday development:

```
npx expo start --dev-client
```

Reload the app to pick up JS changes; re-run `npx expo run:android` only when native config changes (`app.json`, plugins, native dependencies).

## Project Structure

- `src/app/` — screens and layouts, using [Expo Router](https://docs.expo.dev/router/introduction) file-based routing
- `android/`, `ios/` — generated native projects; gitignored, regenerated on demand, never hand-edited

## Useful to Know

- This project targets **Expo SDK 57**. Expo's APIs have changed significantly across versions — check the version-specific docs before assuming an API works as in older SDKs or training data.
- Native folders regenerate automatically from config, so a native-affecting `app.json` change doesn't require a merge — everyone just re-runs `npx expo run:android` to pick it up locally.
