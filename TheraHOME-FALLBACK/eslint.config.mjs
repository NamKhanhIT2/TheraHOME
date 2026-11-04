// eslint-config-next 16 xuất thẳng flat config, không cần FlatCompat.
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

export default [
  ...coreWebVitals,
  ...typescript,
  { ignores: [".next/**", ".open-next/**", ".wrangler/**", "cron/.wrangler/**", "cloudflare-env.d.ts"] },
];
