// Whether the app running on this phone is too old, and how firmly to say so.
//
// Neither store tells a customer an update exists. iOS has no such
// notification at all; both stores rely on the phone's own auto-update
// setting, which is on by default but runs overnight, on Wi-Fi, when
// charging — so a release reaches most people in a day or two and reaches
// the rest never. Somebody who switched auto-update off keeps the build
// they installed in September for as long as they own the phone.
//
// That is survivable until the server moves. Edge functions, RPCs and the
// schema go on changing; an old binary eventually calls something that is
// not there any more, and the customer sees a failure nobody can
// reproduce. So the app asks, every launch, whether it is still a version
// this backend wants to talk to.
//
// Two thresholds, which is what every other app does:
//
//   latest  — a newer version exists. A dismissible nudge, shown once per
//             version, because an update a customer declines is not a
//             problem, it is a preference.
//   minimum — this version is no longer supported. A screen with no way
//             past it, because the alternative is letting somebody use an
//             app that will fail at a moment of our choosing rather than
//             theirs.
//
// Both live in `app_config`, per platform, so raising either is a field in
// WEB Admin and not a store release. BOTH ARE EMPTY BY DEFAULT and empty
// means off — see `decideUpdate`, which fails open at every step. A config
// row that cannot be parsed must never lock anybody out of an app that
// works.
import { Linking, Platform } from 'react-native';

export type UpdateState = 'none' | 'optional' | 'required';

/**
 * Numeric compare of two dotted versions. Negative when `a` is older.
 *
 * Deliberately forgiving: `1.2` equals `1.2.0`, a leading `v` is ignored,
 * and anything non-numeric in a part is dropped (`1.0.2-beta` reads as
 * `1.0.2`). The input is a string an admin typed into a web form, and the
 * cost of being strict is a false "your app is out of date".
 *
 * Returns null when either side has no digits at all, so callers can tell
 * "older" from "unanswerable".
 */
export function compareVersions(a: string, b: string): number | null {
  const parts = (value: string): number[] | null => {
    const trimmed = value.trim().replace(/^v/i, '');
    if (!/\d/.test(trimmed)) return null;
    return trimmed.split('.').map((part) => {
      const digits = part.match(/\d+/);
      return digits ? Number(digits[0]) : 0;
    });
  };
  const left = parts(a);
  const right = parts(b);
  if (!left || !right) return null;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * The verdict for one launch.
 *
 * Every unknown resolves to 'none'. An unreadable config, a missing row, a
 * version string nobody can parse — none of those are evidence that this
 * app is out of date, and treating them as such would brick a working
 * install from a typo in a text field.
 */
export function decideUpdate({ current, minimum, latest }: {
  current: string | null | undefined;
  minimum: string | null | undefined;
  latest: string | null | undefined;
}): UpdateState {
  if (!current?.trim()) return 'none';
  if (minimum?.trim() && (compareVersions(current, minimum) ?? 0) < 0) return 'required';
  if (latest?.trim() && (compareVersions(current, latest) ?? 0) < 0) return 'optional';
  return 'none';
}

// The App Store's numeric id for TheraHOME, the same one the public site
// links to (TheraHOME-WEB/src/lib/siteContent.ts). Android is addressed by
// package name, which is `ai.therahome` in app.json.
const APP_STORE_ID = '6803739232';
const ANDROID_PACKAGE = 'ai.therahome';

/** The store page, as the installed store app opens it. */
function storeUrls(): { app: string; web: string } {
  return Platform.OS === 'ios'
    ? {
      // itms-apps:// opens the App Store app directly instead of bouncing
      // through Safari, which is what makes the button feel like part of
      // the phone rather than a link.
      app: `itms-apps://apps.apple.com/app/id${APP_STORE_ID}`,
      web: `https://apps.apple.com/vn/app/therahome/id${APP_STORE_ID}`,
    }
    : {
      app: `market://details?id=${ANDROID_PACKAGE}`,
      web: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
    };
}

/**
 * Opens this app's store page.
 *
 * Tries the store app's own scheme first and falls back to the https page,
 * because `market://` has nothing to open on a handset with no Play Store
 * (and a customer there still deserves a page they can read).
 */
export async function openStorePage(): Promise<void> {
  const { app, web } = storeUrls();
  try {
    if (await Linking.canOpenURL(app)) {
      await Linking.openURL(app);
      return;
    }
  } catch {
    // Fall through to the web page.
  }
  await Linking.openURL(web).catch(() => undefined);
}
