# Landing assets — two files still missing

`logo.png` and `hero-bg.png` could not be pulled through DesignSync: both
exceed its 256 KiB `get_file` cap and came back truncated (no PNG IEND chunk,
both cut to exactly 196608 bytes). Shipping a half-decoded PNG would render as
a broken image, so they were deleted rather than committed.

To finish the hero, export these two from the Claude Design project
`b34e8246-a1b9-44a1-ad8c-63a4025fd12a` and drop them here:

    public/landing/logo.png       (from assets/brand/logo.png — 958x958 RGBA)
    public/landing/hero-bg.png    (from assets/hero-bg.png   — 1672x941 RGB)

Nothing else needs changing: the page already references `/landing/logo.png`
and `/landing/hero-bg.png`, and both are decorative (`alt=""`), so the page
renders correctly without them — the hero just falls back to its gradient
wash and the nav shows the wordmark alone.

Worth resizing on the way in: the logo is a 958px square used at 30px.
