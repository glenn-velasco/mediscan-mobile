import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const root = process.cwd();
const target = process.argv[2]; // patch, minor, major, or exact version like "1.2.3"

function readJson(file) {
  return JSON.parse(readFileSync(join(root, file), "utf8"));
}

function writeJson(file, data) {
  writeFileSync(join(root, file), JSON.stringify(data, null, 2) + "\n");
}

function bumpVersion(current, type) {
  const [major, minor, patch] = current.split(".").map(Number);
  switch (type) {
    case "major": return `${major + 1}.0.0`;
    case "minor": return `${major}.${minor + 1}.0`;
    case "patch": return `${major}.${minor}.${patch + 1}`;
    default: return type; // exact version
  }
}

function incrementVersionCode(gradleContent) {
  const match = gradleContent.match(/versionCode\s+(\d+)/);
  if (!match) return gradleContent;
  const newCode = parseInt(match[1], 10) + 1;
  return gradleContent.replace(/versionCode\s+\d+/, `versionCode ${newCode}`);
}

// Read current version
const pkg = readJson("package.json");
const currentVersion = pkg.version;

// Calculate new version
const newVersion = ["patch", "minor", "major"].includes(target)
  ? bumpVersion(currentVersion, target)
  : target;

if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error(`Invalid version: ${newVersion}. Use patch, minor, major, or x.y.z`);
  process.exit(1);
}

console.log(`Bumping version: ${currentVersion} → ${newVersion}`);

// Update package.json
pkg.version = newVersion;
writeJson("package.json", pkg);

// Update app.json
const appJson = readJson("app.json");
appJson.expo.version = newVersion;
writeJson("app.json", appJson);

// Update android/app/build.gradle
const gradlePath = join(root, "android", "app", "build.gradle");
let gradle = readFileSync(gradlePath, "utf8");
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${newVersion}"`);
gradle = incrementVersionCode(gradle);
writeFileSync(gradlePath, gradle);

// Extract new versionCode for display
const versionCodeMatch = gradle.match(/versionCode\s+(\d+)/);
const versionCode = versionCodeMatch ? versionCodeMatch[1] : "?";

console.log(`Updated:`);
console.log(`  package.json  → ${newVersion}`);
console.log(`  app.json      → ${newVersion}`);
console.log(`  build.gradle  → versionName "${newVersion}" / versionCode ${versionCode}`);
