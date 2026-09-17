# Landing design source — pulled on demand, not mirrored

The public site is ported from Claude Design project
`b34e8246-a1b9-44a1-ad8c-63a4025fd12a` ("Hero scene three.js review"),
reachable with the `DesignSync` tool / `/design-sync` skill.

This is a **different project** from the one the top-level CLAUDE.md records
(`d030fe5f-…`, Admin / Customer Care / Web App). Both share the same design
system bundle `therahome-design-system-78705102-7711-4081-808f-084fa4b60e16`,
already mirrored at `../_ds/` and already ported into
`src/design-tokens/tokens.css` — so the tokens need no further work.

Unlike the sibling `admin.jsx` / `care.jsx` mirrors, the page sources are NOT
copied here. They are large, they change upstream, and a stale half-mirror is
worse than none: `DesignSync get_file` re-reads any of them in one call.
Pull and diff against the live project rather than trusting a local copy.

## Pages in the project, and where each one landed

| Design file | Status |
|---|---|
| `Hero Section.dc.html` | ported → `app/(public)/page.tsx` |
| `Products.dc.html` | ported → `app/(public)/san-pham/` (incl. the 600vh scroll hero) |
| `App.dc.html` | ported → `app/(public)/ung-dung/` (incl. the 3D carousel) |
| `About.dc.html` | ported → `app/(public)/gioi-thieu/` |
| `Dashboard.dc.html` | ported → `app/(public)/luyen-tap/`, wired to real Supabase data, all three tabs (Lộ trình / Cửa hàng / Cộng đồng) |
| `Auth.dc.html` | ported → `app/(auth-screen)/dang-nhap/` + `/dang-ky/` (`AuthPanel.tsx`), wired to real Supabase auth; role routing after sign-in stays in `src/lib/postSignInRoute.ts` |
| `Product Reveal.dc.html` | not started |
| `Home Cinematic.dc.html` | ported → `src/components/landing/CinematicHero.tsx` + `public/landing/cinematic-scroll.js`; replaces the Hero Section opening on `/` (2026-09-17) |

## Scripts

`hero-scroll.js` is copied VERBATIM to `public/landing/hero-scroll.js` and
loaded with `next/script` — it is a self-registering custom element with no
framework ties, and the scroll choreography is dense enough that any
paraphrase would drift. `carousel.js`, `lang.js` and `auth-state.js` became
React (`AppCarousel`, `langPreference.ts`, `useLandingSession`/`AccountChip`)
because each needed to talk to real state the design only mocked.

## Things that bit, worth knowing before the next page

- `x-dc`, `x-import`, `<helmet>` are the design host's own custom elements.
  They have no meaning in Next and must be translated, never copied.
- The design host runs **no JS**, so interactivity is done in CSS — the burger
  menu is a `<input type=checkbox>` + `<label>`, reveals are
  `animation-timeline: view()`. The CSS survives the port as-is
  (`src/styles/landing.css`); the checkbox became React state.
- `hero-scene.js`, `hero-object3d.js`, `hero-anatomy.js`, `hero-overlay.js`
  and `hero-scroll.js` are three.js **experiments** — the project is named for
  them, but `Hero Section.dc.html` does not load any of them. Its hero is a
  pair of `hero-bg.png` layers. Do not port them by assumption; ask first.
- `assets/brand/logo.png` and `assets/hero-bg.png` exceed DesignSync's 256 KiB
  `get_file` cap and come back truncated. See `public/landing/README.md`.
- **`Auth.dc.html` is one file with two states**; here it is two real routes,
  `/dang-nhap` and `/dang-ky`, with the design's tab pair as `<Link>`s between
  them — so the browser Back button and a shared link both behave. They sit in
  an `(auth-screen)` group, **outside `(public)`**, because the site nav already
  carries Đăng Nhập / Đăng Ký and rendering it on the auth screen itself showed
  those links twice.
- The design's **"Ghi nhớ đăng nhập" checkbox was dropped on purpose**:
  supabase-js persists the session in localStorage either way, so the box would
  have changed nothing. A control that does nothing is worse than no control.
- Password rules are **not re-invented here** — `isPasswordStrong` mirrors the
  app's `isPasswordStrongEnough` (`TheraHOME-APP/src/lib/authAccount.ts`) so the
  same password is accepted on both, and the "email đã tồn tại" case uses the
  same `identities.length === 0` decoy check Supabase returns.
- The design's "Họ và tên" field writes `full_name`, **not** `username`:
  `handle_new_user` validates `username` against a shape rule that rejects
  spaces, so a Vietnamese full name would have been refused at the trigger.
- `cinematic-scroll.js` is the second script copied near-verbatim (after
  `hero-scroll.js`), for the same reason: dense scroll choreography. Its two
  departures are marked `NEXT` in the file — the shared site nav is made
  transparent at the top and *given back* its own glass afterwards, instead of
  being painted with the design's fixed colours; and it restores the nav when
  the element unmounts, because in Next the nav outlives the page.
- `Home Cinematic.dc.html` imports `image-slot.js` and `support.js` but uses
  neither (`<image-slot>` never appears; `support.js` is the design host's own
  runtime). Not ported.
