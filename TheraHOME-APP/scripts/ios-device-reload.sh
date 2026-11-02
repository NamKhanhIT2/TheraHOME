#!/usr/bin/env bash
# Push a JS/asset change to the iPhone without rebuilding the app.
#
# The phone carries a RELEASE build with no Metro connection, so there is
# nothing to "reload" — the JS lives inside the .app as Hermes bytecode.
# This rebuilds that one file, drops it into a copy of the existing .app,
# re-signs it and reinstalls. ~40 seconds instead of ~6 minutes.
#
# ONLY for JavaScript, TypeScript and asset changes. Anything native —
# a new native module, app.json plugins, Info.plist, entitlements, icons,
# a version bump — needs the full xcodebuild in docs/ios-device-reload.md.
set -euo pipefail

cd "$(dirname "$0")/.."

DEVICE="${DEVICE:-465BCF44-7C74-538E-9EAE-58EE3A8B024E}"   # iPhone 11 Pro Max
IDENTITY="${IDENTITY:-058F04A96D296DA6B939568EC1AF0A58978B72EB}"  # Apple Development: Hoàn Lng Xuân
BUNDLE_ID="ai.therahome"
HERMESC="ios/Pods/hermes-engine/destroot/bin/hermesc"
# A .app built by Xcode for the device. `ios/` is gitignored and a prebuild
# wipes it, so the entitlements copy lives in scripts/ instead — see the doc
# for how to regenerate both.
BASE_APP="${BASE_APP:-$HOME/Library/Developer/Xcode/DerivedData/TheraHOME-csqtubficutyxsfcncspdibiyybz/Build/Products/Release-iphoneos/TheraHOME.app}"
ENTITLEMENTS="${ENTITLEMENTS:-scripts/therahome-dev.entitlements}"

OUT="$(mktemp -d "${TMPDIR:-/tmp}/therahome-reload.XXXXXX")"
trap 'rm -rf "$OUT"' EXIT

echo "==> bundling JS"
npx expo export:embed \
  --platform ios \
  --dev false \
  --entry-file node_modules/expo-router/entry.js \
  --bundle-output "$OUT/plain.js" \
  --assets-dest "$OUT/assets"

echo "==> compiling Hermes bytecode"
cp -R "$BASE_APP" "$OUT/TheraHOME.app"
"$HERMESC" -emit-binary -O -out "$OUT/TheraHOME.app/main.jsbundle" "$OUT/plain.js" >/dev/null
# Hermes bytecode starts with c6 1f bc 03. A plain-JS bundle here means the
# compile silently did nothing and the app will white-screen.
magic=$(xxd -p -l4 "$OUT/TheraHOME.app/main.jsbundle")
[ "$magic" = "c61fbc03" ] || { echo "main.jsbundle is not Hermes bytecode ($magic)"; exit 1; }

# `--assets-dest "$OUT/assets"` writes paths relative to the app bundle under
# `$OUT/assets/assets/` (for example `assets/onboarding/foo.png` and
# `node_modules/...`). Copy that directory into the app's `assets/` root.
# Copying it into `assets/assets/` adds one extra level, so assets that were
# already present in BASE_APP keep working while every newly-added asset is
# silently missing at runtime.
cp -R "$OUT/assets/assets/." "$OUT/TheraHOME.app/assets/"

echo "==> verifying bundled assets"
while IFS= read -r -d '' source_asset; do
  relative_asset="${source_asset#"$OUT/assets/assets/"}"
  bundled_asset="$OUT/TheraHOME.app/assets/$relative_asset"
  if [ ! -f "$bundled_asset" ] || ! cmp -s "$source_asset" "$bundled_asset"; then
    echo "FAILED: bundled asset is missing or differs: $relative_asset"
    exit 1
  fi
done < <(find "$OUT/assets/assets" -type f -print0)

echo "==> signing"
# NOT ad-hoc (`--sign -`): an ad-hoc signature installs nowhere.
codesign --force --sign "$IDENTITY" --entitlements "$ENTITLEMENTS" "$OUT/TheraHOME.app"

echo "==> installing"
xcrun devicectl device install app --device "$DEVICE" "$OUT/TheraHOME.app"
xcrun devicectl device process launch --device "$DEVICE" "$BUNDLE_ID"

# A crash on launch looks exactly like a success up to here, so check that
# the process is still alive a few seconds later. The process list shows the
# executable's PATH (.../TheraHOME.app/TheraHOME), never the bundle id.
sleep 6
if [ "$(xcrun devicectl device info processes --device "$DEVICE" | grep -ci "TheraHOME.app")" -eq 0 ]; then
  echo "FAILED: the app is not running — it launched and died."
  exit 1
fi
echo "==> running"
