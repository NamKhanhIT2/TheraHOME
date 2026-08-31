// `react-native-iap`'s package "exports" map resolves its `"react-native"`
// condition to raw, uncompiled source (`src/index.ts`) rather than its
// built `.d.ts` output — this project's tsconfig (via expo/tsconfig.base's
// `customConditions: ["react-native"]`) follows that same condition for
// type-checking too, so that raw source gets type-checked directly. One of
// its files references the Hermes/React Native runtime global `global`,
// which isn't declared anywhere in this project's `lib` (`DOM`/`ESNext`,
// no `@types/node`). This is the standard minimal shim for that class of
// issue — safe since `global` genuinely exists at runtime in RN/Hermes.
declare const global: typeof globalThis;
