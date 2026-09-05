// Bundled paywall hero images (assets/paywall/*.jpg) — shown the instant
// the paywall opens, with zero network. An admin-uploaded
// `phase_promos.unlock_image_url` still WINS when set (WEB Admin stays the
// source of truth); the local asset then serves as that remote image's
// placeholder so the screen never shows an empty hero panel while it
// downloads. Keep only JPGs here — these are photographic and the PNG
// twins added ~7MB of app size for no visual gain.
import type { ImageSourcePropType } from 'react-native';

// Only TheraNECK+ exists as of 2026-09-05. The PRO/BACK entries were removed
// with their products — each `require()` ships its JPEG in the bundle whether
// or not anything can match it. The images are still in assets/paywall/, so
// restoring a line here is all it takes when those devices return.
const HEROES: { match: RegExp; source: ImageSourcePropType }[] = [
  { match: /neck/i, source: require('../../assets/paywall/theraneck-phase-3-hero.jpg') },
];

/** Resolve the bundled hero for a product by its catalog name (e.g.
 * "Thiết bị hỗ trợ cổ · TheraNECK PRO"). Null when the name matches no
 * known device — the paywall then falls back to the remote image or the
 * lock-icon placeholder, so new products degrade gracefully. */
export function paywallHeroFor(productName: string | null | undefined): ImageSourcePropType | null {
  if (!productName) return null;
  return HEROES.find((hero) => hero.match.test(productName))?.source ?? null;
}
