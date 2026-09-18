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
| `cine/00.mp4` | **The owner's footage**, replaced 2026-09-18 with a sharper take (`~/Downloads/Cinematic_Architectural_Video.mp4`, 2552x1440 H.264, 4.9s, 15.7 MB). Delivered at **1920x1084, CRF 30**, `preset veryslow`, `tune film`, `keyint=12:min-keyint=12:scenecut=0`, no audio, `+faststart` — 2.30 MB, SSIM 0.951 against the source. 1920 because that is where most desktops render it 1:1; the previous 1248 was being upscaled on nearly every screen, which is what the owner saw as soft. |
| `cine/03.mp4` | `~/Downloads/3.mp4` (1248x704, 5.04s, the foyer walk), same encode settings, 0.92 MB, SSIM 0.962. **Still the lower-resolution source** — there is no sharper take of this shot, so the middle of the journey is softer than the opening. Replace this file the day one exists. |
| | Both were HEVC originally, with 2 and 1 keyframes for the whole clip: unplayable in plenty of Chrome installs and terrible to scrub. H.264 with a keyframe every 0.47s fixed both. |
| `cine/gym-final.jpg` | The closing still, `~/Downloads/ChatGPT Image 16_23_14 18 thg 9, 2026.png` re-encoded at native 1670x941. It **replaces** the design's `assets/cine/gym-final.png`: in that one the figure on the television is malformed, which the owner spotted (2026-09-18). The closing beat is a still rather than the fourth clip because the design found the generated human motion reads artificial. |
| `cine/00-poster.jpg` | Frame 0 of the re-encoded `00.mp4`, via `ffmpeg -frames:v 1`. Backs the loading card so the opening shot is on screen while the video downloads, instead of the design's flat dark square. Same frame, so nothing jumps when the video takes over. |
| `hero-bg.png` | No longer rendered since the cinematic opening replaced the image hero (2026-09-17); the four `cine/0*.jpg` stills that opening used were deleted in turn on 2026-09-18 when the footage version landed. Kept because it is the design's original "Hero Section" art and the only copy we hold; delete it only if that hero is never coming back. |
| `app/*.jpg` (7 files) | **The owner's own App Store set**, `~/Downloads/TheraHOME_AppStore_7_Screenshots_1242x2688/TheraHOME_AppStore_0N_1242x2688.jpg`, resized to 760px and re-encoded with mozjpeg q82 — 0.98 MB for all seven. These are finished marketing panels (headline + framed screen on a branded ground), not bare screen captures, which is why the carousel and the App page now draw them **without a phone bezel**: the panel already contains one, and wrapping it in a second frame showed a phone inside a phone. Aspect 1242:2688 = 0.462, so both frames use that exact ratio with `object-fit: contain` — no crop, nothing cut off. |

The five earlier `app/*.png` files (Play Store captures and two Drive
recoveries) were **deleted** when the App Store set replaced them — they were
lower-resolution crops of the same screens, and keeping both invited the next
person to wire up the wrong one.

## What is still the design's and could be swapped in

Nothing. Every file here is either the design's original or a real TheraHOME
asset. The carousel ring holds eight cards and there are seven panels, so one
repeats — the design's own list repeats too.
