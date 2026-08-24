// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // eslint-plugin-react-hooks@7's "recommended" preset (pulled in by
    // eslint-config-expo) bundles the React Compiler-readiness rule family.
    // This app doesn't use the React Compiler (no babel-plugin-react-compiler
    // in babel.config.js) and relies extensively on patterns these rules
    // flag as unsafe purely from a compiler-memoization standpoint but which
    // are correct/intentional here:
    //   - react-hooks/refs: reading/writing a ref during render to compare
    //     against the previous render (e.g. PainChart's range-change ref,
    //     PathNode's previous-status ref) — a standard, safe pattern absent
    //     compiler-driven re-execution of render bodies.
    //   - react-hooks/immutability: Reanimated's `sharedValue.value = x` is
    //     the library's own documented API, not a React state mutation.
    //   - react-hooks/purity, react-hooks/set-state-in-effect,
    //     react-hooks/preserve-manual-memoization: same compiler-readiness
    //     family, same rationale.
    // Leaving react-hooks/rules-of-hooks and exhaustive-deps at their
    // recommended severity — those catch real bugs regardless of compiler
    // adoption.
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
]);
