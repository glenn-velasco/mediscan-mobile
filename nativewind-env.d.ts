/// <reference types="nativewind/types" />

// nativewind@5.0.0-preview.4 doesn't ship a `*.css` module declaration (only React Native prop
// augmentations, see node_modules/react-native-css/types.d.ts) — Metro resolves the CSS import
// fine at build time, but TS has no type for it without this. Standard TS practice for CSS
// side-effect imports; can be dropped if a future nativewind release adds it upstream.
declare module '*.css';
