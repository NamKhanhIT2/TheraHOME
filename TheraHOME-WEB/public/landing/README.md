# Landing assets — where each one came from

None of these could be pulled from the Claude Design project: `DesignSync
get_file` caps at 256 KiB of base64, so anything over roughly 190 KB comes
back truncated with no PNG IEND chunk. Every image in that project exceeded
it (they carry large C2PA provenance blocks). So each was sourced or built
from something already in this repo or in the live database.

| File | Source |
|---|---|
| `logo.png` | `TheraHOME-APP/assets/brandmark-gradient.png`, resized 958 → 120px. Same 958x958 the design's `assets/brand/logo.png` reports, i.e. the same artwork. It renders at 26–30px, so 120 is generous and saves ~580 KB. |
| `hero-bg.png` | **The design's original**, supplied by the owner (`ChatGPT Image 09_41_48 15 thg 9, 2026.png`). Already 1672x941 — exactly what the design specifies — so it is used at native size with no crop, resize or composition; only re-encoded at maximum PNG effort, 1.8 MB → 0.58 MB. Kept as PNG rather than palette-quantised: it is a photograph with a smooth sunrise gradient, which would band. |
| `device.png` | The REAL product photo, downloaded from `store_items.image_url` in the live catalog (a public Supabase storage bucket). 512x394 upscaled 2x with lanczos — no detail invented. Its aspect is 1.300, exactly the 1430x1100 the design's `device.png` reports, so it is the same photograph, and `hero-scroll.js`'s UV coordinates land correctly: all five sample points (both electrode pads, three node groups) were verified to fall on opaque device pixels. |
| `cine/01-exterior.jpg` … `cine/04-gym.jpg` | **The owner's own four frames** for the Home Cinematic opening (`~/Downloads/ChatGPT Image 16_40_29/40/50/58 17 thg 9, 2026.png`, generated in camera order: exterior at sunset → glass door opening → foyer → gym). 1672×941 PNG at ~2.3 MB each, re-encoded as JPEG q74 at native size — 1.7 MB for all four. They map one-to-one onto the design's `assets/cine/01-exterior.png` … `04-gym.png`, which exceed the DesignSync cap like every other image in that project. The design's `fill.png` (the backdrop behind the letterboxed plates) is not a file here: it is the exterior frame again, blurred and darkened in CSS inside `CinematicHero.tsx`. |
| `hero-bg.png` | No longer rendered since the cinematic opening replaced the image hero (2026-09-17). Kept because it is the design's original "Hero Section" art and the only copy we hold; delete it only if that hero is never coming back. |
| `app/*.jpg` (7 files) | **The owner's own App Store set**, `~/Downloads/TheraHOME_AppStore_7_Screenshots_1242x2688/TheraHOME_AppStore_0N_1242x2688.jpg`, resized to 760px and re-encoded with mozjpeg q82 — 0.98 MB for all seven. These are finished marketing panels (headline + framed screen on a branded ground), not bare screen captures, which is why the carousel and the App page now draw them **without a phone bezel**: the panel already contains one, and wrapping it in a second frame showed a phone inside a phone. Aspect 1242:2688 = 0.462, so both frames use that exact ratio with `object-fit: contain` — no crop, nothing cut off. |

The five earlier `app/*.png` files (Play Store captures and two Drive
recoveries) were **deleted** when the App Store set replaced them — they were
lower-resolution crops of the same screens, and keeping both invited the next
person to wire up the wrong one.

## What is still the design's and could be swapped in

Nothing. Every file here is either the design's original or a real TheraHOME
asset. The carousel ring holds eight cards and there are seven panels, so one
repeats — the design's own list repeats too.
