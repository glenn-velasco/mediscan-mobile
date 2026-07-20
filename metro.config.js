const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Every `npx expo run:android` / Gradle build regenerates tens of thousands of CMake
// intermediate object files under android/.cxx (project + every native module in node_modules)
// and android/app/build. Metro's file watcher crawls these by default on Windows (no Watchman),
// and after a native rebuild that crawl can take minutes — during which bundle requests just
// hang, looking like the app is frozen. Excluding them keeps the watcher fast and JS-only.
const existingBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList
    ? [config.resolver.blockList]
    : [];

config.resolver.blockList = [
  ...existingBlockList,
  /android[\\/]app[\\/]build[\\/].*/,
  /android[\\/]\.cxx[\\/].*/,
  /android[\\/]app[\\/]\.cxx[\\/].*/,
  /node_modules[\\/].*[\\/]android[\\/]\.cxx[\\/].*/,
  /node_modules[\\/].*[\\/]android[\\/]build[\\/].*/,
  /ios[\\/]build[\\/].*/,
];

module.exports = withNativewind(config, { input: "./src/global.css" });
