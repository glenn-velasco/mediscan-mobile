const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const SW_PATH = path.join(DIST_DIR, 'sw.js');

function walkFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function shouldPrecacheAsset(urlPath) {
  if (urlPath.startsWith('/_expo/static/')) return true;
  if (urlPath.startsWith('/assets/assets/')) return true;
  if (urlPath.startsWith('/assets/node_modules/expo-sqlite/')) return true;
  if (urlPath.startsWith('/assets/node_modules/expo-router/')) return true;
  if (
    urlPath.startsWith('/assets/node_modules/@expo/vector-icons/') &&
    (urlPath.includes('/Ionicons.') || urlPath.includes('/MaterialIcons.'))
  ) {
    return true;
  }
  return false;
}

function main() {
  if (!fs.existsSync(SW_PATH)) {
    console.warn('[inject-sw-precache] dist/sw.js not found, skipping precache injection.');
    return;
  }

  const allFiles = [
    ...walkFiles(path.join(DIST_DIR, '_expo', 'static')),
    ...walkFiles(path.join(DIST_DIR, 'assets')),
  ];

  const precacheUrls = allFiles
    .map((filePath) => '/' + path.relative(DIST_DIR, filePath).replace(/\\/g, '/'))
    .filter(shouldPrecacheAsset)
    .sort();

  const versionHash = crypto
    .createHash('sha256')
    .update(precacheUrls.join('\n'))
    .digest('hex')
    .slice(0, 12);

  let swContent = fs.readFileSync(SW_PATH, 'utf8');
  swContent = swContent.replace('__SW_CACHE_VERSION__', `v1-${versionHash}`);
  swContent = swContent.replace(
    '/* __SW_PRECACHE_ASSETS__ */ []',
    JSON.stringify(precacheUrls, null, 2),
  );

  fs.writeFileSync(SW_PATH, swContent, 'utf8');
  console.log(
    `[inject-sw-precache] Injected ${precacheUrls.length} precache assets into dist/sw.js (version: v1-${versionHash})`,
  );
}

main();
