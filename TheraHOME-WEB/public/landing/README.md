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
| `app/store.png`, `app/community.png`, `app/ai-chat.png` | The real Play Store captures in `play-assets/phone/`, trimmed of the status and home-indicator bars (1242x2688 → 1242x2508, aspect 0.495 ≈ the 0.5 carousel frame) and resized to 560px. |
| `app/home.png`, `app/roadmap.png` | The owner's own Home and Lộ trình captures, from Google Drive (`01.PNG` / `02.PNG`, same 1242x2688 set), trimmed and resized identically. |

## What is still the design's and could be swapped in

All five app screens the design lists now exist. The ring holds eight cards, so
three repeat — as the design's own list does.

Every file is now either the design's original or a real asset. Nothing here
is a stand-in.
