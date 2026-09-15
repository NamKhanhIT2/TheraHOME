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
| `Dashboard.dc.html` | ported → `app/(public)/luyen-tap/`, wired to real Supabase data. Its Cửa hàng and Cộng đồng tabs are deliberately NOT built — both are large features the mobile app already has, and neither is training |
| `Auth.dc.html` | not ported: `/welcome` + `/thera-login` already are the one login door, and routing by role after sign-in lives in `src/lib/postSignInRoute.ts` |
| `Product Reveal.dc.html` | not started |

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
