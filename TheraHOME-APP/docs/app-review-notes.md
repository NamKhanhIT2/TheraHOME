# App Review notes (draft — paste into App Store Connect › App Review Information)

> **FREE-AGREEMENT MODE (2026-09-04):** while the Paid Apps Agreement is
> not yet active, `phase_promos.sales_enabled=false` hides phase 3, both
> promo cards and the paywall entirely — the app currently contains NO
> visible IAP. For the first (free) submission, OMIT the "In-app
> purchases" section below and do not attach any IAPs to the version.
> When the agreement is active: tick "Đang mở bán" for the 4 phases in
> WEB Admin's Upsell editor, attach the 4 IAPs to a new version, and use
> the full notes below.

> Fill in the demo password before submitting. Keep the notes in English —
> App Review reads English. Update the day-count/path below if the flow
> changes.

## Demo account

- Username: `app_review1` (sign in via "Đăng nhập với tài khoản TheraHOME"
  on the login screen — the third option below Apple/Google)
- Password: `<FILL IN BEFORE SUBMITTING>`

This is a dedicated review account: every roadmap day is open immediately
and each phase's survey can be taken right away, so the full program can be
exercised in one sitting (regular users unlock one day per calendar day).
Only one device program exists today — TheraNECK+ — so the Home/Roadmap
product switcher shows a single, non-interactive label. (When IAP is on
sale, the Phase 3 purchase lock is intentionally kept in place on this
account — that is the IAP to review.)

## Suggested test path (free-agreement build — no IAP visible)

1. Sign in with the demo account above.
2. "Lộ trình" (Roadmap) tab → the TheraNECK+ program (Phase 1 and Phase 2,
   14 days) is listed.
3. Open any day → the discomfort check-in (0–10) appears → confirm → the
   day's exercise video screen opens.
4. At the end of Phase 2, tap "Khảo sát & đánh giá giai đoạn" and submit
   the 3-question survey.
5. Home tab: progress chart, today's card ("Quick guide" plays the current
   day's video), water tracker. Store, Community and both chats (AI /
   human) are reachable from the tab bar and the floating assistant.

## Suggested test path (once IAP is on sale)

Steps 1–4 as above, then:

5. Two cards appear at the bottom of the roadmap: "Mở khóa Giai đoạn 3"
   (the IAP paywall — non-consumable `ai.therahome.neckplus.phase3unlock`)
   and a cross-sell card for a physical device.
6. Alternatively, tapping the greyed "GIAI ĐOẠN 3" header opens the same
   paywall directly.
7. The paywall has Restore Purchases, Terms, and Privacy links in the
   footer.

## In-app purchases (Guideline 3.1.1)

Digital content (Phase 3 of a device's exercise program) is sold ONLY
through Apple In-App Purchase — one non-consumable per device. Only the
TheraNECK+ program exists in the app today, so only its IAP is attached:

- `ai.therahome.neckplus.phase3unlock`

(`ai.therahome.neckpro.phase3unlock`, `ai.therahome.backplus.phase3unlock`
and `ai.therahome.backpro.phase3unlock` stay in App Store Connect as
"Ready to Submit" — unattached — for when those programs ship; deleting
an IAP forfeits its Product ID forever.)

## Physical goods (Guideline 3.1.3(e))

TheraNECK/TheraBACK are physical wellness devices. The "Cửa hàng" (Store)
tab and the cross-sell card link to external web pages to purchase these
physical goods — a confirmation dialog is shown before leaving the app.
No digital content is sold outside IAP.

## Health & medical (Guideline 1.4.1)

TheraHOME is a fitness/wellness companion app, not a medical device app.
It shows a medical disclaimer at onboarding consent, in the FAQ, and in
the AI assistant ("does not replace a doctor"); exercise content cites
WHO physical-activity recommendations. The devices do not measure health
data and do not connect to the app.

## User-generated content (Guideline 1.2)

The Community tab supports: report post/comment (4 reasons), hide
post/comment, block user, and author-side edit/delete. Reports go to a
staffed customer-care review queue. Support contact (hotline + email) is
in Profile → Trợ giúp.

## AI chat

The "Trợ lý AI" chat shows a one-time consent screen before first use
(third-party AI processing, no personal data sent, answers are exercise
guidance only, not medical advice) and a persistent "Không thay thế bác
sĩ" note in the header.

## Account deletion (Guideline 5.1.1(v))

Profile → Tài khoản → "Xóa tài khoản" performs real deletion via a
server-side RPC (profile scrubbed, program/progress data hard-deleted).
