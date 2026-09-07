# Play Console upload pack

Everything the Google Play listing needs, in the **en-US** locale. Regenerated
2026-09-07 from commit `db8fd5f` — the earlier set was shot before the tab-bar
spacing fix, the skeleton loaders and the chat rework, so it no longer matched
the build.

## What is here

| File | Where it goes in Play Console |
|---|---|
| `app-icon-512.png` (512×512) | Main store listing → App icon |
| `feature-graphic-1024x500.png` (1024×500) | Main store listing → Feature graphic |
| `phone/*.png` (1242×2688) | Store listing → Phone screenshots |
| `tablet/*.png` (1440×1920) | Store listing → 7-inch and 10-inch tablet screenshots |
| `store-listing-en-US.txt` | App name, short description, full description |
| `TheraHOME-1.0.0-versionCode1.aab` | Production → Create release → App bundle |

The bundle is gitignored (110 MB, and Play only wants the newest) and lands
here on its own: `plugins/withPlayAssetsBundleCopy.js` makes `bundleRelease`
copy it in and delete the previous one, so this folder always holds exactly
one bundle and it is always the newest. Rebuild from `TheraHOME-APP/android`:

    JAVA_HOME=$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home \
    ANDROID_HOME=$HOME/Library/Android/sdk ./gradlew bundleRelease

It is signed with the upload key (`CN=TheraHOME, O=H-COMMERCE GLOBAL COMPANY
LIMITED`, valid to 2054) — not the debug key, which Play rejects.

## Screenshots: what they show and what they do not

The set covers **Store, Community and the AI assistant**. It deliberately does
NOT include Home, Roadmap or the daily check-in: those screens are only worth
showing on an account with an activated device and several days of logged
sessions, and the account available when these were taken had neither, so they
would have shown an empty chart and a locked roadmap. Add them later from an
account with real progress — Play allows up to 8 phone screenshots and the
roadmap is the app's strongest feature.

`02-community.png` includes a real customer's post and profile photo. The owner
confirmed on 2026-09-07 that this customer has given permission for it to be
used in the store listing. Anyone re-shooting this screen needs that permission
again, or should switch the feed to the **TheraHOME** tab, which shows only
posts TheraHOME published itself.

Sizes differ from the previous set's tablet screenshots (2064×2752). The test
device caps a display override at twice its physical width, so 2064 px was only
reachable by upscaling, which softens the image. 1440×1920 is the largest the
device renders natively at a 3:4 tablet ratio and is well inside Play's limits
(320–3840 px per side).

## Known content issue, not fixed here

Two official Community posts are written in Vietnamese but have no
`target_markets` set, which means *every* market sees them — an English or
Malay customer currently reads Vietnamese in their feed. Set their
`target_markets` to `VN` in Admin. This is content configuration, not app code.
