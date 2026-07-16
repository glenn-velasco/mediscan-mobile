/**
 * Reads src/global.css, extracts every CSS variable defined under :root (light)
 * and @media (prefers-color-scheme: dark) { :root } (dark), and prints a
 * ready-to-paste TypeScript Colors object. Supports both oklch() and hex values.
 *
 * Usage: node scripts/sync-theme-colors.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { oklch, formatHex } from 'culori';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(__dirname, '../src/global.css');
const css = readFileSync(cssPath, 'utf-8');

const toCamelCase = (name) =>
  name
    .replace(/^--/, '')
    .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/-(\d+)/g, (_, d) => d);

function extractVarMap(text) {
  const map = {};
  // Match either oklch() or hex values
  const re = /--([\w-]+):\s*(oklch\([^)]+\)|#[0-9a-fA-F]{3,8})\s*;/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const raw = match[1];
    const value = match[2].trim();
    map[raw] = value;
  }
  return map;
}

function valueToHex(value) {
  // If it's already a hex value, return it
  if (value.startsWith('#')) {
    // Normalize 3-char hex to 6-char
    if (value.length === 4) {
      return '#' + value[1] + value[1] + value[2] + value[2] + value[3] + value[3];
    }
    return value.toLowerCase();
  }
  // If it's oklch, convert
  const oklchMatch = value.match(/oklch\(([^)]+)\)/);
  if (oklchMatch) {
    const parts = oklchMatch[1].split(/\s+/).filter(Boolean);
    if (parts.length === 3) {
      const [L, C, H] = parts.map(Number);
      const color = oklch({ mode: 'oklch', l: L, c: C, h: H });
      if (color) return formatHex(color);
    }
  }
  return null;
}

const lightRoot = css.match(/:root\s*\{([^}]+)\}/)?.[1];
const darkMatch = css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[^}]*:root\s*\{([^}]+)\}/);
const darkRoot = darkMatch?.[1];

if (!lightRoot) {
  console.error('Could not find :root block in global.css');
  process.exit(1);
}

const lightMap = extractVarMap(lightRoot);
const darkMap = darkRoot ? extractVarMap(darkRoot) : {};

const orderedKeys = [
  'background', 'foreground',
  'card', 'card-foreground',
  'popover', 'popover-foreground',
  'primary', 'primary-foreground',
  'secondary', 'secondary-foreground',
  'muted', 'muted-foreground',
  'accent', 'accent-foreground',
  'destructive', 'destructive-foreground',
  'border', 'input', 'ring',
  'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5',
  'success', 'success-foreground',
  'warning', 'warning-foreground',
  'critical', 'critical-foreground',
];

const lines = [];
lines.push('/**');
lines.push(' * Auto-generated from src/global.css — Do not hand-edit these hex values.');
lines.push(' * After changing src/global.css, run: npm run sync-theme-colors');
lines.push(' * and paste the output below.');
lines.push(' */');
lines.push('export const Colors = {');
lines.push('  light: {');

for (const key of orderedKeys) {
  const value = lightMap[key];
  if (!value) {
    console.warn(`  ⚠  Missing light —${key} in :root — skipping`);
    continue;
  }
  const hex = valueToHex(value);
  if (!hex) {
    console.warn(`  ⚠  Could not convert light —${key}: ${value}`);
    continue;
  }
  const camel = toCamelCase(key);
  lines.push(`    ${camel}: '${hex}', // ${value}`);
}

lines.push('  },');
lines.push('  dark: {');

for (const key of orderedKeys) {
  const value = darkMap[key];
  if (!value) {
    console.warn(`  ⚠  Missing dark —${key} in dark :root — skipping`);
    continue;
  }
  const hex = valueToHex(value);
  if (!hex) {
    console.warn(`  ⚠  Could not convert dark —${key}: ${value}`);
    continue;
  }
  const camel = toCamelCase(key);
  lines.push(`    ${camel}: '${hex}', // ${value}`);
}

lines.push('  },');
lines.push('} as const;');
lines.push('');
lines.push('export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;');

console.log(lines.join('\n'));
