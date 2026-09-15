# Landing assets — where each one came from

None of these could be pulled from the Claude Design project: `DesignSync
get_file` caps at 256 KiB of base64, so anything over roughly 190 KB comes
back truncated with no PNG IEND chunk. Every image in that project exceeded
it (they carry large C2PA provenance blocks). So each was sourced or built
from something already in this repo or in the live database.

| File | Source |
|---|---|
| `logo.png` | `TheraHOME-APP/assets/brandmark-gradient.png`, resized 958 → 120px. Same 958x958 the design's `assets/brand/logo.png` reports, i.e. the same artwork. It renders at 26–30px, so 120 is generous and saves ~580 KB. |
| `hero-bg.png` | Composed from `TheraHOME-APP/assets/welcome.jpg` (the app's own brand image, same stretching/wellness subject the design used). The portrait frame is placed right-of-centre on a blurred, brightened copy of itself, with every edge feathered so it dissolves into the backdrop instead of sitting in a rectangle. Right-of-centre because the hero's own gradient is 93% dark at the left edge and 10% at the right. |
| `device.png` | The REAL product photo, downloaded from `store_items.image_url` in the live catalog (a public Supabase storage bucket). 512x394 upscaled 2x with lanczos — no detail invented. Its aspect is 1.300, exactly the 1430x1100 the design's `device.png` reports, so it is the same photograph, and `hero-scroll.js`'s UV coordinates land correctly: all five sample points (both electrode pads, three node groups) were verified to fall on opaque device pixels. |
| `app/store.png`, `app/community.png`, `app/ai-chat.png` | The real Play Store captures in `play-assets/phone/`, trimmed of the Android status and gesture bars (1242x2688 → 1242x2508, aspect 0.495 ≈ the 0.5 carousel frame) and resized to 560px. |

## What is still the design's and could be swapped in

The design ships five distinct app screens; only three real captures exist, so
the carousel repeats them — which its own list does too, repeating three of
five to fill eight slots. If Home and Lộ trình captures are ever taken, drop
them in as `app/home.png` / `app/roadmap.png` and add them to `CARDS` in
`app/(public)/ung-dung/page.tsx`.

`hero-bg.png` is a composition, not the design's original. If the real
`assets/hero-bg.png` is exported by hand it can replace this file directly —
the page references the path, not the provenance.
