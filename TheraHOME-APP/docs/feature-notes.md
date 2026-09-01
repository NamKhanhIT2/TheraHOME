# Dated feature notes (chronological work log)

> Split out of `TheraHOME-APP/CLAUDE.md` (2026-08-28) to keep that file
> small. Content is verbatim from the original — any "see X above/below"
> cross-reference may now live in `../CLAUDE.md` or a sibling file in
> `docs/` (`backend.md`, `auth-and-activation.md`, `motion.md`,
> `feature-notes.md`, `manual-setup.md`, `roadmap.md`).

## Community expansion (reports, richer notifications, progress-share, challenges)

Four migrations (`community_moderation_and_notifications`,
`community_post_types`, `community_challenges`,
`challenge_participants_public_count`) took Community from "feed + one-level
comments" to a fuller social surface. By area:

- **Moderation**: `content_reports` (one table for both posts and
  comments — `content_type`/`content_id`, no cross-table FK since it's
  polymorphic; admin/cskh read+update via RLS). `useReportContent()`
  (`src/hooks/useCommunity.ts`) replaces what used to be a fully fake
  `Alert`-then-toast report button. `community_posts`/`post_comments` both
  got a `hidden` boolean — soft moderation, distinct from a user's own hard
  self-delete (unchanged): the "public read" RLS policies on both tables now
  read `not hidden or author_id = self or admin/cskh`, so an author still
  sees their own hidden content (knows it happened) but nobody else does.
  `post_comments` also got its first-ever UPDATE policy (there wasn't one
  before — comments were insert/delete only) so Admin can set `hidden`.
  TheraHOME WEB's `ReportsView.tsx` is the queue: hide/delete content,
  lock the author's account (reuses `profiles.locked` — no separate
  `blocked_users` table), resolve/dismiss. A minimal anti-spam trigger
  (`enforce_content_rate_limit`) blocks >5 posts or comments per author per
  10 minutes; official posts (`author_id` null) are naturally exempt since
  `NULL = NULL` is never true in the count query.
- **Notifications on social events**: `notify_post_comment_event()` (AFTER
  INSERT on `post_comments` — notifies the post owner, and separately the
  parent comment's author on a reply, skipping duplicates when it's the same
  person) and `notify_post_like_event()` (AFTER INSERT on `post_likes`).
  `complete_day` (see above) now also fires a `streak_milestone`
  notification at 7/14/21/28-day marks suggesting the user share their
  progress. New `NotificationType` values: `comment`/`reply`/`like`/
  `streak_milestone`, deep-linking via a new `notifications.related_post_id`
  column. **Deliberately in-app only** — `dispatch-push` isn't invoked for
  these (unlike the existing human-chat path), to avoid turning every like
  into a push notification; a real product decision to revisit, not an
  oversight.
- **Progress-share posts**: `community_posts.post_type`
  (`text`/`image`/`progress`/`exercise`) + `progress_snapshot jsonb`, frozen
  at share time (never recomputed from live data on render) by
  `app/community/create.tsx`'s type picker, using data already available
  from `useActivatedPrograms`/`useProgramDays`/`usePainLogs` — no new tables
  needed. `src/components/ProgressShareCard.tsx` renders it in both the feed
  and post detail.
- **Challenges**: `challenges` (admin-managed, public reads `active=true`
  ones) + `challenge_participants` (join/read own row; a separate, wider
  "authenticated read all" SELECT policy exists specifically so the feed can
  show a participant *count* without exposing who — the row itself carries
  no PII beyond a `user_id`, and `profiles` RLS already blocks resolving
  that to a name). Completion is **self-declared but not self-issued**: the
  UPDATE policy's `WITH CHECK` re-verifies `user_programs.streak >=
  challenges.target_streak_days` server-side before allowing
  `completed_at` to be set — a client can't just mark itself complete.
  Mobile: the feed's `ChallengeBanner` (join/completed states,
  `src/hooks/useChallenges.ts`). Admin: a "Thử thách" sub-tab inside
  TheraHOME WEB's Cộng đồng page.
- **Real avatars everywhere**: `src/components/CommunityAvatar.tsx` (real
  photo when `author_avatar_url` is set, colored-initial fallback
  otherwise, dark official badge) replaced the feed/comments' inline
  colored-initial-only rendering — the avatar URL columns already existed
  but were never rendered before this pass.
- **Pagination**: `useCommunityPosts`/`usePostComments` take an optional
  `limit` (`DEFAULT_POSTS_PAGE_SIZE` / `DEFAULT_COMMENTS_PAGE_SIZE`) that
  grows via a "Xem thêm" button instead of always fetching the whole table —
  deliberately *not* `useInfiniteQuery`, since that changes the query cache
  from a flat `CommunityPostRow[]` to a paged shape and would have required
  touching every optimistic update that assumes a flat array (e.g.
  `useTogglePostLike`). The one thing this broke and had to be fixed:
  post detail used to find its post inside the (now-capped) feed list, so a
  deep link to an older post would silently fail to resolve — replaced with
  a dedicated `usePost(postId)` that fetches that one row directly.
- **Community guidelines**: added to `src/lib/legalContent.ts` as a fourth
  doc (`'community'`), linked from `app/profile/account.tsx`'s legal list
  and from the composer footer.

## Community notifications (event-driven, grouped — 2026-08-22)

Replaced the old ambiguous `like`/`comment`/`reply` notification types (`like`
covered both post AND comment reactions, indistinguishable client-side) with
four canonical event types: `post_reaction`, `post_comment`, `comment_reply`,
`comment_reaction`. `notifications_type_check` enforces this set alongside
the untouched marketing/upsell types (`schedule`/`inactivity`/`ad`/`blog`/
`chat`/`streak_milestone`).

**Grouping** — reactions (not comments/replies, which always stay one row
per event since each says something different) fold multiple reactors on
the same post/comment into a single row instead of one row per reactor:
`notifications.system_key` is now keyed by `post-reaction:<postId>` /
`comment-reaction:<commentId>` only (actor dropped from the key — that's
the actual behavior change from the pre-2026-08-22 version, which already
had `system_key` but kept one row per actor). `group_actor_ids uuid[]`
holds full membership in join order (`[0]` is the "primary" named actor,
`actor_id`/`actor_name`/`actor_avatar_url` always mirror it);
`second_actor_name` is cached only for the exactly-2-actor case ("A và B").
3+ collapses to "A và N người khác". `notify_post_like_event`/
`notify_comment_reaction_event` now handle `DELETE` too (previously only
`INSERT`/`UPDATE`) — removing a reaction shrinks the group, promotes the
next member to primary, and deletes the row entirely once the group empties
(verified live via a rollback-wrapped transaction during development —
insert→insert→delete→delete, checked group text after each step).

**Template layer**: `format_community_notification(type, actor_name,
second_actor_name, group_count, preview)` is the single place Community
notification copy is generated — all three trigger functions call it rather
than hardcoding their own string concatenation, and it returns Center
text (`title`/`body`) *and* Push text (`push_title`/`push_body`, shorter —
e.g. Center "Nam và 9 người khác đã bày tỏ cảm xúc về bài viết của bạn.",
Push title "Nam và 9 người khác" / body "đã bày tỏ cảm xúc về bài viết của
bạn."). `truncate_with_ellipsis(text, max)` is the shared comment/reply
preview truncator (adds `…`, doesn't just hard-cut). Both are
`revoke all from public, anon, authenticated` (internal helpers only,
called by SECURITY DEFINER triggers under the same owner — see the
`fix_function_privileges` gotcha under Supabase schema above). This is a
deliberate scoping choice, not the full spec: the *Postgres* layer is the
template source of truth (matches how every other notification type in
this table already bakes Vietnamese text server-side); a client-side
i18n-driven formatter consuming structured columns (`reaction_type`,
`group_actor_ids`, `second_actor_name`) is possible later without touching
this business logic, but wasn't built this pass.

**Push is a thin reader, not a second copy of the logic**: `dispatch-push`'s
`mode: 'social'` branch no longer computes its own title/body. It verifies
the caller actually performed the claimed action (still checks
`post_likes`/`comment_likes`/comment ownership — stops a forged payload
from spamming push), then looks up whichever `notifications` row(s) the
trigger already created/updated for that exact event (by `system_key` for
reactions, by `related_comment_id` for comments/replies — a reply produces
up to two rows, post owner + parent comment's author, and both get pushed
independently) and sends `push_title`/`push_body` straight from there. If
push fails or a category toggle blocks it, the Center row still exists —
it was written independently, before dispatch-push is ever called.

**Per-category push toggles** (`profiles.notify_comments`/`notify_replies`/
`notify_reactions`/`notify_community`, all default `true`): schema +
`dispatch-push` gating (`notify_community` is a global override, checked
alongside the specific category) + a "Cộng đồng" section added to
`app/profile/notifications-settings.tsx` reusing the existing `ToggleRow`.
Turning one off only stops push for that category — the trigger functions
that write Center rows never check these, so the in-app inbox is always
complete regardless of push settings.

**Client**: `useNotifications.ts`'s `NotificationRow` gained `reactionType`,
`groupActorIds`, `secondActorName`, `postImageUrl` (joined from
`community_posts.image_url` via the existing `related_post_id` FK — no new
join table). `app/notifications.tsx` renders the reaction emoji (via the
existing `POST_REACTIONS` map from `useCommunity.ts`) as a small white-circle
overlay on the actor's avatar in place of the generic type icon, and a
40×40 thumbnail when the related post has an image. Deep-link tap routing
(`openNotification`) only needed its type-name string literals updated —
the actual routing/scroll/highlight behavior for `related_comment_id`/
`related_parent_comment_id` (open Post Detail → expand thread if needed →
scroll → 1s highlight) already existed in `app/community/[postId].tsx`
from before this pass and needed no changes; a `comment_reply` correctly
lands on the reply itself (not just its parent) because `relatedCommentId`
is the reply's own row id. `_layout.tsx`'s push-tap routing needed **no**
changes at all — it already dispatches on payload field *presence*
(`data.postId`/`data.commentId`), not on the `type` string.

Small dev dataset at migration time (7 `like` + 7 `comment` rows) made a
straight retype safe — old rows were not retroactively merged into grouped
rows; only new reactions from this point on actually group.

**Video attachments in Community posts/comments (2026-08-22)**: was
completely unimplemented, not just broken — the picker in
`app/community/create.tsx` and `app/community/[postId].tsx` was
`mediaTypes: ['images']` only, `uploadCommunityImage` hardcoded
`contentType` to an image mime type regardless of extension, and
`CommunityPostImage` unconditionally rendered a plain `<Image>`. Fixed by
mirroring the pattern the chat feature already uses for the same problem
(`uploadChatAttachment`/`ChatMediaViewer` in `useChat.ts`/
`ChatMediaViewer.tsx`): **no new DB column** — `community_posts.image_url`/
`post_comments.image_url` now hold either an image or a video URL, and
every read site decides which by matching the file extension against
`/\.(mp4|mov|m4v|webm)(?:$|\?)/i` (same regex as `useChat.ts`'s
`attachmentKind`). `uploadCommunityImage(userId, uri, mimeType?)` picks
`video/mp4`/`video/quicktime`/etc. content-type when the extension or
picker-supplied `mimeType` says video; the `community-images` storage
bucket has no mime-type/size restriction so no bucket-side change was
needed. `CommunityPostImage` (used by the feed, post detail, and profile
grid — one component, no caller changes needed) now renders an
`expo-video` `VideoView` with native controls for video URLs, image
`<Image>` otherwise. Composer previews (before upload) show a lightweight
film-icon placeholder rather than an inline video player, matching how the
chat composer already previews a picked video.

**Multi-media posts + shared MediaGrid (2026-08-22)**: `community_posts`
gained `media_urls text[]` (migration `community_posts_media_urls`);
`image_url` is kept untouched (backfilled to `media_urls[1]`) since
`useNotifications.ts`'s thumbnail join already reads it. `useCreatePost`
now takes `media: PostMediaItem[]`, uploads all of them in parallel via
`uploadCommunityImage`, and writes both `image_url` (first item, back-compat)
and `media_urls` (full list). `app/community/create.tsx`'s picker now uses
`allowsMultipleSelection`/`selectionLimit` (cap `MAX_MEDIA = 10`) and each
tap on the image icon *appends* to the existing selection rather than
replacing it; the preview is a horizontal thumbnail strip instead of one
big preview, each thumbnail individually removable.
`src/components/community/MediaGrid.tsx` is the single layout for 2+ items
— Facebook/Instagram-style (1 → delegates to `CommunityPostImage` for its
aspect-ratio logic, 2 → two columns, 3 → one large + two stacked, 4 → 2×2,
5+ → 2×2 with a "+N" scrim on the last cell) — used by the feed, Post
Detail, and the profile post grid so none of them hand-roll their own media
layout. Comments were **not** touched — they're explicitly out of scope
and still single-media via `CommunityPostImage`.

**Video player pausing on blur (2026-08-22)**: a video left playing in the
feed kept its native player (and audio session) alive after the user
navigated into Post Detail — expo-router doesn't unmount the screen
underneath a push, so the old player and the new one (same source) fought
over playback, which looked like "audio still plays, picture frozen".
`CommunityPostVideo` (in `CommunityPostImage.tsx`) and `GridVideo` (in
`MediaGrid.tsx`) both now call `player.pause()` when `useIsFocused()`
(from `expo-router`) goes false.

**Comment UI pass (2026-08-22)**: `app/community/[postId].tsx` — (1) reply
indent was doubled (`thread`'s `marginLeft: 43` *and* `nested`'s own
`marginLeft: 44` both applied), producing an ~87px indent; removed
`nested`'s `marginLeft` so only `thread`'s applies. (2) The timestamp lived
next to the author name inside a `flexWrap` row, so on a long name it
wrapped onto its own line under the name; moved it out to the meta row
(next to "Trả lời"/reaction summary), matching how Facebook actually
places comment timestamps. (3) The comment-row `ReactionButton` (icon-only
variant, no `label` prop — this is the *only* icon-only usage, the
post-level one in `PostActionBar` always passes `label`) shrank from 21px
to 17px. (4) The composer's decorative `<AvatarImg>` (not wrapped in a
`Pressable`, did nothing) was removed; the image-pick icon moved to its
spot (left of the input), and the emoji-toggle icon moved to the input's
right (before Send) — both sized up from 20 to 24. (5) `Icon.tsx`'s
`smile` mapping was actually `Sparkles` (a star/sparkle glyph, not a
smiley — the installed lucide version has no `Smile` export, it was
renamed to `FaceGrinning`/`Laugh`) — remapped to `Laugh`, fixing every
`name="smile"` usage app-wide (comment composer, human-chat composer) at
once, not just this screen. (6) The post detail's 3-dot menu was a fixed
bottom sheet regardless of tap position; changed to a floating popover
positioned from the tap's `pageX`/`pageY` (same clamping approach the
comment long-press menu already used) so it opens near the icon instead of
always at the screen bottom.

## Admin/cskh "Chat" on mobile (2026-08-22)

An admin/cskh Google account can be signed into the patient mobile app too
(same `web_access_contacts`-bound `auth.users` row TheraHOME WEB uses — see
`current_web_roles()`). Previously the FAB always opened `/chat/human`, a
single specialist thread, for every account. `src/hooks/useWebRoles.ts` adds
`useIsStaff(userId)` (calls `current_web_roles()`, checks for `'admin'`/
`'cskh'`); `app/(tabs)/_layout.tsx` passes it into `AssistantBubble`'s new
`isStaff` prop, which swaps the FAB sheet's specialist row from "Chuyên gia
TheraHOME" + online indicator to "Chat" + "Danh sách hội thoại", and routes
to `/chat/admin-conversations` instead of `/chat/human`.

`app/chat/admin-conversations.tsx` lists every `kind: 'human'` thread with
at least one message (`useAdminChatThreads` in `useChat.ts`) — patient
name/avatar/last-message/unread count, sorted by recency. Tapping a row
opens `app/chat/admin-thread/[threadId].tsx`, a near-duplicate of
`app/chat/human.tsx`'s message UI (deliberately copied rather than shared —
the patient screen is a stable, already-tested surface and a generic
shared component would have made "own bubble = sender_type X" a runtime
branch threaded through both call sites for one screen's worth of reuse)
with `own` flipped to `sender_type === 'specialist'`, sending via
`useSendChatMessage`'s new 4th argument (`senderType`, defaults to `'user'`
so `human.tsx`/`ai.tsx` are unchanged), and marking the *patient's*
messages read via the new `markUserMessagesRead` (mirrors
`markSpecialistMessagesRead`).

**Nothing needed on the server** — every RLS policy this required
(`chat_threads`/`chat_messages`/`profiles` SELECT-all for staff, INSERT
`chat_messages` with `sender_type: 'specialist'`, `chat_message_reactions`,
the `chat-attachments` storage bucket) and `dispatch-push`'s `mode: 'chat'`
handling of `senderType: 'specialist'` (pushes the patient, titled "Chuyên
gia TheraHOME") already existed — built for TheraHOME WEB's `ChatView.tsx`
and simply reused as-is, since RLS is keyed off `auth.uid()`/
`current_web_roles()`, not which client (web vs. mobile) is calling.

## TheraHOME-account login screen redesign (2026-08-23)

`app/(onboarding)/thera-login.tsx` (the username/password form reached from
"Đăng nhập bằng tài khoản TheraHOME") got a full visual redesign to match a
supplied reference image — full-bleed `assets/login_background.png` scene,
a dark overlay, 6 looping falling-leaf sprites (`assets/leaf01-04.png`,
reanimated `translateY`/sway/rotate, ported from user-supplied sample code
and adapted to this app's conventions — `useReduceMotion()`-gated instead
of always running, typed props instead of `any`), the existing
`assets/brandmark-glow.png` logo (reused rather than adding a new logo
asset — consistent with `LoginOrbitHud.tsx`/`AnalyzingHud.tsx`), and a
glass-style card. All of `handleSubmit`/the `resolve_thera_login_email`
username-resolution flow is untouched — this was a UI-only pass, same as
the earlier `login.tsx` redesign.

Two deliberate deviations from the reference/sample code:
- **No `expo-blur`.** The sample used `BlurView` for the card; neither
  `expo-blur` nor `expo-linear-gradient` are dependencies of this project
  (confirmed — nothing in the repo imports either; the `LinearGradient`
  used elsewhere, e.g. `LoginOrbitHud.tsx`, is `react-native-svg`'s SVG-defs
  gradient, unrelated). Adding a new native module needs a rebuild that
  can't be verified without a device/simulator here, and the visual gap is
  small once the card background is already this opaque (`rgba(8,23,47,0.62)`)
  — so the card is a solid semi-transparent surface instead of a real
  backdrop blur. Worth revisiting with `expo-blur` if the difference reads
  as more noticeable on-device than expected.
- **Username field, not "Username or Email."** The reference's placeholder
  text doesn't match this screen's actual constraint — TheraHOME accounts
  log in by username only (`resolve_thera_login_email` resolves it to the
  account's real `<username>@thera.local` address; there's no email login
  path for these accounts) — so the placeholder stays "Tên đăng nhập,"
  matching the working password-visibility toggle (`eye`/`eye-off` icons,
  new `eye-off` mapping added to `Icon.tsx`) that the reference also shows.

Verified with a Pillow composite of the actual background/logo assets at
the styled proportions (no simulator here) — logo and card positioning
closely track the reference. `npx tsc --noEmit`/`npx expo lint` clean, same
12-warning baseline.

**Follow-up refinement, same day**: `assets/leaf02.png` was replaced with a
transparent-background version and `assets/leaf05.png` added — the leaf
config now cycles through all 5 images across 7 sprites instead of 4 across
6. `assets/login_background.png` was also replaced; the new asset's own
pixel dimensions (853×1844, aspect ≈2.16) happen to nearly match a typical
phone screen's aspect ratio, so `resizeMode="cover"` crops very little and
the image's sun position (measured via a small Pillow/numpy script —
brightest-pixel centroid — at ~36% down the image) lands at roughly the
same fraction down the actual screen. Per request, the gap between the
brand text and the card (`logoWrap`'s `marginBottom`, now the
`LOGO_CARD_GAP = 168` constant) was widened specifically so the sun shows
through in that gap — tuned by rendering placeholder boxes over the real
background asset at several candidate gap values and visually picking the
one that centered the sun between them (168), not derived from a closed-
form layout calculation (the two boxes' exact pixel heights depend on font
metrics that aren't worth computing by hand — this was empirical, same
verification style used throughout this session for asset-alignment work).

**Keyboard avoidance**: focusing either input now animates two things in
parallax rather than shifting the whole screen uniformly — the card
(`cardLift` shared value) moves the full distance needed, the logo moves
only 35% as far and scales down slightly (`0.86`), both via
`react-native-reanimated`. The lift amount is *not* a hardcoded 120–180px
guess: it's computed from the card's real measured height and the
password field's real measured position within it (both captured via
`onLayout`, refs not state — no need to re-render on every layout pass)
combined with the actual keyboard height from `Keyboard`'s
`keyboardWillShow`/`keyboardDidShow` event (`iOS`/`Android` respectively —
`keyboardWillShow` gives a pre-animation callback synced to the OS's own
keyboard-animation `duration`, which `withTiming` reuses so the two
animations move together instead of visibly lagging). The math always
targets the password field specifically (the lower, binding case) landing
`TARGET_GAP_ABOVE_KEYBOARD = 26`px above the keyboard — clearing password
automatically clears username (higher up) with room to spare, so no
per-field focus-tracking is needed; the same lift applies whichever field
is focused. Deliberately not `react-native-reanimated`'s own
`useAnimatedKeyboard` — it's marked `@deprecated` in favor of
`react-native-keyboard-controller`, a package not in this project, and
adding a new native dependency here hits the same
can't-rebuild-to-verify constraint noted above for `expo-blur`; the plain
`Keyboard` event-listener approach needs no new dependency and isn't
deprecated.

**Second follow-up refinement, same day** (all still in
`app/(onboarding)/thera-login.tsx`):
- `LOGO_CARD_GAP` raised again, `168 -> 196` — on-device the logo icon
  itself was still overlapping the sun's upper edge, not just the text.
  Re-verified with the same placeholder-box-over-the-real-asset Pillow
  technique, this time also boxing the 130px icon sub-region specifically
  to confirm the icon itself (not just the text below it) clears the sun.
- Falling leaves now start `LEAF_SKY_OFFSET = 160`px above the screen's
  top edge instead of only their own height above it — reads as genuinely
  falling from high in the sky rather than fading in a few pixels above
  frame. Each leaf's fall/sway duration is scaled up by the same ratio its
  travel distance grew by, so they still cross the *visible* screen at
  roughly their originally-tuned pace (only the invisible wind-up above
  frame got longer, not the perceived on-screen speed).
- Keyboard-avoidance's lift target changed from the password field to the
  "Tiếp tục" button — per explicit request, the form should scroll up just
  enough to reveal the button (the footnote below it can go under the
  keyboard), not stop with extra clearance below the button. Same
  measured-layout approach as before (`onLayout` on the button instead of
  the password field), gap tightened from 26px to `TARGET_GAP_ABOVE_KEYBOARD
  = 16`px ("vừa khéo" — snug, not a big buffer).
- Tapping anywhere that isn't an interactive control now dismisses the
  keyboard — the screen's content is wrapped in one `Pressable` with
  `onPress={Keyboard.dismiss}` (`styles.dismissLayer`, plain `flex: 1`, no
  background color — reusing `styles.screen` here by mistake on the first
  pass would have painted an opaque layer over the background image, since
  this Pressable sits as a child *in front of* the `ImageBackground`).
  The two `TextInput`s and the back/eye/continue buttons keep working
  normally and don't trigger the dismiss — RN's touch responder system
  already gives the deepest interactive element the tap, standard "tap
  outside to dismiss" pattern, no extra logic needed to exclude them.

`npx tsc --noEmit`/`npx expo lint` clean, same 12-warning baseline.

**Third follow-up — slow render on navigation, fixed at the asset level
(2026-08-23)**: reported as "logo/background take a beat to appear after
tapping into this screen." Root cause: `login_background.png` was a
2.28MB **lossless PNG** of a 853×1844 photographic gradient scene — PNG is
a poor fit for photo content (no discrete edges to compress well), and
that file size meant real, user-visible decode time on first mount, with
nothing having warmed the image cache beforehand. Two changes:
- **Re-encoded as JPEG** (`login_background.jpg`, quality 90, no alpha
  channel to begin with so nothing was lost by dropping it) — 2.28MB ->
  384KB, an ~83% reduction, visually indistinguishable at this quality
  (verified by rendering both and comparing — no visible banding even in
  the smooth gradient sky, the highest-risk area for JPEG artifacts).
  `thera-login.tsx`'s `require()` updated to the new filename; confirmed
  via grep this asset wasn't referenced anywhere else first.
- **`brandmark-glow.png` downscaled 1024×1024 -> 512×512** (stayed PNG —
  it needs its alpha channel) — 433KB -> 108KB. The largest of its 3 actual
  display sizes across the app (`AnalyzingHud.tsx` 44px, `LoginOrbitHud.tsx`
  82px, `thera-login.tsx` 130px) is 130pt; 512px still covers that with
  headroom even at 3x device pixel density, so this is a pure decode-cost
  win with no visible quality change.
- **Prefetch from the previous screen**: `app/(onboarding)/login.tsx` (the
  screen with the "Đăng nhập bằng tài khoản TheraHOME" button) now calls
  `Image.prefetch()` on the background photo's resolved URI as soon as
  *it* mounts — giving the OS a genuine head start (the time the user
  spends reading/deciding on that screen) before they even tap through, on
  top of the file being much smaller to begin with. The logo asset needed
  no equivalent prefetch — `login.tsx` already renders it itself (via
  `LoginOrbitHud`), so it's already warm in the image cache by the time
  someone navigates onward.

Both file replacements verified dimension-preserving (`login_background.jpg`
still 853×1844) before landing, and the sun's position re-measured against
the new (brighter-recolored, per this same request) background — still
close enough to the earlier `LOGO_CARD_GAP` tuning that it didn't need
re-adjusting. `npx tsc --noEmit`/`npx expo lint` clean, same 12-warning
baseline.

**Fourth follow-up — pop-in was still happening, real remaining cause was
the leaf sprites (2026-08-23)**: reported as "the TheraHOME login part
still appears after [navigating], not the whole screen revealing at once"
— the third follow-up's fix (JPEG background, downscaled logo, prefetch)
addressed two of the screen's assets but missed a third: the 5 leaf
sprites (`assets/leaf01-05.png`), which the user had supplied directly
(replacing `leaf02`, adding `leaf05` — see the redesign's original entry
above) and which were never revisited for size afterward. Measured via
Pillow: up to **1536×1024 RGBA PNGs, 1.1–1.7MB each, ~7.4MB combined** —
despite every leaf displaying at only 28–46px on screen. Decoding all 5 of
those simultaneously on mount (on top of the background/logo) was the
actual remaining bottleneck.
- **Downscaled all 5 leaves** to fit a 220×220 box (3x-density headroom
  over the largest actual display size, 46px), alpha preserved (still
  PNG — these need transparency, unlike the photographic background):
  `leaf01` 1164×1351→190×220, `leaf02` 1342×1172→220×192, `leaf03`/`leaf04`/
  `leaf05` 1536×1024→220×147. Combined size **7.4MB → ~145KB** (~98%
  reduction), no visible quality loss at their actual on-screen size.
- **`login.tsx`'s prefetch effect extended** beyond just the background to
  also prefetch the logo and all 5 (now-tiny) leaf sources — previously
  only `login_background.jpg` was prefetched from the previous screen; the
  logo was assumed already-warm from `LoginOrbitHud` rendering it at a
  different size (82px vs. this screen's 130px), which may not actually
  share a decoded-bitmap cache entry across sizes depending on platform, so
  it's now prefetched explicitly here too rather than relying on that
  assumption.
No further code changes to `thera-login.tsx` itself — this was purely an
asset-weight + prefetch-coverage fix. `npx tsc --noEmit`/`npx expo lint`
clean, same 12-warning baseline.

## Welcome screen redesign (2026-08-23)

`app/(onboarding)/welcome.tsx` (the very first screen the app shows) got a
full visual redesign to match a supplied reference image: a full-bleed hero
photo (`assets/welcome.jpg` — a woman mid-exercise pose on a glowing
pedestal, user-supplied, same treatment as `login_background.jpg`) behind
the brand header, with 4 floating "glass" stat cards positioned over it
(Lộ trình checklist, Tiến độ tuần này progress ring, Năng lượng bar, Chuỗi
ngày streak) and two simplified pill buttons at the bottom. Previous
version was a single centered column on the plain `theme.colors.bgApp`
background with the stock `Button` component (icon-capable, variant-based)
— replaced entirely; nothing here reuses `ScreenContainer`/`Button` since
the visual language (full-bleed photo, glass cards, gradient pill) is
custom to this screen, same precedent as `login.tsx`/`thera-login.tsx`.

**Asset**: the user-supplied `welcome.png` was a 1.46MB lossless PNG of
photographic content — same class of problem fixed for
`login_background.jpg` earlier this session (PNG is a poor fit for a photo,
and this is the app's very first screen, so any decode delay here is the
worst possible place for it). Converted to `welcome.jpg` (quality 90) before
ever wiring it up: 1.46MB → 143KB, ~90% smaller, no visible quality loss
verified by rendering both and comparing (the smooth gradient sky is the
highest-risk area for banding — none visible). No PNG version was kept.

**Card positioning**: the 4 cards are absolutely positioned using
percentage `top`/`left`/`right` values against the full screen, not pixel
math — this works cleanly because `welcome.jpg`'s own aspect ratio
(852×1847 ≈ 0.4614) was supplied already close to a typical phone screen's
(e.g. iPhone 14: 390×844 ≈ 0.4621, the same trick already noted for
`login_background.jpg`), so `resizeMode="cover"` crops very little and a
screen-relative fraction lands close to the same point in the photo's own
composition (the raised arm, the pedestal) regardless of device. Tuned by
rendering the actual final percentages as boxes over the real
`welcome.jpg` asset with Pillow and comparing against the reference image,
same empirical verification style used throughout this session for
asset-alignment work (no simulator available here).

**Animated stat cards** (the explicit second ask — "thêm hiệu ứng động"):
- `src/hooks/useCountUp.ts` (new) — a small reusable hook animating a
  displayed integer 0 → target via `requestAnimationFrame` (plain React
  state, not a reanimated worklet — there's no cheap way to drive live text
  content off the UI thread without extra plumbing, and a once-per-frame JS
  state update for a single number is negligible). Respects
  `useReduceMotion()` by jumping straight to the target. Used for the
  weekly-progress ring's "78%", the energy bar's "86%", and the streak
  count's "12".
- The weekly-progress ring is a `react-native-svg` `Circle` +
  `Animated.createAnimatedComponent(Circle)` `strokeDashoffset` tween via
  `useAnimatedProps` — same idiom already established in
  `WaterCard.tsx`/`AnalyzingHud.tsx`/`RoadmapReadyTimeline.tsx`, not a new
  pattern.
- The energy bar is a `width: '${progress*100}%'` tween inside an
  `overflow: hidden` track (reanimated `useAnimatedStyle`).
- The streak card's 4-bar mini sparkline (`StreakBars`/`StreakBar`) uses one
  shared `t` value (0→1) with each bar's height derived via
  `interpolate(t, [barDelay, barDelay+0.5], [0, targetHeight],
  Extrapolation.CLAMP)` inside its own `useAnimatedStyle` — deliberately not
  4 separate `useSharedValue` calls in a `.map()` (would violate the rules
  of hooks); one shared driver value, per-bar delay only affects the
  interpolation window.
- The checklist's 3 checkmarks pop in via reanimated's `ZoomIn` entering
  preset, staggered 180ms apart — reads as "being checked off" on mount.
- The 4 cards themselves also stagger in via the existing
  `fadeUpEntering()` helper from `src/lib/motion.ts` (200/260/320/380ms),
  the same "reveal once on mount" convention used everywhere else in the
  app (Home's cards, Roadmap's day list, ...).

**Buttons**: per explicit instruction, simplified to centered text only —
no icon, no chevron — despite the reference image showing both. Primary
("Bắt đầu cho người mới") is a gradient pill using `react-native-svg`'s
`LinearGradient`/`Rect` behind the text (the established "no
`expo-linear-gradient`, use `react-native-svg`'s own gradient" pattern from
`LoginOrbitHud.tsx`), wrapped in a local `PressScale` (1→0.985 press
feedback) — the same small helper `login.tsx` defines locally for its own
buttons, duplicated here rather than extracted, matching this flow's
existing "each onboarding screen is self-contained" convention. Secondary
("Đã có tài khoản") is a plain translucent-white outlined pill, same
height/radius as the primary button.

**Deliberately omitted**: the reference image's top-left settings gear
icon. It wasn't part of either explicit ask (redesign-to-match-image was
scoped by the accompanying button/animation instructions, which didn't
mention it), and there's no settings destination that makes sense pre-auth
in this app yet — rendering a tappable gear that goes nowhere would be a
worse outcome than a small fidelity gap. Easy to add later if a real
pre-auth settings surface (e.g. language picker, reusing
`useAppStore`'s existing `language`/`setLanguage`) is wanted.

Added `zap`/`flame` to `Icon.tsx`'s name→lucide-icon map (used by the
Năng lượng/Chuỗi ngày cards) — both already present in the installed
lucide version, no new dependency.

Verified via `npx expo export --platform ios` (full Metro bundle, since
there's no simulator here) both before and after the PNG→JPEG asset swap,
plus the Pillow-composite layout check described above.
`npx tsc --noEmit`/`npx expo lint` clean, same 12-warning baseline.

**Follow-up pass, same day — real logo, continuous "spatial UI" motion,
streak-card color fix, glassmorphism/3D card treatment**:

- **Logo**: the first pass used `BrandMark.tsx` (a hand-approximated SVG,
  explicitly documented elsewhere in this file as *not* the actual designed
  icon artwork) recolored blue. Per explicit feedback to use the app's real
  logo, swapped to the real artwork — but `brandmark-glow.png` (the existing
  asset for this) is white-on-transparent, built specifically for the dark
  backgrounds `login.tsx`/`thera-login.tsx`/`AnalyzingHud.tsx` render it on;
  composited onto this screen's light hero photo it was nearly invisible
  (verified by rendering it — confirmed all-white/no visible contrast).
  Rather than reach for `BrandMark.tsx` again, generated
  **`assets/brandmark-blue.png`**: the identical alpha mask from
  `brandmark-glow.png`, recolored to the app's electric blue (`#078BFF`)
  via a Pillow RGB-channel swap with the alpha channel untouched — same
  real logo artwork, just the color variant this screen's light background
  actually needs. `welcome.tsx` now renders it as a plain `Image`, not
  `BrandMark`.
- **Continuous motion, no stutter**: the first pass's card/checkmark
  animations were mount-only (play once, then sit still) and the streak/
  energy/ring numbers only counted up once — read as static after ~1.3s,
  not the "living dashboard" the brief wanted. Added a `FloatingCard`
  wrapper: each of the 4 cards now has a perpetual, independent, UI-thread
  `withRepeat` hover (a few px of `translateY`, ~2.8s per leg, staggered
  start delay per card) so they read as continuously floating rather than
  static once settled. `AmbientGlow` (new) adds 10 small twinkling
  particles + 2 faint diagonal light lines behind the cards, each particle
  on its own slow independent opacity loop, staggered — reads as one
  connected "digital wellness ecosystem" per the brief without being a
  strong sci-fi effect (low opacity throughout, blue-only palette, small
  particle count). Everything continuous is opacity/transform only via
  reanimated `withRepeat` (UI thread) — none of it depends on JS-thread
  React re-renders, so it can't stutter from anything else happening on the
  screen; the one-shot load animations (count-up, ring reveal, checkmark
  pop-in) are deliberately left one-shot (they represent data loading in,
  not ambient motion, so replaying them continuously would be wrong) but
  don't re-fire on re-render since their `useEffect` deps are stable.
- **Streak card recolored**: the flame icon and mini-bars were orange
  (`#FF9D00`), inconsistent with every other card's blue accent — per
  explicit "màu đồng bộ" (consistent color) feedback, both now use the same
  `BLUE` (`#078BFF`) as the rest of the screen. No card uses orange (or any
  color beyond white/electric-blue/navy/gray) anymore, matching the
  supplied "white and electric blue palette" spec.
- **Glassmorphism 3D card treatment**, replacing the first pass's flat
  cards, per the detailed spec supplied: `borderRadius` 18→24, a thin
  glowing outer ring (`cardGlowRing`, a slightly-larger transparent-fill
  rounded rect with a faint blue border — the cheapest available
  approximation of an outer glow without a real blur filter, same
  "duplicate-and-fade" trick `LoginOrbitHud.tsx` already uses for its
  energy arcs), a top-edge "glass sheen" highlight bar, and a stronger,
  bluer, larger-radius shadow (`shadowColor` swapped from a muted
  `#5B87C9` to the electric blue `#00A8FF`, `shadowRadius` 14→20) so cards
  read as hovering above the photo rather than sitting flat on it. Real
  frosted-glass blur-through-background remains out of reach without
  `expo-blur` (same constraint noted throughout this session — no new
  native dependency requiring an unverifiable rebuild), so the translucent
  white fill continues to approximate it, unchanged from the first pass.
  **3D perspective**: each card gets a fixed `rotateY`/`rotateZ` tilt via
  `transform: [{ perspective }, { rotateY }, { rotateZ }, { scale }, ...]`
  — left-side cards tilt one way, right-side cards the opposite way (as if
  angled toward the figure), top cards render ~4% larger than bottom ones
  (`scale: 1.04` vs `0.94`). Positions were nudged slightly asymmetric
  (36%/40% top-side offsets, 56%/58% bottom-side offsets, varying float
  delays per card) per the "balanced but not perfectly symmetric" note,
  and the top-right card was moved (`top` 37%→40%, `right` 5.5%→3%) after
  a Pillow composite check showed it was sitting close enough to the
  figure's raised hand to risk overlapping it — re-verified clear after
  the move, alongside re-confirming none of the 4 cards overlap the face
  or torso.

Verified via `npx expo export --platform ios` (bundles cleanly with the new
`brandmark-blue.png` asset) and fresh Pillow composites of the real
`welcome.jpg` + real `brandmark-blue.png` at their actual on-screen
positions/sizes (logo contrast, all 4 card placements) — no simulator
available here. `npx tsc --noEmit`/`npx expo lint` clean, same 12-warning
baseline.

**Third follow-up, same day — reliable continuous motion, re-centered hero
photo, and a full glassmorphism/3D rewrite per a detailed design spec**:

- **Continuous floating motion made more robust**: reported as "the
  animated effects only play once then stop." The previous pass's
  `FloatingCard` hover already used `withRepeat(..., -1, true)` (reanimated's
  own reverse flag), which should loop indefinitely — but rather than trust
  an unverifiable-without-a-device mechanism, switched to the same explicit
  `withRepeat(withSequence(withTiming(1,...), withTiming(0,...)), -1, false)`
  pattern `thera-login.tsx`'s falling-leaf sway already uses successfully,
  which makes the loop's up/down halves unambiguous. Separately — and more
  likely the actual cause — `energyPercent`/`streakCount` (the two
  `useCountUp` calls that used to live directly in `WelcomeScreen`'s own
  body) were re-rendering the *entire* screen on every animation frame for
  the ~0.9-1.2s they ran (a `useCountUp` tick is a plain React state update
  per `requestAnimationFrame`), which meant every card's `entering` prop
  was being recreated ~60-80 times right as the cards were first appearing.
  Moved both into their own leaf components (`EnergyStat`, `StreakStat`,
  new) that own their `useCountUp` tick locally — `WelcomeScreen` itself no
  longer re-renders during the count-up window at all, which both removes
  the most likely stutter source and is a straightforwardly better
  ownership boundary regardless.
- **Hero photo re-centered**: the user replaced `assets/welcome.png` with a
  version where the figure sits closer to true horizontal center (previously
  slightly left-biased). Re-ran the same PNG→JPEG optimization pass as
  before on the new file (1.55MB → 177KB) and re-derived every card
  position fraction from scratch against the new asset via fresh Pillow
  composites, rather than assuming the old fractions still applied.
- **Full glassmorphism/3D card rewrite** per a detailed supplied spec:
  - Glass fill changed from plain white to a faint blue-tinted white
    (`rgba(237,247,255, α)`), α at two tiers — 0.85 for the top (closer)
    cards, 0.78 for the bottom (farther) ones — the spec's "cards nearer the
    figure render sharper/more opaque, farther ones read as sitting deeper
    in space" depth cue, on top of the existing smaller `scale` already
    applied to the bottom row.
  - Border: thin (1px) white-blue (`rgba(214,236,255,0.9)`) — the previous
    pass's plain near-white border read as too neutral against the spec's
    explicit "no heavy blue border" + "very faint cyan-tinted edge" ask.
  - **Two-layer shadow**, since RN only gives one native shadow per `View`:
    an outer `cardGlow` wrapper (`shadowOffset: {0,0}`, large radius, blue)
    approximating the spec's symmetric ambient glow
    (`0 0 25px rgba(70,190,255,0.10)`), wrapping the inner `card` (its own
    smaller-offset, directional shadow, approximating
    `0 18px 45px rgba(55,130,255,0.12)`) — two nested shadow-casting Views,
    the standard RN approximation of a CSS multi-layer `box-shadow`.
  - **3D tilt values matched exactly to the spec**: TL `rotateY(6°)
    rotateZ(-2°)`, TR `rotateY(-6°) rotateZ(2°)`, BL `rotateY(4°)
    rotateZ(-2°)`, BR `rotateY(-4°) rotateZ(2°)` (previously 8°/6° —
    tightened to the spec's explicit "not more than 8-10°, weaker on the
    smaller bottom cards" values).
  - **Card widths as an explicit fraction of `Dimensions.get('window').width`**
    (`ROUTINE_W`/`PROGRESS_W`/`ENERGY_W`/`STREAK_W`, 30/25.5/19.5/20.5%,
    upper end of each range the spec gave) rather than the previous
    content-sized boxes — required shrinking several font sizes (e.g.
    checklist label 12→10.5, card title 12.5→11.5) and tightening a few
    internal gaps to keep "Tăng cường" (the widest checklist item) from
    overflowing the now-narrower routine card; checked against the real
    Inter font metrics (`node_modules/@expo-google-fonts/inter`) via Pillow
    rather than guessing, since text overflow isn't visible in a static
    layout dump the way a missing asset or wrong color would be.
  - **Connecting light lines removed.** The previous pass's two faint
    diagonal `glowLine` Views were dropped entirely — the spec explicitly
    called out not connecting cards with lines ("giống network diagram");
    only the small twinkling particle dots (`AmbientGlow`) remain, count
    trimmed slightly and opacity lowered further to stay "cực nhỏ."
  - Card positions re-tuned against the re-centered photo: TL/TR both at
    `top: 40%`, `left`/`right: 4.5%`; BL at `top: 56.5%, left: 2%`; BR at
    `top: 52%, right: 2%` — deliberately uneven top offsets between BL and
    BR (56.5% vs. 52%) per the "not a rigid grid" note, re-verified clear of
    the face/arms/legs via fresh Pillow composites at these exact
    fractions.

Verified via `npx expo export --platform ios` (bundles cleanly) and Pillow
composites of the real (re-centered) `welcome.jpg` at the exact final
card fractions, plus a font-metrics check for text-overflow risk in the
narrowest card. `npx tsc --noEmit`/`npx expo lint` clean, same 12-warning
baseline. Still not verified on an actual device/simulator — worth
confirming the floating motion reads as smooth and continuous, and that
none of the tightened card text wraps awkwardly on a real narrow device
(e.g. iPhone SE, 375pt).

**Fourth follow-up, same day — clarified what "continuous" actually meant,
stronger 3D tilt, more card spacing**: the previous pass made the *cards*
hover continuously while the stat numbers/progress played once and held.
Feedback flipped that: the cards can be static, but the numbers/progress
inside them are what should run continuously.

- **`FloatingCard`'s hover motion removed entirely** — it's now a plain
  `View` with a static `transform` (no `useSharedValue`/`useEffect`/
  `withRepeat` left in it at all), just the fixed 3D tilt. `perspective`
  also dropped `900 → 650` (a *smaller* perspective distance reads as a
  *stronger* 3D foreshortening for the same rotation angle — standard for
  RN/CSS 3D transforms), and every card's `rotateY`/`rotateZ` roughly
  doubled: TL `14°/-4°`, TR `-14°/4°`, BL `10°/-4°`, BR `-10°/4°` (was
  6°/4°) — noticeably more "angled panel in space" without tipping into
  the illegible-at-a-glance range.
- **`useCountUp` (`src/hooks/useCountUp.ts`) gained a `loop` mode**: rise to
  `target` → hold ~1s → ease back to 0 → rise again, indefinitely (still
  respects Reduce Motion by jumping straight to `target` and skipping the
  loop). The weekly-progress ring's `strokeDashoffset` tween, the energy
  bar's fill tween, and the streak mini-bars' shared `t` value all got the
  matching reanimated-side treatment
  (`withRepeat(withSequence(riseTiming, withDelay(hold, fallTiming)), -1,
  false)`) so the visual (ring/bar/bars) and the numeral next to it stay in
  sync through every cycle — the weekly ring, "86%" energy readout, and
  streak "12" now read as a live, continuously-updating dashboard rather
  than a one-time load-in. The routine card's checklist is deliberately
  unchanged (still a one-time pop-in) — it's a static list, not a
  number/progress metric, so it wasn't part of this ask.
- **More clearance between cards**: left/right margins widened (4.5%→6%
  for the top pair, 2%→4% for the bottom pair) and the bottom pair's
  vertical offsets pushed down further from the top pair (56.5%/52% →
  59%/55%) — partly requested directly ("tách ra đừng đè vào nhau"), partly
  a hedge against the now-stronger tilt visually extending a card's
  apparent footprint slightly beyond its untransformed layout box.
  Re-verified via a fresh Pillow composite against the real photo that all
  4 cards still clear the figure and now sit clearly apart from each other.

`npx tsc --noEmit`/`npx expo lint` clean, same 12-warning baseline;
`npx expo export --platform ios` bundles cleanly. Still no simulator
available here — worth confirming on-device that the loop's rise-hold-fall
rhythm feels natural rather than distracting, and that the stronger tilt
doesn't read as excessive on an actual screen.

**Fifth follow-up, same day — slower loops, and a full re-spec against a
detailed glassmorphism brief**: two asks. (1) slow down the stat loop
cadence. (2) a very specific design brief (exact rgba/hex values, card
sizes, per-card content layout) to match, which supersedes several of the
previous pass's choices — notably it re-requests card hover motion after
the pass before this one had explicitly removed it; treated as the latest,
more detailed instruction taking precedence.

- **Loop cadence slowed**: `LOOP_RISE`/`LOOP_HOLD`/`LOOP_FALL` (2000/1600/
  800ms, shared across the ring, energy bar, and streak bars/counts) replace
  the previous pass's faster, slightly different-per-stat numbers
  (~1200-1300/1000/550) — a noticeably calmer rise-hold-fall rhythm.
- **Card hover reinstated, slower and phase-staggered**: `FloatingCard` is
  an `Animated.View` again with a `translateY` loop, but tuned to the new
  ask specifically — 4-6px range (settled on ±5px), 5s per leg (~10s full
  cycle, vs. the ~2.4s/leg of the version removed two passes ago), and each
  card starts its loop at a different `floatDelay` (0/800/1600/2400ms) so
  the 4 cards drift out of sync with each other.
- **Exact palette from the brief**: introduced `BLUE_1`
  (`#2563EB`)/`BLUE_2` (`#3B82F6`)/`BLUE_3` (`#60A5FA`)/`BLUE_4`
  (`#93C5FD`)/`TEXT_DARK` (`#1E3A5F`)/`TEXT_GRAY` (`#6B7280`)/`TRACK`
  (`#E5EAF2`) as this screen's own card palette, distinct from the app's
  established onboarding blue (`#078BFF`, still used for the header
  logo/subtitle and the two bottom buttons, which weren't part of this
  card-specific brief). Every card title switched from gray to bold dark
  blue (`TEXT_DARK`) per the brief — previously all 4 were gray.
- **Glass fill lightened**: `rgba(255,255,255,0.6)` (was 0.78/0.85,
  and the near/far two-tier opacity dropped — the brief gives one uniform
  0.55–0.65 range for all 4 cards). Border simplified to
  `rgba(255,255,255,0.8)`.
- **Shadow simplified to one layer** (the brief gives a single
  `box-shadow`, not the earlier two-layer ambient+directional
  approximation): `shadowColor: '#3B82F6', shadowOpacity: 0.15,
  shadowRadius: 18, shadowOffset: {0,12}` on the card's outer wrapper.
- **Tilt matched to the brief's smaller range** (3-6°, down from the
  previous pass's 10-14°) via `perspective(800)` + `rotateY` only (dropped
  `rotateZ` — the brief only calls out `rotateX`/`rotateY`); left cards
  tilt positive, right cards negative, reading as angled toward the figure.
- **Per-card content redone to match the brief exactly**:
  - Routine card: calendar badge is now a small gradient-filled circle
    (`GradientBadge`, a tiny inline `Svg` — RN `View`s can't gradient-fill
    without one) instead of a flat blue circle; each checklist row gained a
    left-side hollow "radio" circle (previously just a bullet dot) and the
    checkmark is now a small solid blue circle with a white check icon
    inside (previously a bare check glyph).
  - Progress ring: gradient stroke (`BLUE_1 → BLUE_3`) via an `<Svg>
    <LinearGradient>`, `url(#ringGrad)` — previously a flat color stroke.
    Track color switched to `TRACK`.
  - Energy bar: rebuilt from a plain `View` fill (which can't gradient) to
    an inline `Svg`/`Rect` with `animatedProps` driving its `width`, filled
    `BLUE_1 → BLUE_4` via `LinearGradient`.
  - Streak card: the mini chart is no longer 4 uniform growing bars — it's
    now 2 small static faint dots (`rgba(59,130,246,0.35)`, "days not yet
    completed") followed by 3 taller ascending bars that still grow via the
    same looping shared-value approach as before, matching the brief's
    "2 faint dots then ascending solid columns" description. The card's
    title is right-aligned per the brief ("căn phải hoặc căn giữa").
- **Card widths increased slightly** (Routine 30→31%, Progress 25.5→26%,
  Energy/Streak 19.5-20.5→21% of screen width) to keep their relative size
  ratios closer to the brief's reference dimensions (Routine the largest,
  Progress roughly square, Energy/Streak the two smallest) while the glass
  fill is now more transparent.

`npx tsc --noEmit`/`npx expo lint` clean, same 12-warning baseline (hit one
real `StyleSheet.absoluteFillObject` type error along the way — this RN
version's types don't have it, same gotcha documented earlier for
`thera-login.tsx`/`CommunityVideoPlayer.tsx` — fixed the same way, an array
style with `StyleSheet.absoluteFill`). `npx expo export --platform ios`
bundles cleanly; re-verified via fresh Pillow composites that all 4 cards
still clear the figure and each other at the new sizes/positions. Still no
simulator here — worth confirming on-device that the reinstated hover
motion at this slower cadence reads as calm rather than distracting, and
that the SVG-based animated energy-bar width doesn't have any
platform-specific rendering quirk (its `animatedProps`-driven percentage
`width` on a plain `Rect` is a pattern not used elsewhere in this repo yet).

**Sixth follow-up, same day — the % readouts are now derived from the same
value that draws each visual, not independently timed**: reported as
"the progress bar/ring and the number must correspond to each other,
0-100%," alongside a reference image confirming the overall card design
was already close (one concrete miss: the streak card's title was
right-aligned, should be left — fixed, `cardLabelRight` style removed).

Root cause: the previous passes' "%" readouts came from `useCountUp`, a
plain JS-thread `requestAnimationFrame` loop running on its own clock,
timed to *match* — via identical duration/delay/easing constants — the
separately-driven reanimated shared value actually drawing the ring/bar/
bars on the UI thread. Two independently-clocked infinite loops given
matching parameters can still drift apart over time (JS thread scheduling
jitter, bridge/JSI timing, GC pauses — none of it bounded), so "give both
loops the same numbers" only approximates sync, it doesn't guarantee it.

Fixed by removing `useCountUp` from this screen entirely and deriving each
displayed number directly from the shared value that already drives its
visual, via `useAnimatedReaction`:
```ts
useAnimatedReaction(
  () => Math.round(progress.value * 100),
  (current, previous) => {
    if (current !== previous) runOnJS(setPercent)(current);
  },
);
```
This makes drift structurally impossible — the number *is* the visual's
current value, not a second animation aimed at matching it. Applied to all
3 stats:
- `WeeklyProgressRing`: `percent` now derived from the same `progress`
  shared value that sets the ring's `strokeDashoffset`.
- Energy: the `fill` shared value moved up from `EnergyBar` into
  `EnergyStat` (which now owns it and passes it down as a prop) so both the
  bar's width and the "86%" text read the same source.
- Streak: same lift for `t`, from `StreakBars` up into `StreakStat`. Also
  tightened each mini-bar's own delay window (`i * 0.25` instead of
  `i * 0.2`) so the last bar finishes growing at exactly `t === 1`, the
  same instant the derived count reaches `target` — previously the bars
  finished slightly earlier than the number.

`useAnimatedReaction`'s default change-detection (compares the "prepare"
function's *return value*, not the raw shared value) means rounding
*inside* the prepare callback is what keeps `runOnJS` from firing on every
sub-integer float change — it only fires when the rounded display value
actually changes, so this is cheap even though the underlying shared value
updates every frame for ~64% of each loop cycle (idle during the hold
phase, where the shared value is constant and no reaction fires at all).

`src/hooks/useCountUp.ts` was deleted — after this change nothing in the
repo calls it anymore (`grep` confirmed), and it was purpose-built for the
now-superseded approach rather than a general utility anything else was
using.

`npx tsc --noEmit`/`npx expo lint` clean (0 errors, same 12-warning
baseline — actually *simpler* now, one fewer file). `npx expo export
--platform ios` bundles cleanly. Still no simulator here — the sync fix is
correct by construction (same source of truth for both the number and the
visual), but worth a final on-device look to confirm the streak bars'
retimed stagger still looks natural.

**Seventh follow-up, same day — the whole custom card overlay was removed,
because the image grew the cards itself**: the user replaced
`assets/welcome.png` again, and this version bakes the 4 stat cards, the
orbiting ring/dots decoration, and all the glow/particle flourishes
directly into the photo — it's no longer a plain hero shot with blank
space for an overlay. Explicit follow-up instruction: no more
animation/effects needed. Two changes, not really separable:

- `app/(onboarding)/welcome.tsx` shrank from the elaborate card system
  (`FloatingCard`, `WeeklyProgressRing`, `EnergyBar`/`EnergyStat`,
  `StreakBars`/`StreakStat`/`StreakDot`/`StreakBar`, `ChecklistRow`,
  `GradientBadge`, `AmbientGlow`/`Particle`, and every reanimated-driven
  loop/tilt/hover/particle-twinkle effect built across the last several
  passes) down to just: the background image, the header text block (logo,
  title, subtitle, description — unchanged, still not baked into the
  image), and the two bottom buttons — all fully static now, no
  `react-native-reanimated` import left in the file at all. The buttons
  kept a plain `Pressable`-driven opacity swap on press (`pressed &&
  styles.btnPressed`) rather than the reanimated `PressScale` wrapper used
  elsewhere in this flow — a instant style swap on tap isn't the kind of
  decorative "animation/effect" this request was about (every button
  anywhere in the app has *some* press feedback), but the elaborate
  spring-loaded scale wrapper was removed along with everything else.
- `src/hooks/useCountUp.ts` doesn't need re-deleting (already gone from the
  previous pass); nothing new was left orphaned since this pass only
  removed code, it didn't introduce a new hook.
- Re-verified via a Pillow composite that the (unchanged) header text block
  comfortably clears the image's now-baked-in orbiting ring decoration —
  the header's bottom edge lands at ~32% of screen height, the ring's own
  bottom edge at ~25%, and the baked-in cards don't start until ~37%, so
  there's real clearance on both sides even though the header was never
  repositioned for this new image.

Asset re-optimized the same way as every prior `welcome.*` replacement this
session: PNG → JPEG quality 90 (1.35MB → 149KB, ~89% smaller), verified
side-by-side for visible quality loss (none) before landing, old PNG
removed.

`npx tsc --noEmit`/`npx expo lint` clean (0 errors, same 12-warning
baseline). `npx expo export --platform ios` bundles cleanly.

**Eighth follow-up, same day — another asset-only refresh**: the user
replaced `assets/welcome.png` once more (same composition/layout as the
previous version — cards, ring, and figure all in essentially the same
positions, just a visual refinement pass on the source art). Same
filename, so `welcome.tsx` (now fully static per the previous entry)
needed no code changes at all — just re-ran the standard PNG→JPEG
optimization (1.6MB → 163KB, ~90% smaller, no visible quality loss) and
swapped the file. `npx tsc --noEmit`/`npx expo lint` clean, `npx expo
export --platform ios` bundles cleanly.

**Ninth follow-up, same day — another asset swap, flagging a real content
change this time**: same routine (PNG→JPEG, 1.72MB → 172KB, no visible
quality loss, old file removed, no code changes needed since the filename
is unchanged) — but unlike the previous two swaps, this version's
composition actually changed: the 4 stat cards ("Lộ trình" / "Tiến độ tuần
này" / "Năng lượng" / "Chuỗi ngày") that had been baked into the image for
the last two updates are gone. The orbiting ring decoration, the figure,
the pedestal, and the wave/particle floor are all still there. Since
`welcome.tsx` no longer renders any card UI of its own (removed entirely
per the "no animation/effects needed" request two entries above, on the
assumption the image was the permanent source for the cards), the welcome
screen will now show *no* stat cards at all — just the figure, the ring,
the header text, and the two buttons. Flagged to the user rather than
silently either leaving it as-is or speculatively rebuilding the card UI —
worth confirming whether this was intentional (a simpler final design) or
the cards should come back, either baked into a future image update or as
a rebuilt React Native overlay.

## Store perf, local-reminder inbox sync, "Gợi ý cho bạn" article cards, feed truncation (2026-08-23)

A bundle of independent fixes/features from the same request, spanning both
this repo and TheraHOME WEB — see that repo's CLAUDE.md for the WEB-side
half (Modal backdrop-click bug, Admin nav change, pin-with-display-info
flow).

**Store tab image slowness fixed via prefetch, not `expo-image`.** Root
cause: `(tabs)/_layout.tsx`'s `<Tabs>` has no `lazy={false}`, so Store's
screen (and its `useStoreCategories` query + every product `<Image>`) only
starts loading the first time a user actually taps that tab — worst right
after a cold launch, matching the report exactly. `useStore.ts` was
refactored to extract `fetchStoreCategories(market)` + a
`storeCategoriesQueryKey(market)` helper shared by both `useStoreCategories`
(the hook) and a new `prefetchStoreCategories(queryClient, language)`, which
`app/(tabs)/home.tsx` now calls once on mount — it warms the exact same
react-query cache entry Store's own hook reads, then `Image.prefetch()`s
every item's `imageUrl`. Same "prefetch from the previous screen" pattern
already used for `thera-login.tsx`'s background image, just applied to
admin-managed remote data instead of a bundled asset — deliberately not
`expo-image` (not a dependency of this project, and adding one hits the
same can't-rebuild-to-verify constraint noted elsewhere in this file).

**Local daily/evening reminders now sync into the notification center.**
These two are the only notifications in the app that are purely
device-scheduled (`expo-notifications`, no server involved) — every other
type (inactivity, streak, chat, community, ad campaigns) already writes its
`notifications` row server-side *before* the push is sent (see
dispatch-push/dispatch-system-notifications), so it survives regardless of
whether the push itself is seen. The two local reminders had no such row at
all — dismissed unread, they were simply gone. Fixed via a new SECURITY
DEFINER RPC, `record_local_reminder_notification(p_title, p_body,
p_destination)` (scoped to inserting exactly one row for the caller's own
`auth.uid()`, type hardcoded to `'schedule'` — there's deliberately no plain
INSERT policy on `notifications` for regular users, every writer is either
a service-role function or a narrow RPC like this one). `scheduleReminder`
in `pushNotifications.ts` now tags each local notification's `data` with a
`reminderKind: 'daily' | 'evening'` marker; a new
`registerLocalReminderInboxSync(getUserId)`, registered once from
`app/_layout.tsx`, listens via `Notifications.addNotificationReceivedListener`
and calls the RPC only for notifications carrying that marker (so remote
pushes, which already have their own row, never get double-inserted).
**Known limitation, inherent to a purely local reminder**: the listener
only fires while the app is actually alive (foreground or backgrounded) —
a reminder that fires while the app is fully killed and gets swiped away
unopened has no event this code can observe, so it won't be backfilled.
Fixing that fully would mean turning these into server-sent pushes, a
bigger change than this pass.

**Home's "Bài viết từ TheraHOME" renamed to "Gợi ý cho bạn"** (`articlesFrom`
i18n key, all 3 languages) and redesigned around a new shared
`src/components/community/ArticleCard.tsx`: white card, large radius, soft
shadow, split left (logo + "TheraHOME" + blue verified tick + time + bold
2-line title + 2-line description) / right (rounded thumbnail) — no
like/comment/save icons, ends in a plain blue "Xem thêm →" text CTA instead,
since this is a curated editorial card, not a social post. The same
component now also renders Community's pinned slot (previously the pinned
post just sorted to the top of the regular feed with a tinted background —
now it gets its own featured card above the feed, and is excluded from the
regular list to avoid showing twice; the "TheraHOME" filter tab still lists
it inline like every other official post, unchanged).

Both placements read through a new `pinnedDisplay(post)` helper in
`useCommunity.ts`, which resolves staff's curated `pinnedTitle`/
`pinnedContent`/`pinnedThumbnailUrl` (new nullable columns on
`community_posts`, see WEB's CLAUDE.md for the admin-side pin flow that
sets them) when present, falling back to the post's own `title`/`text`/
`imageUrl`/first of `mediaUrls` otherwise — works identically for pinned
and non-pinned official posts, so both Home's "newest" card and
Community's pinned card use the same resolution logic.

**Feed post content now truncates with an inline "Xem thêm"**, matching
familiar social-feed behavior — distinct from `ArticleCard`'s CTA, which
navigates to the full post; this expands in place, no navigation. New
`src/components/community/ExpandableText.tsx`: title stays a plain
`numberOfLines={2}` (shows fully if it already fits, clips with an ellipsis
otherwise — no extra logic needed, that's just default RN `Text`
behavior), but *content* needed a custom component since RN's
`numberOfLines` alone can't report whether text overflows a clamp once
the clamp is already applied (`onTextLayout` only ever reports the
already-truncated line count at that point) — so it renders one invisible,
full-height measuring pass first (`position: absolute, opacity: 0`, same
double-render-to-measure technique `Collapsible.tsx` already uses
elsewhere) to decide once whether the toggle is needed, before the real,
correctly-sized-from-frame-one text ever paints — avoids a visible
height-collapse flash in a scrolling `FlatList`. Wired into both the main
feed (`app/(tabs)/community/index.tsx`) and the profile's own-posts list
(`app/community/profile/[userId].tsx`); Post Detail is untouched (that's
already the "full text" destination).

`src/types/database.ts` regenerated twice this pass (once for the 3 new
`community_posts` columns, once for the new RPC) — see WEB's CLAUDE.md for
the actual migrations. `npx tsc --noEmit`/`npx expo lint` clean (0 errors,
same 12-warning baseline) and `npx expo export --platform ios` bundles
cleanly after every piece.

## Active Device Light removed (2026-08-23)

The traveling-light border animation on the Home/Roadmap device switcher
(`ProductDropdown.tsx`) — a comet of light circling the card border on
mount/device-switch — is gone per explicit request. `src/components/
ActiveDeviceLight.tsx` (the SVG comet, `strokeDashoffset`-animated via
plain RN `Animated`) is deleted; `ProductDropdown.tsx` dropped the
`triggerSize`/`lightRun`/`mountedOnce`/`previousProductId` state and the
effect that drove it — none of that existed for any other reason. The rest
of the dropdown (name, chevron, product-switch menu) is unchanged.

## Community video playback overhaul (2026-08-23)

Implemented the full autoplay/mute/immersive-viewer/single-active-video/
background-pause/loading/aspect-ratio behavior for Community videos —
previously videos never autoplayed, were unmuted by default with no custom
controls, tapping did nothing, multiple videos could play simultaneously,
and video aspect ratio was hardcoded (`16/9` single, fixed-square grid)
rather than read from the file.

**`src/store/useVideoPlaybackStore.ts`** (new, ephemeral zustand store,
not persisted) is the one thing every video-playback decision in Community
now goes through: `activeId` (the single video allowed to actually call
`.play()`) and `soundEnabled` (one global mute preference — TikTok/Reels-
style, not per-video: unmute once, later videos stay unmuted until muted
again). Every video component subscribes to `activeId === myId` and
derives its own `playing` purely from that boolean — claiming a new active
id automatically pauses whatever held it before, with no imperative
pause-callback registry. This is also what makes the immersive viewer
correctly pause the underlying feed video on open and hand playback back on
close: opening claims a distinct id, closing releases it, and the feed
item's own effect reclaims if it's still eligible — no special-case
"resume" code exists, it falls out of the store's reactivity.

**`src/components/community/CommunityVideoPlayer.tsx`** (new) is the one
implementation of a Community video item, replacing the near-duplicate
`CommunityPostVideo`/`GridVideo` that used to live inside
`CommunityPostImage.tsx`/`MediaGrid.tsx` (which only reacted to
`useIsFocused`, added earlier purely to stop a screen-left-behind-in-the-
stack audio bug — the new store subsumes that correctly). Takes
`shouldAutoplay` from the caller (see below) and reconciles it against a
local manual pause/play override that resets whenever `shouldAutoplay`
itself changes — so re-entering the viewport always autoplays fresh even
if the user paused it on a previous pass. `mode="single"` (the full-width
case) reads real dimensions from `expo-video`'s `sourceLoad` event
(`useEvent`/`useEventListener`, from the `expo` package — not used
anywhere else in this repo before) and shows the video `contain` at its
true ratio when `>= 4/5` (landscape/1:1/4:5), or `cover`-cropped to `4/5`
when narrower (9:16 and anything taller — a feed "preview"; the uncropped
video is reachable via the immersive viewer). Renders the mute/pause icon
overlay. `mode="grid"` (2+ media cells) keeps the pre-existing fixed-square
crop and is always muted, no icon overlay — too little room, and you can't
meaningfully hear 2+ tiny simultaneous videos anyway. A spinner overlays
while `player.status` (also via `useEvent`) is `'idle'`/`'loading'` — this
app has no video poster/thumbnail image anywhere
(`community_posts.media_urls` stores only the file URL, no separate
thumbnail column or upload-time frame extraction), so this is the
practical equivalent of "slow network → thumbnail + loading," not a real
video-frame thumbnail. A real poster pipeline would be a separate feature.

**`src/hooks/useAppIsActive.ts`** (new) — `AppState`-backed boolean,
folded into `shouldPlay` everywhere so backgrounding the app pauses
whatever's playing.

**`src/components/community/CommunityMediaViewer.tsx`** (new) — full-screen
immersive viewer, styled after the existing `src/components/
ChatMediaViewer.tsx` pattern (dark-backdrop `Modal`, close button) but
extended to page horizontally (`FlatList horizontal pagingEnabled`) across
a whole post's media list starting at the tapped index, not just one item.
Video pages get real `nativeControls` and always-unmuted playback (opening
the viewer is a deliberate "watch this" action, unlike the muted-by-default
feed). **`MediaGrid.tsx`** owns opening it (`viewerIndex` state) — every
cell, image or video, in both the 1-item delegate
(`CommunityPostImage.tsx`) and the 2+ grid, now opens it on tap; previously
tapping media did nothing.

**Viewport-based autoplay is FlatList-only, scoped to the main feed.**
`app/(tabs)/community/index.tsx` was converted from `ScrollView`+`.map()`
to `FlatList` specifically so `onViewableItemsChanged`/`viewabilityConfig`
(`itemVisiblePercentThreshold: 50`) could drive which post is the
autoplay candidate — the correct, idiomatic RN mechanism, and one rejected
in favor of hand-rolling scroll-offset math: this screen has several
conditionally-rendered banners above the list that would constantly shift
any hand-tracked item offsets. The conversion is mechanical — the same
JSX moved into `ListHeaderComponent`/`renderItem`/`ListFooterComponent`/
`ListEmptyComponent`, pagination became `onEndReached` instead of a manual
`onScroll` distance check, no business logic (reaction picker, context
menu, modals) changed meaning. Bonus: FlatList virtualization means
off-screen posts (and their video players) now unmount instead of every
post's video staying mounted at once, as before. Post Detail
(`app/community/[postId].tsx`) and the profile's own-posts list
(`app/community/profile/[userId].tsx`) get every other behavior (mute,
tap-to-immersive, single-active coordination, background pause, loading)
but not per-item viewport tracking — they aren't the "feed" the spec was
about. Post Detail's video autoplays once the screen is focused (the
existing `useIsFocused()` call, now driving this instead of the old ad-hoc
pause effect); the profile list doesn't autoplay at all, items start
paused and the pause/play icon starts them.

`src/lib/mediaKind.ts` (new) extracts the image/video URL-extension check
that was duplicated across `CommunityPostImage.tsx`/`MediaGrid.tsx` into
one `isVideoUri()`, now also used by `CommunityMediaViewer.tsx`.

`npx tsc --noEmit` and `npx expo lint` both clean (0 errors, the same
12-warning baseline, no new warnings) after every file and once more at
the end.

**Not verified on a device** (none available here) — worth checking:
autoplay actually triggering on scroll, sound persisting correctly across
videos after unmuting once, the immersive viewer correctly pausing the
feed on open and resuming it on close, backgrounding the app mid-play, and
a genuine 9:16 clip's in-feed crop vs. its full view in the immersive
viewer.

## System notification copy refresh + 3 new inactivity tiers (2026-08-23)

Migration `202608231400_system_notification_copy_refresh.sql`: rewrote the
`daily_workout`/`evening_reminder`/`inactive_2`/`inactive_3`/`inactive_5`/
`inactive_7` rows in `system_notification_templates` with new copy, and
added 3 new tiers — `inactive_4`, `inactive_10`, `inactive_14` (extending
the table's `template_key` check constraint) — each with its own distinct
title/body rather than the old shared generic "TheraHOME nhớ bạn" text.

`dispatch-system-notifications` (the daily inactivity-check worker) was
updated to match: the hardcoded `[2, 3, 5, 7]` day list (both the template
fetch's `.in(...)` and the per-profile day check) became a single
`INACTIVITY_TIERS = [2, 3, 4, 5, 7, 10, 14]` constant. `create_inactivity_notification`
places no constraint on which day values it accepts, so this needed no DB
function change — only the worker's own tier list. Redeployed (v4); the
local copy in `supabase/functions/dispatch-system-notifications/index.ts`
was kept in sync.

TheraHOME WEB's `NotificationsAdminView.tsx` (Admin → Thông báo → "Nội dung
hệ thống") reads its displayed key list from `Object.keys(META)`, not from
whatever rows exist in the DB — so the 3 new tiers needed `META` entries
there too (`db.ts`'s `SystemNotificationTemplateKey` type extended to
match) or they'd silently never render even though the DB rows exist. See
`TheraHOME WEB/CLAUDE.md` if further detail is needed there — this is a
content/config change, not an architecture one, so no separate WEB entry
was added.

Morning/evening reminder titles are now identical ("Đã đến giờ tập luyện")
by design per this request — only the body text distinguishes them. The
`{{day}}`/`{{days}}` template placeholders are unchanged from before.

## TheraHOME account login for WEB admin/cskh + `(staff)` mobile shell for CSKH (2026-08-23)

Two related changes, both from migration
`supabase/migrations/202608230900_thera_accounts_web_roles_and_admin_seed.sql`
(see `TheraHOME WEB/CLAUDE.md` for the WEB-side half in full):

**`profiles.account_type` now also drives WEB roles.** `current_web_roles()`
gained a second fallback branch — `account_type='admin'` → `{admin,cskh}`,
`'cskh'` → `{cskh}` — alongside the pre-existing `web_access_contacts`
lookup. This is what lets TheraHOME-issued accounts (username/password, no
OAuth — see "TheraHOME-issued accounts" above) log into TheraHOME WEB
directly, and it's also what this section's mobile shell is keyed on.
`profiles.username` (new column, unique case-insensitive) is the login
identifier; `email` for these accounts holds a synthetic
`<username>@thera.local` address, resolved back via the new
`resolve_thera_login_email` SQL RPC. `app/(onboarding)/thera-login.tsx` was
updated to call that RPC before `signInWithPassword` instead of treating its
"Tài khoản" field as a literal email. `account_type` also gained `'admin'`
(exactly one seeded row, see WEB's CLAUDE.md) and `'cskh'` as real values,
extending the existing admin_issued/review/staff/partner/tester set.

**Purely-staff accounts get a dedicated `(staff)` shell, not `(tabs)`.**
This is a *different* scenario from the "Admin/cskh Chat on mobile" section
above: that one is a real *patient* (Google/order-activated) whose identity
is *also* bound to a `web_access_contacts` staff row — they still have a
program, still belong in `(tabs)`, just with an enhanced chat FAB. A
TheraHOME-issued `'admin'`/`'cskh'` account has **no patient program at
all** — forcing it through patient activation/onboarding/country screens (or
faking program data just to satisfy them) would be wrong. Instead:

- `useProfile.ts` now selects/exposes `accountType`.
- `app/_layout.tsx`'s `RootNavigator` computes `isStaffAccount =
  accountType === 'admin' || accountType === 'cskh'` and short-circuits
  `hasAccess`/`onboardingPending`/`countryPending` for it — a staff account
  is always "activated," never sees the intake screens. The single
  `Stack.Protected guard={inApp}` block was split in two:
  `guard={inApp && !isStaffAccount}` keeps `(tabs)` and every patient
  screen exactly as before; a new `guard={inApp && isStaffAccount}` wraps
  the new `app/(staff)/` group.
- `app/(staff)/_layout.tsx` — its own `Tabs`, 3 screens (Chat / Cộng đồng /
  Thông báo, per the user's explicit priority order), a plain header (title
  + role label from `useWebRoles` + a sign-out icon — there's no Profile
  tab in this shell, so this is the only sign-out path) instead of
  `AssistantBubble`/`ReminderPopup` (both patient-only concepts).
- **Chat tab** (`app/(staff)/chat.tsx`): the conversations list, factored
  out of `app/chat/admin-conversations.tsx` into
  `src/components/chat/AdminThreadsList.tsx` so both the new tab root (no
  `BackBar`) and the still-needed pushed screen (the dual-role scenario
  above) share one `useAdminChatThreads`-backed list instead of two copies.
  Tapping a row still pushes `/chat/admin-thread/[threadId]`, unchanged.
- **Cộng đồng tab** (`app/(staff)/community.tsx`): a `content_reports`
  queue — `useContentReports`/`useResolveContentReport` (new, in
  `useCommunity.ts`, mirroring TheraHOME WEB's `fetchContentReports`/
  `resolveContentReport`). Deliberately **view + resolve/dismiss only** —
  verified against live RLS that `community_posts`/`post_comments`
  DELETE/UPDATE (hide/delete a post/comment) and `profiles` UPDATE (lock a
  user) are admin-only, not granted to `cskh`. Offering hide/delete/lock
  buttons here would just fail at the database; a fuller moderation surface
  would need its own RLS change, not attempted in this pass.
- **Thông báo tab** (`app/(staff)/notifications.tsx`): a broadcast
  composer + campaign history — `useNotificationCampaigns`/
  `useSendNotificationBroadcast` (new, in `useNotifications.ts`, mirroring
  WEB's grouped-by-`(type,title,body,created_at)` campaign view). Simplified
  vs. WEB: always targets all users (no per-product targeting), and the
  compose type picker is restricted to the 3 types WEB itself composes
  manually (`schedule`/`ad`/`blog`) — the rest (`chat`,
  `streak_milestone`, `post_reaction`, ...) are system-generated and expect
  `related_*` fields this simple form doesn't collect.
- `admin-manage-account`'s `handleCreate` skips the patient-catalog
  provisioning block (`user_access_contacts` + per-product
  `user_programs`/`user_program_days`) when `account_type === 'cskh'` —
  unnecessary now that `isStaffAccount` grants access directly.

`npx tsc --noEmit` and `npx expo lint` both clean (12 pre-existing baseline
warnings, no new ones).

## Comment screen polish + emoji icon fix + app icon consistency (2026-08-22)

**`app/community/[postId].tsx`**: (1) the reply timestamp went back and
forth this session — first moved out of the name line into the meta row
(to fix long-name wrapping), then moved back next to the name per explicit
follow-up feedback ("ngang với tên" — level with the name). Landed on: time
stays next to the name, but `commentNameLine` dropped `flexWrap` and the
name `Text` got `numberOfLines={1}`/`flexShrink: 1` so a long name truncates
with an ellipsis instead of pushing the time onto its own line — same
visual goal (time never orphaned below the name) via a different mechanism.
(2) The emoji bar (`showEmoji`) didn't close on an outside tap — added
`onTouchStart`/`onScrollBeginDrag` on the comments `ScrollView` and
`onFocus` on the composer `TextInput`, mirroring the exact pattern
`app/chat/human.tsx` already uses for its own emoji bar. (3) Composer
icons (image-pick, emoji-toggle) sized up again (24→26px) with an explicit
38×40 `composerTool` touch target (was relying on `hitSlop` alone); the
`writeComment` placeholder shortened in all three locales ("Viết bình
luận..." → "Bình luận...", etc.) to give them room.

**`src/components/icons/Icon.tsx`**: no change this pass — the `smile` →
`Laugh` fix from the previous entry already covers this file.

**App icon/favicon consistency**: `assets/favicon.png` (was 48×48, a
generic blue chevron/arrow — an unrelated leftover Expo placeholder, not
the TheraHOME mark at all) and `assets/android-icon-monochrome.png` (same
placeholder arrow, wrong asset) were regenerated from `assets/icon.png`
(the real house+leaf+wave mark, matching `BrandMark.tsx`'s pre-auth logo)
using a one-off Pillow script (no image-generation tool was available;
resized `icon.png` directly for the favicon, and did a color-distance
alpha extraction — sample the flat blue background color, alpha = distance
from it — to pull the white mark onto a transparent background for the
Android monochrome layer, which Android tints itself at runtime).
**Deliberately not touched**: `icon.png`/`android-icon-foreground.png`/
`android-icon-background.png` — the foreground and background images are
byte-identical opaque copies of the same artwork (not properly separated
into a transparent foreground + flat background per Android's adaptive
icon model, and the mark isn't inset to the ~66% safe zone, so a circular/
squircle OEM mask will crop it unpredictably). That's a real bug, but a
different one from what was reported (the favicon/monochrome showing the
*wrong logo entirely*) and fixing it correctly means picking a foreground
color with real contrast against the light `backgroundColor` (`#E6F4FE`)
and redoing the safe-zone padding — needs visual iteration on-device, left
as a follow-up rather than guessed at blind.

## Onboarding analyzing screen redesign (2026-08-22, revised same day)

`app/(onboarding)/consent.tsx`'s 0→100% loading state (shown right after
the onboarding questions, before the "ready roadmap" content — the
`loading` branch gated on `percent < 100`) was two plain centered `Text`
lines on the default light background. First pass was a single glowing
progress ring; a same-day follow-up explicitly asked for a real
"futuristic/AI HUD" — multiple concentric layers plus motion, not one
ring — so the visual now lives in its own component,
`src/components/onboarding/AnalyzingHud.tsx`:

- **Layer 0** — a static dim outer track circle.
- **Layer 1** — 12 dots orbiting the center, continuously rotating
  clockwise (`react-native-reanimated` `withRepeat(withTiming(360, ...))`
  driving an `Animated.createAnimatedComponent(G)`'s `rotation`/`origin`
  props — children stay at fixed angles, the whole group spins around
  center).
- **Layer 2** — a dashed "measurement scale" ring, same technique,
  counter-rotating much slower (24s/revolution vs. the dots' 9s) for a
  layered-depth cue.
- **Layer 3** — the actual 0→100% arc: glow duplicate + bright arc + a
  leading dot, `strokeDashoffset` now driven by a reanimated shared value
  that `withTiming`-eases toward each new `percent` step (still the same
  unchanged 45ms countdown `useEffect` in `consent.tsx`) instead of
  jumping in 4%-wide increments — smoother "processing" feel.
- **Layer 4** — a thin static inner frame around the centered content.
- Plus 4 corner HUD brackets (plain `View`s with two borders each, not
  SVG) and a handful of ambient twinkling dots outside the main cluster,
  each with an independent reanimated opacity pulse (`withDelay` staggers
  their phase so they don't blink in sync).
- A `RadialGradient` backglow behind everything, its opacity itself
  breathing via a shared `pulse` value.

No new dependency — `react-native-svg` and `react-native-reanimated` were
already in the project; `expo-linear-gradient` was considered for the
backdrop but isn't installed and wasn't needed (svg's own
`RadialGradient` covers the glow). The center content (logo, bold
percentage, caption) is unchanged in spirit from the first pass, except
the logo is now `assets/brandmark-glow.png` — a real `Image`, not the
hand-drawn `BrandMark` SVG — see the next entry for why. Caption text
comes from the `loadingPreparing` i18n key, passed in as a prop rather
than hardcoded in the component (kept localizable). Verified by
rasterizing the same layered geometry (arcs, dashed ring, dot positions,
corner brackets) with Pillow into a PNG and reading it back, since no
simulator was available to screenshot the actual RN render.

## App icon / brand-mark asset consistency (2026-08-22, revised same day)

Follow-up to the favicon/monochrome-icon fix above: `assets/icon.png` is a
*solid opaque blue square* (correct for an OS app icon, wrong for
compositing into a transparent dark UI), so a new dedicated asset,
`assets/brandmark-glow.png`, was generated from it — same color-distance
alpha-extraction technique as `android-icon-monochrome.png` (sample the
flat blue background, alpha = distance from that color), then cropped
tight to the mark's bounding box with a small pad. This is the actual
designed icon artwork, not the hand-approximated `BrandMark.tsx` SVG
paths — used wherever the brand mark needs to render on a dark/transparent
background in-app (`AnalyzingHud.tsx`, and now `LoginOrbitHud.tsx` below).
Kept separate from `android-icon-monochrome.png` on purpose: that file is
OS icon config (`app.json`'s `android.adaptiveIcon.monochromeImage`) and
shouldn't be repurposed as a general in-app asset even though the pixels
are similar.

## Login screen orbiting HUD (2026-08-22, three passes same day — this
supersedes the earlier "small ring + percent" and "6 icons, no gradient"
iterations; documenting only the final state)

`app/(onboarding)/login.tsx` previously showed a static `BrandMark` above
the wordmark/sign-in buttons. Rebuilt as a dense "AI health-tech HUD" —
`src/components/onboarding/LoginOrbitHud.tsx`, kept as its own component
rather than a variant of `AnalyzingHud.tsx` (used by the onboarding
consent screen) since the motion model differs too much to share cleanly:
orbit rotation + per-icon counter-rotation + per-orbit particles + a
multi-layer entrance stagger vs. AnalyzingHud's simpler single-arc
concentric layers.

**8 layers, innermost to outermost, deliberately packed close together**
(a "unified cluster," not a circular menu with generous gaps):
`INNER_FRAME_R`(51) → `SCANNER_R`(51, same ring) → `TICK_RING_R`(64, 72
radial ticks) → `ENERGY_ARC_R`(79, 3 gradient arc segments) →
`SEGMENTED_RING_R`(95, dashed) → `MIDDLE_ORBIT_R`(115, 3 icons) →
`OUTER_ORBIT_R`(140, 3 icons) → `OUTER_TRACK_R`(159, faint guide).
`CONTAINER` is 416 (was 372 in the prior pass, ~12% larger — the brief
asked for 10–20%). Center logo is `assets/brandmark-glow.png` at 82px
(was 68px pre-redesign), static, with its own small `logoGlow`
`RadialGradient` layered under the shared `hudBackglow` one.

**Every layer has its own independent rotation** — deliberately not one
spinning group (the brief explicitly called this out: "không rotate toàn
bộ HUD như một spinner"):
- tick ring: 70s (barely perceptible — "rất chậm")
- energy arcs: 34s clockwise, 3 arc segments sharing one `energyGradient`
  `LinearGradient` (electric blue → bright blue → cyan → white), 8px
  stroke — not a single-color progress circle
- segmented ring: 46s counter-clockwise (dashed, `strokeDasharray`)
- outer icon orbit: 20s clockwise · middle icon orbit: 15s counter-clockwise
- particles (3 per orbit, riding the same orbit radius): 7s / 5.5s
- scanner: 4s, fastest — a short gradient-trailed arc (`scannerGradient`,
  transparent → cyan → white) sweeping the innermost ring

All via `withRepeat(withTiming(±360, {easing: Easing.linear}), -1)` on
reanimated shared values — UI thread, linear, infinite, so 0°/360° render
identically (no visible reset), independent of React re-renders. **Icon
nodes are plain `Animated.View`s, not nested SVG** — colored circle
background + border + the lucide `Icon` glyph, positioned via
`useAnimatedStyle` translating by `radius`/angle and applying
`rotate: -orbitRotation.value` to counter-spin so they stay upright while
orbiting (nesting real icon glyphs inside a rotating SVG `<G>`, like the
pure-dot particles do, would lose per-badge background/border/shadow
without much more SVG plumbing).

**Entrance stagger**: on mount, four groups fade in with increasing delay
— logo (0ms) → inner ring cluster (200ms) → outer ring cluster (420ms) →
icon nodes (680ms, each individually offset another 25–50ms for a small
cascade), each over a 380ms `Easing.out(Easing.cubic)` fade (SVG groups:
opacity only; logo and icon badges: opacity + a `withSpring` scale-pop
from 0.55–0.7). **Continuous rotation for a given layer only starts once
that layer's own fade finishes** (`withDelay(groupDelay + 380, ...)`) —
motion doesn't begin until the thing doing the moving has actually
appeared.

**Palette** (premium, not neon — soft glow opacities, not saturated
fills): backdrop `#0B1D3A` (was `#16213A`, flatter blue-gray); electric
blue `#087BFF`, bright blue `#00A8FF`, cyan `#00E5FF` for most rings/
nodes; violet `#A78BFA` used on exactly one node (`brain`); orange
`#FB923C` reserved for exactly one node (`activity`) — both per explicit
"use sparingly" instructions in the brief, not applied to every node.
6 orbiting nodes: brain/activity/layers (outer, clockwise) and
bone/trending-up("data")/clipboard-check (middle, counter-clockwise),
interleaved by 60° so they read as one hexagon at rest. Added `bone`,
`heart-pulse` (unused in the final icon set but kept mapped), `layers`,
`sliders` (ditto) to `Icon.tsx` — all present in the installed lucide
version, no new dependency.

**No percent/caption anywhere in this component** — an earlier same-day
pass had a decorative looping 0→100 count and "Đang phân tích..." text,
corrected out because this is the pre-auth login screen and nothing is
actually being analyzed; a fake percentage read as misleading rather than
decorative. The ring that would show progress is now the always-moving,
state-free "energy arc" + "scanner" layers described above.

**Buttons** (`login.tsx`): Apple/Google/TheraHOME-account all standardized
to 62px height, 31px corner radius. Google's plain blue-circle-with-"G"
placeholder replaced with `src/components/GoogleGLogo.tsx` (the standard
4-color Google "G" logomark as SVG paths — no image asset needed, no
external fetch). "Đăng nhập bằng tài khoản TheraHOME" changed from a bare
underlined text link to a full-width outlined pill (border only, unlike
the solid-white Apple/Google buttons) with a leading `user` icon — it was
the one auth option that didn't look like a button. Google and TheraHOME
buttons wrapped in a local `PressScale` component (`login.tsx`) — scale
1→0.985 on press-in (`withTiming`) with a light haptic
(`hapticHoverTick`), spring back to 1 on release; Apple's button is a
native system control and already animates its own press feedback, so
it's the one button left unwrapped.

Verified the full composition (layer radii, gradient arcs, icon
placement, entrance stagger, and fit against the wordmark/buttons below
on a realistic ~844px-tall device) by rasterizing the same geometry with
Pillow, since no simulator was available — a naive bounding-box check
first suggested the HUD's container overlapped the button stack, but the
actual visible content (rings/badges) doesn't reach the container's full
radius (there's glow-fade margin baked into `CONTAINER`), so the
rasterized render confirmed a clean fit with real spacing.

**Fourth pass, same day — exact color-system lock-in + Apple/Google
button parity fix**: the user supplied a full written color spec
("THERAHOME FUTURISTIC LOGIN") superseding the approximated palette
above; every hex value in `LoginOrbitHud.tsx` and `login.tsx` now comes
verbatim from that doc rather than nearby-but-not-identical values chosen
by feel (e.g. electric blue is exactly `#078BFF`, not `#087BFF`; the
energy gradient's first stop is the spec's exact `#086BFF`, a distinct,
separately-specified value). Added a `withAlpha(hex, alpha)` helper in
`LoginOrbitHud.tsx` since the spec gives most colors as "hex + opacity
range" pairs (e.g. "orbit ring mờ: `#1C5793`, opacity 30–50%") rather
than pre-computed rgba strings — converting once in code keeps every
ring's color traceable back to one spec-quoted hex constant instead of
hand-authored rgba literals scattered around. Node colors now follow the
spec's explicit per-node table exactly (brain `#8B5CFF`, activity
`#FF9D00`, layers `#1597FF`, spine/bone `#00D7E8`, data/trending-up
`#00E5FF`, checklist `#9B5CFF`) — note this means two nodes are violet
(brain *and* checklist), overriding an earlier self-imposed "only one
violet node" rule from an earlier pass; the explicit table is the
authority now. Energy arcs gained a second, wider/more-transparent
`BLUE_GLOW` (`#008CFF`) stroke underneath the gradient one, simulating
the spec's "10–18px blur" (no SVG blur filter used — same wider-and-
fainter-duplicate-stroke trick used throughout this component). The logo
now has two stacked radial glows (`logoGlowInner` `#55C7FF`,
`logoGlowOuter` `#008CFF`) instead of one. Particles cycle through three
specified colors (`#53C8FF`, `#E7F7FF`, `#00E5FF`) instead of being flat
white.

Also fixed: Apple and Google sign-in buttons had visibly different text
size/weight because Apple's was still the native
`AppleAuthenticationButton` (fixed system typography, not stylable) while
Google's was a custom `Pressable` with explicit font styles. Replaced the
native Apple button with a custom one — `src/components/AppleLogo.tsx`
(the standard bitten-apple glyph as SVG path data, same technique as
`GoogleGLogo.tsx`) in a `Pressable` sharing one `authBtn`/`authBtnText`
style object with the Google button, so both are now byte-for-byte the
same height/radius/gap/font — only per-button background/text/icon color
overrides differ. `handleAppleSubmit` (the actual `signInWithApple()`
call, session handling, error handling) is completely unchanged — only
the tappable UI element changed, not the auth flow, per the user's
explicit "giữ nguyên toàn bộ auth logic" instruction. Trade-off worth
knowing: the native button auto-complies with Apple's Human Interface
Guidelines for "Sign in with Apple"; a custom button only complies if the
logo/text/sizing stay within Apple's published guidelines, which this
does (correct glyph, "Đăng nhập bằng Apple" wording, adequate contrast/
sizing) but isn't automatically enforced by the platform the way the
native component was.

**Fifth pass — real button-width bug, not a color issue**: the three
sign-in buttons rendered at visibly different widths. Root cause:
`PressScale`'s outer `Animated.View` had no explicit `width` — inside
`bottomBlock`'s `alignItems: 'center'`, an unsized flex child shrink-wraps
to its content, so the inner `Pressable`'s own `width: '100%'` (passed in
via the caller's `style`) was resolving against that already-content-sized
ambiguous parent instead of the real screen width, a classic RN flexbox
footgun. Fixed by giving the wrapper `style={[{ width: '100%' }, animatedStyle]}`
directly, so it stretches to `bottomBlock`'s full width unambiguously
before the inner Pressable's percentage resolves against it. Also added
`paddingHorizontal` to both `authBtn` and `theraBtn` (previously relying
entirely on `justifyContent: 'center'` with no button-level padding), and
tightened `theraBtn`'s long label — 14px (was 15), gap 10 (was 12) — since
"Đăng nhập bằng tài khoản TheraHOME" is right at the edge of fitting even
on the narrowest common iPhone width (375px, ~6px margin each side;
comfortable on everything wider). Re-verified every hex constant in
`LoginOrbitHud.tsx`/`login.tsx` character-by-character against the spec
doc — all were already exact matches, so the "colors don't match" part of
this same feedback was almost certainly the reference screenshot's own
rendering drift (it also showed UI chrome — a gear icon, an extra circular
button — that doesn't exist anywhere in this codebase), not a real
discrepancy in the implementation.

**Sixth pass — HUD density/thinness closer to a tighter reference crop,
plus a two-tone wordmark**: a follow-up reference image (cropped tight to
just the HUD, no login buttons) showed a visibly denser field of small
light dots and thinner ring strokes than what was built. Concretely:
- Added `STARFIELD` — 18 fixed small dots scattered across three radii
  bands (72/103/166, roughly matching the tick/segmented/outer-track
  rings), rendered by a new `Starfield` component riding its own very
  slow (90s) independent rotation, on top of the existing per-orbit
  particles which were too sparse (2-3 dots total) to read as the dotted
  field the reference shows.
- `ENERGY_ARCS` went from three ~60-80° segments to two larger ~110-130°
  ones — closer to the reference's two dominant bright sweeps rather than
  several thinner ones — and every ring stroke got thinner (segmented
  ring 2.5→1.5px, energy arc 8→6px core with a proportionally trimmed
  glow duplicate) per the explicit "nét thanh mảnh" (slender strokes)
  feedback.
- Added a rounded-square glow panel (`Rect`, `rx=26`, translucent
  `BG_DEEP` fill + thin `LOGO_INNER_GLOW` border) directly behind the
  logo — the reference shows the mark sitting in a soft glowing badge,
  not floating bare over the rings.
- `login.tsx`'s "TheraHOME" title is now two-tone — "Thera" stays white,
  "HOME" is `#00A8FF` (Bright Blue) via a nested `<Text>` — overriding the
  earlier written color spec's "TheraHOME: #FFFFFF" (full white), which
  this same follow-up explicitly corrected ("cho sang màu xanh... có thể
  chỉ xanh phần HOME"). The written spec was followed literally until this
  point; take future "the whole title is white" instructions from this
  entry, not the one above it.

## Roadmap-ready timeline animation (2026-08-22)

`src/components/RoadmapReadyTimeline.tsx` — the 3-milestone (day1/day7/
day14) chart on the "ready roadmap" screen (`consent.tsx`, right after the
0→100% analyzing screen) — was a static SVG curve reveal-clipped via a
plain RN `Animated.Value` width trick, no per-node entrance, no
interaction. Rebuilt as a real "personalized roadmap" animation per an
explicit brief; only this component changed, `consent.tsx`'s usage
(`topLabels`/`bottomLabels` props) is untouched.

**Line draw**: real `strokeDashoffset` animation (`strokeDasharray` set to
the path's actual length, offset animated from full-length to 0) over
1400ms — not the old clip-width illusion. Gradient `#FFB13B → #18A7E0 →
#078BFF`.

**Arc-length-timed node/label stagger**: the curve is still 2 Catmull-Rom
cubic-bezier segments (same shape as before), but `buildGeometry()` now
also samples each segment (24 steps) into a piecewise-linear
length→(x,y) lookup table while it builds the `d` string, so a node's
activation delay is `(cumulativeLengthAtNode / totalLength) * 1400ms` —
the actual fraction of the path, not a guessed 1/3, 2/3 split. Verified
this table (monotonically increasing, no NaN, sensible delays — day7
≈755ms, day14 ≈1320ms across several widths) with a Node port of the
exact math before trusting it, since there's no simulator here. Each
`RoadmapNode` (its own component, own shared values) does: scale 0.7→1.15→1
(~300ms), a ripple ring that expands+fades once, and a resting glow halo
— all via `withDelay(nodeDelay, ...)`. Every label (both the top and
bottom rows, 6 `RoadmapLabel` instances) fades + slides up on the same
delay as its corresponding node. Nodes never pulse continuously — the
brief was explicit about this ("KHÔNG pulse liên tục các node").

**Traveling particle**: `RoadmapParticle` reads the same length lookup
table via `interpolate()` inside a `'worklet'` helper, so it sits exactly
on the curve at any progress 0–1 — a white core, a `#00A8FF` glow (two
stacked lower-opacity circles simulating blur, no real blur filter), and
3 shrinking/fading trail dots behind it. Chases the line-draw during the
initial 1400ms run, then (chained via `withSequence` on the *same* shared
value — not a second, separately-timed `.value=` assignment, which would
have raced/canceled the first sequence) enters an infinite ambient loop:
every ~4.5s it resets and re-traces the path once, lighter/faster than
the initial run, purely as a "the system is still working" cue.

**Area gradient**: `transparent → rgba(0,168,255,0.06) → rgba(7,139,255,0.10)`,
revealed via an animated `ClipPath`/`Rect` whose width grows in lockstep
with `lineProgress` — same shared value the line stroke uses, so both
reveal in perfect sync without needing a second timing config.

**Tap interaction**: each node is wrapped in a `Pressable` (36×36 hit
target, larger than the visible 12px dot); tapping does a 1→1.08→1 scale
bump, a light haptic (`hapticHoverTick`), and a brief glow-opacity bump —
no tooltip, since the component only receives label strings (no richer
per-phase data exists to show), and the brief's tooltip request was
explicitly conditional on data support ("nếu dữ liệu hiện tại hỗ trợ").

**Background particles**: 5 fixed low-opacity dots, fading in with the
line — deliberately sparse, not a dense field like the login HUD's
starfield (this screen's brief explicitly warned against "gaming UI").

## Onboarding redesign (2026-08-19, revised twice same day)

Full rewrite of the pre-auth question flow, the "before start" screen, and
the first-run popups/screens shown around login. Three passes happened the
same day; this section describes the **current** end state directly rather
than layering a diff on a diff on a diff. Notable things a later pass threw
away from an earlier one (don't reintroduce without being asked): a
"Chúng tôi có bạn trong tầm tay!" interstitial screen between questions,
a `BodyZonePicker` tappable-silhouette answer for question 2 (reverted back
to a normal `OptionCard` list — deleted), and the 3 body-area cards on the
consent screen (removed for length, along with the `zoneNeckTitle`/
`zoneBackTitle`/`zoneFullTitle` i18n keys' only caller).

**`app/(onboarding)/welcome.tsx`** — two buttons: "Bắt đầu cho người mới" →
`/questions` (unchanged flow), "Đã có tài khoản" → `/login` directly,
skipping questions/consent for returning users. `login.tsx`/
`thera-login.tsx`/`activate.tsx` themselves are untouched.

**`app/(onboarding)/questions.tsx` + `src/lib/mockData.ts`** — 8 questions,
grouped into 3 parts with no screen break between them: Goals (`goal_main`,
`priority_zone`, `home_reason` — `home_reason` is multi-select), Status
(`tension_level`, `tension_timing` — `tension_timing` is multi-select),
Intro (`age_group`, `daily_activity`, `daily_time`). `Question` has a
required `part` field and optional `multi`. The progress bar is a
horizontal sliding fill + "`x`/8" label (replaced the old segmented
`ProgressDots`, deleted since nothing else used it) animated with RN's
built-in `Animated` (predates the `react-native-reanimated` dependency added
for the app-wide motion pass — see "Motion system" below; left as-is rather
than migrated, per that pass's "don't redo existing animation" rule) on
every `qIndex` change, plus a fade+translateY entrance on the question body.
There's no per-question header icon (tried once, removed) — instead each
**answer option** gets a small leading icon that fades/scales in on mount,
staggered by option index: `OptionCard` (`src/components/ui/OptionCard.tsx`)
gained optional `icon`/`index` props for this (backward compatible — its
only other caller, `country.tsx`, doesn't pass them). The icon-per-option
mapping (`OPTION_ICONS` in `questions.tsx`) is index-matched to each
question's `options` array, same order across vi/en/ms, so it's
language-independent — same convention used elsewhere in this file for
day-tile icons.

**The "country" question was removed from this flow entirely** — see the
`country.tsx` screen below. `countryQuestion` in `mockData.ts` keeps the
exact same content/options as a language-keyed export.

**`app/(onboarding)/consent.tsx`** ("ready roadmap" screen) — same
route/behavior (`onboarding_completed` gate, session check either pushes to
`/login` or flips the flag for an already-authenticated caller). UI: a
0→100% counter (a plain custom text style, NOT `theme.type.display` — that
token's `lineHeight:34` clipped a `fontSize:44` override, a real rendering
bug fixed by using an explicit `{fontSize:56, lineHeight:66}` style) before
revealing the "ready" content — heading, `RoadmapReadyTimeline.tsx` (3-point
SVG curve, same Catmull-Rom `smoothPath()`/`Svg`/`Path`/`Circle` convention
as `PainChart.tsx`, illustrative only, no body-area cards below it anymore),
and a "14-day roadmap" preview card (day tiles are icon-only — the
descriptive caption under each icon was removed per feedback, though the
`dayNSub`/`day14Sub` i18n keys are still defined, just unused). The curve's
middle point (day 7) sits noticeably higher than the final point (day 14)
on purpose — visibly still improving, not flattened yet — after feedback
that an earlier version made day 7 look almost identical to day 14. It
reveals left-to-right on mount: an `Animated.View` whose `width` tweens
from `0` to the container's measured width, `overflow:'hidden'`, wrapping
a fixed-full-width `Svg` — a clip-wipe, not a literal stroke-dash draw
(react-native-svg doesn't expose path length here, and reanimated isn't a
dependency). The roadmap card's "Xem tất cả" pill navigates to `/login`
(no real per-user roadmap to show pre-auth). Consent copy
(`healthDataConsent`/`medicalDisclaimer`) is kept verbatim above the CTA.

**`app/(onboarding)/country.tsx`** (new screen, not a popup) — shown once,
right after activation, for every account type, gated by a **new
server-side column** `profiles.country_confirmed` (migration
`country_confirmed_gate`, default `false` on new rows, existing rows
backfilled `true` so this never affects pre-existing accounts) rather than
a device-local zustand flag. `RootNavigator` (`app/_layout.tsx`) computes
`countryPending = hasAccess && !onboardingPending &&
profile?.countryConfirmed === false`, folds it into `inApp`, and
`router.replace('/country')`s to it — same reactive-gate pattern as the
existing `onboardingPending` redirect right above it. Two steps: pick one
of the 3 options, then a dedicated confirmation step (the user explicitly
asked for a second confirmation here since region/language is hard to
correct later) before the actual write. Confirming calls
`updateProfile.mutate({ language, country_confirmed: true })` — this is
also **the fix for a real bug**: the original (pre-this-feature) flow ran
the country question *before* login, so `setMarket`/`setLanguage` only
ever touched local zustand state, and `RootNavigator`'s profile-driven
language effect would silently overwrite it back to the DB default (`'vi'`)
right after login. Running this once `userId` exists closes that gap.
`useProfile.ts`'s `ProfileRow` gained `countryConfirmed`.

**`app/(tabs)/_layout.tsx` post-login popups** — down to just one now:
`ReminderPopup` (country moved to its own pre-tabs screen above). Two
independent toggles (morning/evening, both default on — 07:00/20:30) that
are now genuinely editable, not fixed: tapping the time pill opens a small
time-select sheet (same `TIME_OPTIONS`-list-in-a-`Modal` pattern as
`notifications-settings.tsx`'s `TimeRow`) before confirming. Confirming
requests OS notification permission once (`registerForPushNotifications`),
schedules whichever reminders are toggled on
(`scheduleDailyReminder`/`scheduleEveningReminder`), and persists
everything to the profile — always closes forward regardless of whether
permission was granted, so it can't block onboarding. Gated by
`useAppStore`'s `hasSeenReminderPrompt` (the old
`hasSeenCountryPrompt`/`CountryPopup` pairing was removed entirely, not
just renamed, since that gating moved server-side).

`notifications-settings.tsx` still has its own second `ToggleRow`+`TimeRow`
pair (evening) mirroring the morning one, independent of `ReminderPopup` —
that's the permanent settings surface; `ReminderPopup` is just the one-time
first-run prompt with the same underlying columns.

## Analyzing-screen simplification, reliable local-reminder inbox sync, device-locale default (2026-08-24)

Three independent fixes from the same request.

**`AnalyzingHud.tsx` (the 0→100% onboarding "analyzing" screen) simplified**
per explicit request: dropped the centered logo `Image` and the caption
`Text` (was `loadingPreparing`, "Đang phân tích...") entirely — only the
percentage number remains, centered in the HUD via the same `content`
View (now just `alignItems`/`justifyContent: 'center'` with one child
instead of a 3-item `gap` column), bumped up from 44px to 56px since it's
now the sole focal element. `consent.tsx`'s call site dropped the now-gone
`caption` prop. The `BRAND_MARK` asset import and its `logo`/`caption`
styles were removed as dead code, not just unwired.

**Local daily/evening reminders now reliably reach the notification
center, not just when the app happens to be alive at the exact moment they
fire.** The 2026-08-23 fix (`record_local_reminder_notification` RPC +
`registerLocalReminderInboxSync`'s `addNotificationReceivedListener`) was
real but insufficient in practice: that listener only observes a
notification if the app is foreground/backgrounded-but-not-killed at the
instant the OS fires it — a 7am/8:30pm reminder almost never lands while
someone is actually holding the app open, so in the common case it never
gets recorded at all (confirmed via `execute_sql`: zero `notifications`
rows had been written by that RPC since it shipped, despite the reminder
templates having been in active use). Added a second, complementary path
that doesn't depend on the app being alive at fire time:
`backfillTodaysReminders()` (new, `pushNotifications.ts`) resolves the
same title/body `scheduleDailyReminder`/`scheduleEveningReminder` would
show, and for each enabled reminder whose scheduled time-of-day has
already passed today, calls the RPC directly — deduped via an
AsyncStorage key per `kind`+date so it's a cheap no-op on repeat calls
(before today's time, or after already recording it once). `app/_layout.tsx`
now calls this in two places: the existing profile-driven effect (mount +
whenever reminder settings/day/language change — unchanged trigger, now
doing one more thing), and a new call inside the existing `AppState`
'active' handler (already used for the `touch_last_login` heartbeat) via a
new `reminderSettingsRef` kept current by that same profile-driven effect
— this is the part that actually fixes the reported gap, since it means
every time the user opens/foregrounds the app, whatever reminder(s)
already fired earlier that day get backfilled into the inbox if they
weren't already. `registerLocalReminderInboxSync`'s own foreground-only
listener is unchanged and still complements this (whichever path runs
first for a given day's reminder wins — same dedupe key shape prevents a
double insert if both somehow fire).

**Pre-auth screens (welcome, login, TheraHOME-account login) now respect
the device's language, not just questions/consent (which already did).**
Two separate bugs, both real:
1. `useAppStore`'s `language` defaulted to a hardcoded `'vi'` unconditionally
   — a brand-new install always started Vietnamese regardless of the
   device's actual locale, only ever changing once a user reached
   `country.tsx` post-activation (see "Onboarding redesign" above) or
   manually changed it in Account Settings. Fixed by making the store's
   *initial* value `detectDeviceLanguage()` (new, `useAppStore.ts`) instead
   of a literal `'vi'` — reads `Intl.DateTimeFormat().resolvedOptions().locale`
   (available in Hermes with no extra native module — deliberately not
   `expo-localization`, which isn't a dependency of this project and would
   need a rebuild that can't be verified without a device/simulator here),
   maps `en`/`ms` primary subtags to those languages, anything else to
   `'vi'`. This is only ever the *initial* value: zustand's `persist`
   middleware still rehydrates over it once AsyncStorage resolves, so a
   returning user (or anyone who's ever manually picked a language) keeps
   that choice regardless of what the device reports — this only affects a
   genuinely fresh install with no persisted state yet.
2. Even with the correct default language selected, `welcome.tsx`,
   `login.tsx`, and `thera-login.tsx` (unlike `questions.tsx`/`country.tsx`,
   which already used `useI18n()`) had every visible string hardcoded in
   Vietnamese from their earlier visual redesigns (see the dated redesign
   sections above) — the language selector had nothing to actually switch
   on these 3 screens. Wired all 3 through `useI18n()`/`t()`, adding the
   missing keys (all 3 locales) to `src/lib/i18n.ts`: `personalRoadmapSubtitle`,
   `welcomeDesc`, `startForNewUser`, `haveAccount`, `byContinuingAgree`,
   `and`, `loginLegalPrefix`, `signInWithApple`, `signInWithGoogle`,
   `signInWithTheraAccount`, `or`, `googleSignInError`, `appleSignInError`,
   `signIn`, `username`, `password`, `invalidCredentials`,
   `connectionError`, `theraAccountFootnote` — reused existing keys
   (`terms`/`privacy`/`security`/`continue`) where one already fit exactly
   rather than adding near-duplicates. The "TheraHOME"/"Thera"+"HOME"
   brand wordmark itself is untranslated on purpose (a proper noun).
   **Not touched**: `activate.tsx` (device activation, also still
   hardcoded Vietnamese-only) — not explicitly named in this request; flag
   if it should get the same treatment.

`npx tsc --noEmit`/`npx expo lint` clean (0 errors, same 12-warning
baseline). `npx expo export --platform ios` bundles cleanly.

## Language-choice tracking, Home's pinned-post card, ArticleCard sizing (2026-08-24)

Follow-up to the previous entry's device-locale fix, after the user tested
it with an existing account and still saw Vietnamese.

**Root cause: `profiles.language` was overwriting the client's device
default post-login, and no column distinguished a real choice from an
untouched default.** `RootNavigator` (`app/_layout.tsx`) has always
unconditionally synced `profile.language` down into the local `language`
store on every login — correct once a user has actually chosen a language
(`country.tsx`'s confirm step, or the Account Settings picker), but every
profile row defaults to `'vi'` at creation regardless of device locale, and
there was no way to tell "explicitly set to vi" apart from "just sitting at
the untouched default." So the previous entry's device-locale detection
(correctly showing English on the pre-auth welcome/login screens) got
silently clobbered back to `'vi'` the moment `profile` loaded post-login —
for literally every account that predates this feature, since none of them
have ever explicitly picked a language. Fixed with a new
`profiles.language_explicit boolean not null default false` column
(migration `profiles_language_explicit_flag`) — deliberately **not**
backfilled to `true` for existing rows, so every pre-existing account is
correctly treated as "never chosen," freeing their device locale to take
over. `country.tsx`'s confirm and Account Settings' language picker both
now write `language_explicit: true` alongside `language`; `RootNavigator`'s
sync effect now only fires when `profile.languageExplicit` is true.
`useProfile.ts`'s `ProfileRow` gained `languageExplicit`.

**`useAppStore.ts` also gained a `languageAutoDetected` flag** (persisted,
default `true`) so the device-locale re-check isn't limited to a brand-new
install — `setLanguage(language, { auto })` now takes an options bag
(`auto` defaults `false`, i.e. every existing explicit-choice call site is
unaffected without changes), and a new `onRehydrateStorage` hook re-runs
`detectDeviceLanguage()` (now exported) against the *persisted* state every
time the store rehydrates, but only while `languageAutoDetected` is still
true — once anything sets an explicit choice, it stops following the
device. This is what makes "change the device's language, reopen the app"
keep working across repeated testing/relaunches, not just on first
install, while still never overriding a real choice.

**Home's "Gợi ý cho bạn" now shows exactly one card — whichever post is
actually pinned in Community** (`app/(tabs)/home.tsx`), replacing the
previous "newest post + separately the pinned post" two-card layout, which
could show a different post than what Community itself displayed as
pinned — confusing since both are meant to represent the same curated
slot. Falls back to the newest official post only when nothing is pinned
yet, so the section isn't empty before staff have curated anything.

**`ArticleCard.tsx`'s brand row enlarged** — logo 16→22px, "TheraHOME" text
`captionSm`(11px)→`caption`(13px) bold, verified badge 14→16px — was
reading as too small relative to the rest of the card. Also swapped the
card's hardcoded "Xem thêm →" for the existing `readMore` i18n key (was the
one hardcoded string left in this otherwise-localized component).

`npx tsc --noEmit`/`npx expo lint` clean (0 errors, same 12-warning
baseline). `npx expo export --platform ios` bundles cleanly.
`mcp__claude_ai_Supabase__get_advisors` (security) shows only pre-existing
baseline warnings, nothing new from the migration.

## Market content (VN/UK/ML) vs. UI language, separated for real (2026-08-24)

Large cross-repo pass (plan file: `market content (VN/UK/ML) vs. UI
language — separated for real`), following the user's explicit framing:
*Country/market* answers "which content fits my market?"; *Language*
answers "what language do I read that content in?" — two different axes
this app previously conflated. Confirmed via direct queries this was a
real, currently-broken gap: `store_items`/`store_categories` already had
per-market rows but only VN was populated (8 items, one stray US test row,
zero MALAY) — the WEB admin's old global market `<select>` (localStorage-
persisted in `AppShell.tsx`) made it easy to forget 2 of 3 markets, which
is exactly what happened in practice. `program_days` (roadmap video/
support links) and `community_posts` had no market concept at all —
one global value regardless of market. `system_notification_templates`/
`upsell_campaigns` had no language column — an admin edit silently
overrode the localized client-side i18n fallback with one Vietnamese
string for every user regardless of language.

**Data model, per content type** (each a deliberate, different choice —
see the plan file for the full reasoning):
- **`program_days`**: parallel columns (`video_url_vn/us/malay`,
  `support_tools_url_vn/us/malay`) rather than tripling rows — avoids the
  `user_program_days` auto-provisioning trigger firing for 224 new rows
  per market, and keeps `user_program_days`'s FK/progress semantics
  untouched (still 112 canonical days). Migrated in 2 steps: add+backfill,
  then drop the old flat `video_url`/`support_tools_url` once every reader
  (mobile `usePrograms.ts`, WEB `RoutineView.tsx`/`db.ts`) moved to the new
  columns — both migrations applied, old columns are gone.
- **`store_items`/`store_categories`**: already the right per-market-row
  shape; added `group_key` (existing 9 rows each get their own singleton
  group, zero data loss) so the admin UI can create/edit up to 3 market
  rows as one logical "product"/"category" instead of 3 unrelated rows
  behind a market switcher.
- **`community_posts`** (official posts only): `target_markets text[]`
  (null = visible everywhere, the correct default for every existing post
  and every regular user post) + `title_us/text_us`, `title_malay/text_malay`
  (base `title`/`text` stay VN/default, zero migration for existing rows).
  Per explicit clarification, this is **not** "fill all 3 always" like
  roadmap/products — admin picks which market(s) a post targets, and only
  those need their own content; one shared row (not 3 separate ones) keeps
  likes/comments unified even for a multi-market post.
- **`system_notification_templates`**: `language` column, uniqueness
  became `(template_key, language)` (was `template_key` alone). EN/MS rows
  seeded from content that already existed and was already correct:
  `daily_workout`/`evening_reminder` from `i18n.ts`'s own translations,
  the 7 `inactive_*` tiers from `dispatch-system-notifications`'s
  already-deployed `copy(language, days)` fallback (generic per-language
  text, not per-tier bespoke translation the way the VI rows are — worth
  refining per-tier later via the new admin language tabs).
- **`upsell_campaigns`**: `title_en/body_en`, `title_ms/body_ms` (optional,
  same reasoning as posts — a campaign can target whichever language
  cohorts are ready).
- **Explicitly excluded**: `ai_prompts`/`ai_suggested_replies` — AI
  behavior config, not per-market display content.

**Mobile read paths**: `usePrograms.ts`'s `useProgramDays`/
`useCatalogProgramDays` resolve `video_url_<market> ?? video_url_vn` via a
shared `resolveMarketDayContent()` helper, using `marketForLanguage()`
(already existed in `useStore.ts`, now also imported here — no new
mapping invented). `useCommunity.ts`'s `useCommunityPosts` adds a
`target_markets.is.null,target_markets.cs.{market}` `.or()` filter and
resolves `title_<market>`/`text_<market>` with VN fallback inside `mapPost`
(now takes a `market` param). `pushNotifications.ts`'s
`resolveSystemTemplate()` now queries `.in('language', [language, 'vi'])`
and picks the matching row, falling back to 'vi' then the hardcoded
fallback — mirrors `translate()`'s own fallback shape.

**Edge functions redeployed**: `dispatch-system-notifications` (inactivity
tiers) now keys its template lookup on `template_key:language` instead of
`template_key` alone. `dispatch-upsell-campaigns` now resolves each
recipient's `profiles.language` and sends their matching title/en/ms
variant, falling back to the base VN/default text — same per-profile-
language personalization pattern the system-notifications worker already
used, extended rather than reinvented. **Not changed**: `dispatch-push`'s
`broadcast` mode (used by `create_official_community_post`'s optional
push) still sends one flat title/body to every recipient regardless of
the post's own market targeting — a real, acknowledged simplification
(the push blurb doesn't currently respect the article's per-market
content), flagged here rather than silently scoped in.

**WEB admin UI**: removed the global market `<select>` from
`AppShell.tsx` entirely (its only consumer, `ProductsView`, no longer
needs it). New shared `PillTabs` component (`src/components/ui/
primitives.tsx`) — the same pill-button convention already used ad hoc
throughout Admin — powers every new market/language tab switcher instead
of rebuilding it per view. `ProductsView.tsx` rewritten around
`group_key`-grouped fetch/save (`fetchStoreCategoryGroups`/
`saveStoreCategoryGroup`/`saveStoreItemGroup` in `db.ts`) — one edit modal
per product/category with VN/UK/ML tabs, all 3 required before save.
`RoutineView.tsx`'s day-edit modal gained the same 3-market tabs (all 3
required — a day can have no video at all, e.g. a rest day, but can't
have it for only some markets). `CommunityView.tsx`'s compose modal
gained a VN/UK/ML checkbox row (VN always included, UK/ML opt-in with
their own required fields once checked). `NotificationsAdminView.tsx`/
`UpsaleNotificationsView.tsx` gained VN/EN/MS tabs (optional for both).

**Community tab i18n audit** (separate, smaller, mechanical pass, same
pattern as the earlier welcome/login/thera-login conversion this
session): 8 files had hardcoded Vietnamese UI text despite most of
Community already being localized — `[postId].tsx` (delete/edit
confirmations, comment menu, reply toggles), `create.tsx` (one link),
`ExpandableText.tsx`, `PostActionBar.tsx`, `ReactionButton.tsx`,
`ReactionPicker.tsx`, `ReactionSummary.tsx`, `ProgressShareCard.tsx` — all
wired through `useI18n()`/`t()` with ~25 new keys added across vi/en/ms.
**Known remaining gap, deliberately not touched this pass**: `POST_REACTIONS`
(`useCommunity.ts`) — the reaction emoji/label pairs ("Thích", "Yêu
thích", ...) — are a hardcoded Vietnamese array, not part of the
`i18n.ts` translate() system; every reaction label shown anywhere
(action bar, picker tray, accessibility text) ultimately traces back to
this array regardless of the viewer's language. Converting it needs its
own small design decision (move into `i18n.ts`'s per-language
dictionaries, or make it a function of `language`) — flagged rather than
folded into this already-large pass.

`npx tsc --noEmit`/`npx expo lint` (mobile, 0 errors, same 12-warning
baseline) and `npx tsc --noEmit`/`npm run lint`/`npm run build` (WEB, all
clean) verified repeatedly through the pass. `npx expo export --platform
ios` bundles cleanly. `mcp__claude_ai_Supabase__get_advisors` (security)
shows only pre-existing baseline warnings, nothing new from any of the 8
migrations.

## Market/language pass — closing the two flagged gaps (2026-08-24)

Follow-up to the previous entry, closing both gaps explicitly flagged
there as not built.

**`POST_REACTIONS` reaction labels are now language-aware.** Previously a
flat hardcoded-Vietnamese array (`{ key, emoji, label }`) — every reaction
label anywhere (action bar's "Thích"/current-reaction text, the picker
tray's per-icon accessibility label, the long-press accessibility hint)
traced back to this one array regardless of the viewer's language. Split
`emoji`/`key` (language-independent, unchanged) from `label`: added
`reactionLike`/`reactionHeart`/`reactionSupport`/`reactionHaha`/
`reactionCelebrate` to `i18n.ts` (all 3 languages) and a new
`reactionLabel(key, language)` helper in `useCommunity.ts`. Updated the 3
actual consumers of `.label` — `PostActionBar.tsx`, `ReactionButton.tsx`,
`ReactionPicker.tsx` — to call it with `useI18n()`'s `language`; the other
2 importers (`reactionPickerGeometry.ts`, `app/notifications.tsx`) only
ever used `.key`/`.emoji`, both language-independent, so they needed no
changes.

**`dispatch-push`'s `broadcast` mode now respects a post's market
targeting**, closing the gap where a UK-only or ML-only official post's
"Gửi thông báo" push still went to every user regardless of who could
even see the post it linked to. The edge function's broadcast branch
gained optional `targetMarkets`/`titleUs`/`bodyUs`/`titleMalay`/
`bodyMalay` — when `targetMarkets` is present, recipients are filtered to
`profiles.language`-derived market membership before sending (same
per-profile lookup pattern `dispatch-system-notifications`/
`dispatch-upsell-campaigns` already use); when a market's title/body
variant is supplied, that recipient gets it instead of the base text.
Every other broadcast caller (community reaction/comment notifications
via `mode: 'social'`, chat) is untouched — they never pass these new
fields, so behavior there is byte-for-byte the same as before. WEB's
`createOfficialPost` (`db.ts`) now threads the post's own
`targetMarkets`/`titleUs`/`titleMalay` (and new optional
`notifyTitleUs`/`notifyBodyUs`/`notifyTitleMalay`/`notifyBodyMalay` push-
blurb overrides, same "defaults to the post's own content, editable"
relationship the VN fields already had) through to this call.
`CommunityView.tsx`'s compose modal's notification section gained the
same VN/UK/ML `PillTabs` switcher as the post-content section above it
(shown only when a market checkbox is actually checked) — UK/ML push text
is optional, falling back to that market's own post title/text when left
blank.

`npx tsc --noEmit`/`npx expo lint` (0 errors, same 12-warning baseline)
and WEB's `npx tsc --noEmit`/`npm run lint`/`npm run build` all clean.
`npx expo export --platform ios` bundles cleanly.

## Website domain is configurable, not hardcoded (2026-08-24)

`therahomeai.com` was hardcoded in 5 places (`mockData.ts`'s `landingPage`/
`privacyPolicy`, `help.tsx`'s support-email mailto link ×2, `legalContent.ts`'s
community-guidelines text, and `i18n.ts`'s `viewAllWebsite` copy in all 3
languages) — changing the domain later would have meant hunting through all
of them individually. Centralized into one source of truth: `mockData.ts`
now derives `websiteDomain`/`landingPage`/`privacyPolicy`/`supportEmail`
from `EXPO_PUBLIC_WEBSITE_DOMAIN` (new env var, defaults to
`'therahomeai.com'` if unset — same pattern as the existing Supabase env
vars, added to `.env`/`.env.example`). Every other call site now imports
from there instead of hardcoding the string; `i18n.ts`'s `viewAllWebsite`
became a `{domain}`-templated key (was baked directly into the translated
sentence) with the value passed in from `store.tsx`. Changing the domain
going forward is a one-line env var edit, no code change. `introVideo`
(a fixed YouTube link) and the support hotline phone number were left
as-is — not TheraHOME's own domain. WEB has no hardcoded product domain
anywhere in its real source (only `.design-reference`'s frozen copy, which
is never imported — see that section above).

## Quiz + phase unlock via Apple IAP (2026-08-26)

New end-of-phase flow: once every day in a phase is `done`, the roadmap
shows that phase's quiz (if admin configured one) or — once the quiz is
done, or immediately if there was none — a promo screen with up to two
cards: an optional physical-product cross-sell (plain external links, no
IAP — Apple exempts physical goods) and, unless already purchased, an
"unlock next phase" card that goes through real Apple In-App Purchase
(App Store Review Guideline 3.1.1 requires IAP for unlocking digital
content/features inside the app). Quiz completion itself never unlocks
anything — it's a separate knowledge checkpoint; only a verified purchase
does. iOS only this pass — see "Manual setup" below for the explicit
Android/Google Play Billing follow-up note.

**New tables** (migration `phase_quiz_and_unlock_purchase`): `quiz_questions`
(per phase, `content jsonb` keyed by language — `{vi:{question,options,
correctIndex}, en:{...}, ms:{...}}` — chosen over columns-per-language
since option count varies 2–6), `user_quiz_attempts` (latest attempt per
user+phase, `unique(user_id, phase_id)`), `phase_promos` (admin-editable
content for both cards, 1 row per phase, nullable — phases without a promo
just don't show one), `phase_purchases` (verified purchases only, written
exclusively by `verify-apple-purchase`'s service-role client — no
`authenticated` INSERT/UPDATE policy exists, so a client can never fake
having purchased). RLS follows the existing `program_days`-style pattern
(public SELECT, admin-only write) except `phase_purchases`/
`user_quiz_attempts`, which are own-row-only (+ admin/cskh read-all).

**New edge function `verify-apple-purchase`**: takes `{phaseId,
transactionId}`, builds an ES256 JWT for Apple's App Store Server API
(`jose`), calls `GET /inApps/v1/transactions/{id}` (production, falling
back to the sandbox host), decodes the returned `signedTransactionInfo`
JWS payload directly rather than re-verifying its x5c certificate chain —
deliberate simplification, safe specifically because the payload only
ever reaches this code after an independent, self-authenticated HTTPS call
to Apple's own API (the trust boundary is that round trip, not the JWS
signature itself); full chain verification could be added later as
hardening. Cross-checks `bundleId`/`productId`/`transactionId` against
what's expected, then INSERTs (never upserts) into `phase_purchases` —
insert-not-upsert is load-bearing: upserting on a transaction-id conflict
would let a second caller who obtained the same transaction id (e.g. a
leaked log line) silently steal the purchase by overwriting `user_id`.

**Mobile**: `react-native-iap` (+ its `react-native-nitro-modules` peer) —
**native module, needs an EAS rebuild**, see Manual setup. `useQuiz.ts`
(`usePhaseQuiz`, `useQuizAttempt`, `useSubmitQuizAttempt`),
`usePhasePromo.ts` (`usePhasePromo`, `usePhaseLockRequirements`),
`usePhasePurchase.ts` (wraps `react-native-iap`'s `useIAP()` — fetches the
phase's product so the button can show the real StoreKit `displayPrice`,
drives `requestPurchase`, verifies via the edge function before
`finishTransaction`). New screen `app/quiz/[phaseId].tsx` (scrollable MCQ,
submit, score). New `PhaseFooter`/`PhaseUnlockPromo` components
(`src/components/roadmap/`) — `roadmap.tsx` inserts `PhaseFooter` right
after a phase's last day once `phaseAllDone`, and separately force-locks
(`status: 'locked'`, no-op `onPress`) every day belonging to a phase that
`phase_promos.apple_product_id` is set for but isn't yet purchased — this
layers on top of, not instead of, the existing day-by-day sequential
unlock, and is what stops a payment-gated phase's days from being reached
by direct navigation once their normal sequential status would otherwise
read `current`. `DayRow` gained `phaseId` (previously only had the
already-localized `phase` name string, not enough to key a purchase/quiz
lookup by).

**Found and fixed two pre-existing issues while wiring this up, unrelated
to the feature itself but blocking a clean `tsc`**: (1) `tsconfig.json`'s
own `exclude` array silently replaced (TS `extends` doesn't merge
`exclude`) `expo/tsconfig.base`'s `node_modules` exclusion, so
`react-native-iap`'s raw source (resolved via its package `exports`
map's `"react-native"` condition, which this project's own
`customConditions: ["react-native"]` follows for type-checking too, not
just bundling) was being type-checked directly instead of its compiled
`.d.ts` — fixed by restoring `"node_modules"` in the local `exclude`
array, plus a small `src/types/global.d.ts` ambient shim for the one
remaining `global` reference that surfaced once that file was reachable.
(2) Two unrelated `.catch()`-after-`.then()` chains (`_layout.tsx`'s
`touch_last_login` call, `pushNotifications.ts`'s reminder-inbox sync)
didn't type-check because `supabase.rpc()` returns a `PromiseLike`, not a
full `Promise` — rewritten as `async () => { try {...} catch {...} }()`
IIFEs, which sidesteps the distinction entirely.

`npx tsc --noEmit`/`npx expo lint` (0 errors, same 12-warning baseline)
clean; WEB's `npx tsc --noEmit`/`npm run lint`/`npm run build` clean.
`get_advisors` after the migration shows no new finding classes beyond
the existing baseline. **Not independently testable here**: the actual
purchase flow needs App Store Connect access and a native rebuild neither
of which this environment has — see Manual setup immediately below.

## Returning-user Google/Apple login forced onboarding reset, causing a stuck splash screen (2026-08-26)

Reported as "sau khi đăng nhập bằng gg xong nó hiện splash rồi đứng yên ở đó
luôn" (splash appears after Google login and never goes away). Diagnosed via
Supabase's own request logs rather than a device (none available here):
`GET /rest/v1/profiles` and `GET /rest/v1/user_programs` for the affected
account were firing every ~0.6–0.7s, continuously, for minutes after the
login — hundreds of successful (200) requests in a tight loop, confirmed via
`query_logs` against `edge_logs`. Both queries only ever run together inside
`RootNavigator` (`app/_layout.tsx`), so this was real evidence of
`RootNavigator` itself being repeatedly remounted, not a single hung request
— which also explains the visible symptom: `minimumSplashElapsed`'s timer
(gating the splash screen) restarted on every remount, so with remounts
happening faster than its 1820ms window, the splash could never actually
finish and the app never progressed past it, even though data was loading
fine underneath.

Root cause: `login.tsx`'s `startOAuthOnboarding()` unconditionally set
`profiles.onboarding_completed = false, country_confirmed = false` after
**every** successful Google/Apple sign-in, then `router.replace('/questions')`
— correct for the flow's actual new-signup case (`login.tsx` is also the
final step of welcome→questions→consent for a brand-new user, whose answers
only exist in local zustand state until an account exists to save them
against — see "Onboarding redesign" below), but wrong for a *returning* user
tapping "Đã có tài khoản" and signing back in with an already-onboarded
Google account: this reset their onboarding state and forced them back
through the whole questionnaire on every single login, which is what put
`RootNavigator`'s gate (`onboardingPending` flipping true) and this screen's
own forced `/questions` redirect into the race that manifested as repeated
remounts.

Fixed by distinguishing the two cases via Supabase's own new-vs-returning
signal — `session.user.created_at === session.user.last_sign_in_at` is only
true on an identity's first-ever sign-in. `startOAuthOnboarding(userId,
isNewUser)` now only does the reset-and-send-to-questions dance when
`isNewUser`; otherwise it just `router.replace('/')`, letting `app/index.tsx`
route the already-onboarded user straight into the app the same way a cold
launch with an existing session does. Also hardened `_layout.tsx`
independently of this specific trigger: `minimumSplashElapsed`'s timer now
derives from a module-level `APP_BOOT_TIME` (fixed once when the module first
evaluates) instead of resetting on every `RootNavigator` mount, so the splash
screen can no longer hang indefinitely even under some other future
remount-causing bug — this doesn't prevent remounts, just guarantees they
can't leave the user stuck looking at the splash screen forever.

**Not fully root-caused**: exactly *why* `RootNavigator` was remounting
repeatedly (rather than, say, `app/index.tsx`'s own independent
`useProfile`/`useSession` pair, or an inner Stack redirect bouncing through
`+not-found`) couldn't be pinned down from server-side request logs alone —
that needs Metro's console output or a device to observe directly, neither
available here. The onboarding-reset fix removes the concrete trigger that
was reproduced twice in the logs (two separate Google logins by the same
returning account, both immediately followed by the loop), so it should
resolve the reported symptom; flag it again if a stuck splash still happens
after this without a preceding "returning user via Google/Apple" login.

`npx tsc --noEmit`/`npx expo lint` clean (0 errors, same 12-warning
baseline). `npx expo export --platform ios` bundles cleanly.

## Phase-unlock promo was wired to the wrong phase; seeded real test content (2026-08-26)

Reported as "roadmap tab shows no changes" after the quiz/phase-unlock
feature shipped — root cause was two things, not one: `phase_promos`/
`quiz_questions` were completely empty (nothing to render, verified via
direct query), and separately, `PhaseFooter`/`PhaseUnlockPromo`'s
`phaseId`/`phaseName` props (`roadmap.tsx`) were wired to the phase that
was just *completed* (e.g. Giai đoạn 2) instead of the phase the card is
actually supposed to unlock (Giai đoạn 3) — so even with content configured,
the card would have read "Mở khoá Giai đoạn 2" (the phase already finished)
instead of "Mở khoá Giai đoạn 3", and the lock/purchase check would have
evaluated the wrong phase's `phase_promos` row entirely. `PhaseFooter`
now takes both `phaseId`/`phaseName` (quiz target — the just-completed
phase, unchanged) and `nextPhaseId`/`nextPhaseName` (promo/paywall target —
the phase that follows, `null` if the completed phase was the product's
last one, in which case nothing renders past the quiz).
`roadmap.tsx` already computed `nextDay` for its own `isLastOfPhase` check,
so deriving `nextPhaseId`/`nextPhaseName`/the `unlocked` flag from it was a
small addition, not a new lookup.

Seeded real content for `neck-plus` (migration
`seed_neckplus_phase2_quiz_and_phase3_promo`) so the feature is actually
testable end to end: 3 quiz questions on Giai đoạn 2 (`quiz_questions`,
vi/en/ms), and a `phase_promos` row on Giai đoạn 3 with the TheraNECK PRO
cross-sell card + unlock description, matching the supplied reference
screenshot. `apple_product_id` is a **placeholder**
(`com.therahome.app.phase3unlock`) — App Store Connect setup is still
pending (see Manual setup below); swap it for the real Product ID from WEB
Admin once that exists. Both admin/cskh can now also grant this phase
directly without a real purchase — see TheraHOME-WEB's matching CLAUDE.md
entry (`admin_set_user_phase` now also inserts a `phase_purchases` row when
moving someone into a payment-gated phase).

`npx tsc --noEmit`/`npx expo lint` clean (0 errors, same 12-warning
baseline).

**Same-day follow-up**: replicated the Quiz 2 + Giai đoạn 3 promo seed to
the other 3 products (migration
`seed_remaining_products_phase2_quiz_and_phase3_promo`) — per explicit
request, this gates every product's roadmap the same way (Giai đoạn 1+2
free, Giai đoạn 3 behind IAP), not just `neck-plus`. Cross-sell content per
product: `neck-plus`→TheraNECK PRO, `back-plus`→TheraBACK PRO (same-tier
upsell); `neck-pro`→TheraBACK+, `back-pro`→TheraNECK+ (already the top
tier, so cross-sells the *other* body area instead). All 4
`apple_product_id`s are still placeholders pending real App Store Connect
products. `get_advisors` shows no new finding classes.

## Quiz 1, collapsible phase sections, phase 3 fully hidden until purchased (2026-08-26)

Three follow-up requests on `app/(tabs)/roadmap.tsx`:

- **Quiz after Giai đoạn 1 too** — previously only Giai đoạn 2 had a quiz.
  Seeded 3 more questions per product on each phase-1 id (migration
  `seed_phase1_quiz_all_products`, vi/en/ms, 24 questions total across all
  4 products × 2 phases). No code change needed — `PhaseFooter` already
  reads whichever phase's `quiz_questions` exist generically. Giai đoạn 2
  has no `phase_promos`/`apple_product_id`, so its `PhaseUnlockPromo` half
  stays a no-op after the Phase 1 quiz (renders nothing) — only Giai đoạn 3
  is paywalled, unchanged from the earlier pass.
- **Collapsible phase sections** — each phase header (the uppercase
  "GIAI ĐOẠN N · ..." label) is now a `Pressable` with a `chevron-down`
  icon that rotates -90° when collapsed. Collapsing hides both that
  phase's day nodes *and* its quiz/promo `PhaseFooter` — a tap on the
  chevron is the only way to reveal either. **Revised same day**: the
  first version defaulted every phase open and kept the footer visible
  even while collapsed; per explicit follow-up feedback, only the phase
  containing the user's actual current day now defaults open
  (`currentPhaseId`, derived from whichever day has `status === 'current'`)
  — every other phase, including ones already fully completed, defaults
  collapsed with its footer hidden too, until tapped. Implemented via a
  `collapsedOverrides: Record<phaseId, boolean>` map holding only
  *explicit* taps; the effective state read at render is
  `collapsedOverrides[phaseId] ?? phaseId !== currentPhaseId`, so the
  default follows whichever day is current without needing to
  resync state from the async `days` query on every load.
  **Second same-day fix**: reported as "hoàn thành hết Giai đoạn 2, chưa
  làm quiz thì vẫn phải mặc định mở Giai đoạn 2" — `complete_day` advances
  `status: 'current'` onto the *next* phase's first day the moment the
  prior phase's last day is completed, regardless of whether that next
  phase's quiz was taken or it's still behind the IAP paywall. So once
  Giai đoạn 2 finished, the naive `currentPhaseId` pointed at Giai đoạn 3's
  first day — a phase simultaneously *hidden entirely* by the payment-lock
  filter above — leaving nothing expanded and Giai đoạn 2's own quiz
  prompt collapsed away. Fixed: `currentPhaseId` now only trusts the
  literal current day when that day's own phase isn't in
  `lockedPhaseIds`; otherwise it falls back to the last still-*visible*
  day's phase, which is exactly the just-finished phase whose footer
  (quiz prompt, or the promo once the quiz is done) is what the user
  actually needs to see next. Once that phase is unlocked for real (quiz
  done + purchased), its days stop being filtered and the normal
  current-day branch takes back over.
- **Giai đoạn 3 (and any future paywalled phase) is now fully hidden, not
  just visually locked** — per explicit "CHỈ HIỂN THỊ SAU KHI ĐÃ MUA".
  Previously `paymentLocked` days still rendered as a grayed-out
  `PathNode` with a lock icon; the day loop now `return`s `null` entirely
  for any day whose `phaseId` is in `lockedPhaseIds` (same set already
  computed from `phase_promos.apple_product_id` + `phase_purchases`), so
  neither the phase header nor any of its days appear in the list at all
  until purchased — the "Mở khoá Giai đoạn 3" promo card (on Giai đoạn 2's
  footer) is the only visible sign it exists. This also let `PathNode`'s
  call site drop the `displayDay`/status-override plumbing entirely, since
  every day that still reaches render is guaranteed unlocked — the
  `onPress`'s own `paymentLocked` early-return became dead code and was
  removed with it.

`npx tsc --noEmit`/`npx expo lint` clean (0 errors, same 12-warning
baseline). `npx expo export --platform ios` bundles cleanly.

## Promo cards decoupled from phase collapse, left-image/right-content card layout (2026-08-26)

Two more follow-ups on the same roadmap flow:

- **Quiz done → the phase auto-collapses, but its promo cards must still
  show.** The previous pass kept a phase's entire footer (quiz prompt *and*
  promo cards) tied to that phase's own collapse state, and pinned a
  just-finished phase open specifically so its quiz prompt stayed visible.
  Per explicit follow-up, once the quiz is actually taken the phase should
  collapse — but the "Tìm hiểu thêm"/"Mở khoá ngay" cards need to keep
  showing regardless, since they're the next actionable step, not really
  "that phase's" content anymore. Split `PhaseFooter`'s two halves apart:
  it now takes a `collapsed` prop that hides only the quiz-prompt branch;
  `PhaseUnlockPromo` (the cards) always renders once the quiz resolves, independent
  of `collapsed`. `roadmap.tsx`'s `currentPhaseId` (which phase defaults
  expanded) now also checks a new `useQuizResolvedMap(userId, phaseIds)`
  hook (`useQuiz.ts`, batch `quiz_questions`/`user_quiz_attempts` existence
  check per phase) — the "last visible phase" fallback only pins a phase
  open while *its own* quiz is still unresolved; once taken, nothing forces
  it open anymore and it collapses like any finished phase, while its promo
  cards keep rendering underneath regardless.
- **Card layout: left image / right title+description+2 buttons**, per a
  supplied reference — `PhaseUnlockPromo.tsx`'s cross-sell and unlock cards
  were both top-image/content-below; rewritten to `flexDirection: 'row'`
  with a fixed 108px-wide image on the left (rounded on its left corners
  only) and the title/badge/description/buttons in a `flex: 1` column on
  the right, text sizes/paddings tightened to fit the narrower column
  (title `bodyStrong` not `h2`, description capped `numberOfLines={3}`,
  buttons shrunk to `captionSm` text with smaller vertical padding). No
  behavior change — same fields, same buttons (Tìm hiểu thêm/Xem video
  giới thiệu, Mở khoá ngay/Xem video giới thiệu), same conditional
  rendering per admin-configured field.

`npx tsc --noEmit`/`npx expo lint` clean (0 errors, same 12-warning
baseline). `npx expo export --platform ios` bundles cleanly.

## Completed quiz row was disappearing entirely instead of staying visible in a "done" state (2026-08-26)

Reported as "sau khi mở quizz2 ra thì không thấy quizz, hình như đang bị card
mới che mất." Root-caused via a DB check, not a device: the affected test
account (`khanha1k59@gmail.com`) genuinely already had a
`user_quiz_attempts` row for Giai đoạn 2 (score 2/3) — so the app was
behaving exactly as coded, just not as *intended*: the previous pass's
`PhaseFooter` treated `quizDone` as a hard switch, rendering either the
"take the quiz" prompt or (once done) jumping straight to the promo cards
with **no persistent quiz row at all** — but the original reference image
this whole feature was built from shows Quiz 2 staying visible, just
re-labeled "Đã hoàn thành" with a green check pill, sitting *above* the two
promo cards, not disappearing. Confirmed via explicit follow-up: "khi hoàn
thành quizz2 xong giai đoạn 2 đóng... nhưng khi mở ra vẫn phải thấy quiz" —
auto-collapsing the finished phase by default (previous pass) is correct;
the quiz row disappearing forever once expanded again was the actual bug.

Fixed: `PhaseFooter` now always renders a quiz row while its phase is
expanded and it has a quiz — either the original "Bắt đầu quiz" prompt
(`!quizDone`) or a new completed variant reusing the same row shape with a
green `theme.colors.successTint` pill (check icon + `t('quizCompleted')`,
"Đã hoàn thành" — an existing i18n key that had been added but never wired
up anywhere). Only the promo cards below stay `collapsed`-independent as
before; the quiz row itself now follows `collapsed` in both states, not
just the not-yet-taken one — matches "khi mở ra vẫn phải thấy quiz" exactly:
collapsed hides it, expanding reveals it (done or not).

Deliberately not built this pass (asked, explicitly declined): a
user-facing "Làm lại quiz" (retake) button — `quizRetake` i18n key still
exists unused for whenever that's wanted; the data model already supports
it (`useSubmitQuizAttempt` upserts on `(user_id, phase_id)`), only the UI
entry point is missing.

`npx tsc --noEmit`/`npx expo lint` clean (0 errors, same 12-warning
baseline). `npx expo export --platform ios` bundles cleanly.

## Verified admin can manage both promo cards fully; "Xem video giới thiệu" was already wired, just missing seed data (2026-08-26)

Asked to confirm admin can manage both cards' image/content/links, and to
add a "Xem video giới thiệu" button to each. Checked
`TheraHOME-WEB/src/components/views/PhaseContentModal.tsx`'s `PromoTab` —
already complete on both sides: image upload (`uploadPhasePromoImage`,
reusing the `store-images` bucket), badge/title/description/CTA link/video
link for the cross-sell card, and image/description/video link/Apple
Product ID for the unlock card, all round-tripping through `db.ts`'s
`fetchPhasePromo`/`savePhasePromo` to the matching `phase_promos` columns —
no code gap. `PhaseUnlockPromo.tsx` (mobile) already renders the video
button conditionally on `crossSellVideoUrl`/`unlockVideoUrl` being
non-empty — it just never showed because the earlier seed migrations left
both columns `null`. Filled them (migration
`add_intro_video_urls_to_seeded_phase_promos`) with the app's existing
generic intro video (`mockData.ts`'s `introVideo` link) for all 4 seeded
`phase_promos` rows, so the button now renders as designed; admin can swap
in a real per-product video anytime from the same screen. `get_advisors`
unchanged (no new finding classes — this was a plain content UPDATE).


## Full-screen paywall between "Mở khoá ngay" and the Apple purchase sheet (2026-08-30)

`PhaseUnlockPromo`'s unlock button no longer calls `requestPurchase`
directly — it now navigates to a new modal route `app/paywall/[phaseId].tsx`
(registered with `presentation: 'modal'` in the patient `Stack.Protected`
group). The paywall screen shows the admin-authored `phase_promos` unlock
content (image/description/intro-video) plus three fixed benefit bullets
(new `paywall*` i18n keys, vi/en/ms), and owns the whole purchase flow:
StoreKit price on the CTA, `requestPurchase`, verifying state, error text,
and an unlocked-success state (check icon + "Tiếp tục" → back). The card in
the roadmap therefore dropped its `usePurchasePhase` usage entirely — its
button is always enabled since navigation needs no IAP module, which also
means the paywall screen itself is now viewable in plain Expo Go / a build
without `react-native-iap` (only the CTA inside stays disabled there via
the same `connected` guard as before).

`usePurchasePhase` gained an optional `{ onVerified }` callback (fired
after server verification + `finishTransaction` + query invalidation),
stored in a ref so inline callbacks don't churn the `useIAP` wiring — the
paywall uses it to flip into the success state. If already purchased
(navigated to a stale link), the screen shows the success state instead of
the pitch, via `usePhasePurchases`.

`npx tsc --noEmit` and `npx eslint` on the touched files are clean.

## Paywall redesigned to the supplied mock; all content admin-editable (2026-08-30)

`app/paywall/[phaseId].tsx` rebuilt to match the reference design: round X
close button over a large hero image card, an amber "Nội dung cao cấp"
badge (warning/warningTint tokens), title + subtitle, a white benefits card
(blue circular checks), a package/price card (crown icon, package
name/description, price right-aligned with a "/ trọn gói" suffix), a lock-
icon CTA, and a three-link footer (Điều khoản sử dụng → `/profile/legal/
terms`, Khôi phục giao dịch, Chính sách bảo mật → `/profile/legal/
security`). Icon map gained `crown` and `rotate-ccw`.

Every content block is admin-editable: migration
`202608301000_phase_promo_unlock_paywall_content` added `unlock_badge`,
`unlock_title`, `unlock_subtitle`, `unlock_benefits` (jsonb string array),
`unlock_package_name`, `unlock_package_desc`, `unlock_price_label` to
`phase_promos` (all nullable; mobile falls back to new `paywall*` i18n
defaults per field). `usePhasePromo` reads them; `src/types/database.ts`
regenerated. All four purchasable phase-3 rows were seeded with the mock's
Vietnamese copy ("Mở khoá giai đoạn 3 · {product}", 4 benefits, Gói Pro,
299.000đ). The CTA price still prefers StoreKit's live `displayPrice`;
`unlock_price_label` is display-only fallback — the charge is always the
App Store product's own price.

"Khôi phục giao dịch" is real: `usePurchasePhase` gained `restore()`/
`restoring` built on `useIAP`'s `getAvailablePurchases` + reactive
`availablePurchases` (match consumed by an effect since the promise
resolves before the state lands; an 800ms post-resolve timeout reports
`restore_not_found`, surfaced as its own i18n message). A restored
purchase goes through the same `verify-apple-purchase` server round-trip
(idempotent for the same user).

The admin-granted TheraNECK+ phase-3 unlock from 2026-08-28 was revoked
(`revoked_at` set) so the paywall is visible on all four products again.
`npx tsc --noEmit` + eslint clean on both repos.

## Paywall presentation switched from modal sheet to a full-screen push (2026-08-30)

`paywall/[phaseId]` no longer uses `presentation: 'modal'` in
`app/_layout.tsx` — it now pushes as a regular card like `day/[dayId]`.
Nothing else changed: `ScreenContainer` already applies top/bottom safe-area
insets so the layout is unaffected, dismissal is the same `router.back()`
behind the X button (plus the standard left-edge back swipe instead of
swipe-down), and the legal-doc routes it links to are still their own modal.

Follow-up same day: the layout was re-cut for the full-screen presentation —
the hero image now bleeds edge-to-edge under the status bar (screen uses
`edges={['bottom']}`; the X button offsets itself by `useSafeAreaInsets`'s
top inset instead), hero grew to 360pt with only bottom corners rounded,
and the rest of the content sits in its own 16px-padded container.

## Paywall hero image load-time fix (2026-08-30)

Two-part fix for the hero image loading visibly late on paywall open:
`PhaseUnlockPromo` now calls `Image.prefetch(unlockImageUrl)` as soon as the
promo row loads (roadmap is on screen well before the user taps "Mở khoá
ngay", so the file is in the OS image cache by open time), and the WEB
admin upload path now downscales images client-side before upload (see the
same-dated WEB note). Already-uploaded oversized heroes stay big until
re-uploaded through admin once. `expo-image` was considered and skipped —
it's a native module (another dev-client rebuild) and prefetch+smaller
files address the actual cause.

## Community post moderation, "ting" notification sound, dev double-boot mitigation (2026-08-31)

**Post moderation (CSKH duyệt bài)** — member posts now start `status =
'pending'` and are invisible to everyone except their author and staff
until approved. Migration `202608311000_community_post_moderation`:
`community_posts.status` (pending/approved/rejected; existing rows
backfilled approved), a BEFORE INSERT trigger that forces the initial
status server-side (official/staff posts auto-approve; clients can't
self-approve), a rewritten "public read posts" SELECT policy, a new
"web cskh update any post" policy (CSKH previously couldn't update posts
at all), `post_moderation` added to the notifications type check, and an
AFTER UPDATE trigger that notifies the author on approve/reject (approve
links to the post via `related_post_id`). App side: `useCommunity` maps
`status`; the feed card shows an amber "Đang chờ duyệt — hiện chỉ mình bạn
thấy bài viết này" banner (red "không được duyệt" variant for rejected);
create.tsx alerts "Đã gửi bài viết…" after posting; notifications inbox
renders/routes the new `post_moderation` type. Verified end-to-end in the
simulator: post → pending banner → SQL approve → Realtime clears the
banner; DB-level test confirmed the trigger chain. Test account
`bt1` / `12345678` (auth email `bt1@th.dev`, account_type 'tester',
display name "Boot Test") was created for simulator testing — delete when
no longer useful.

**Notification sound** — new `assets/sounds/ting.wav` (generated bell
tone). All local notifications (`pushNotifications.ts`: channel, daily/
evening reminders, test-blog) and all three push-sending edge functions
(dispatch-push / dispatch-system-notifications / dispatch-upsell-campaigns)
now send `sound: 'ting.wav'`. iOS: the wav was wired directly into
`project.pbxproj` (verified present in the built .app) AND added to the
expo-notifications plugin `sounds` array in app.json so future prebuilds
keep it. Android: channel id bumped `default` → `default-v2` (channel
settings are immutable once created, so the new sound needed a new id) —
dispatch-push sends the matching `channelId`. Requires a dev-client
rebuild (`npx expo run:ios`) to take effect; the edge functions need a
redeploy.

**"App loads twice" on startup** — investigated live in the simulator
(fresh build, both logged-out and logged-in cold starts): the boot is
white native splash → branded splash → app, exactly once; no remount of
`AppSplashScreen` was reproducible. The remaining explanation for the
reported double-load is dev-mode behavior: a Metro-connected launch can
boot the cached bundle then reload when the fresh bundle lands, and each
pass held the full 1.82s branded minimum. Mitigation:
`MIN_SPLASH_MS = __DEV__ ? 0 : 1820` in app/_layout.tsx — dev reloads no
longer replay the long brand animation; production behavior unchanged. If
the double-load is ever seen in a TestFlight/production build, reopen
this investigation.

## Roadmap switched to calendar-based day unlock; watching the video = completion (2026-08-31)

Mechanic change per explicit request. Days no longer unlock by pressing
"Hoàn thành buổi tập" — they unlock automatically, one per local calendar
day since `user_programs.activated_at` (local midnight is the boundary).
Completion is now recorded by actually starting the video (in-frame play
via the YouTube iframe's `onChangeState('playing')`, the "Xem trên
Youtube" button's confirm, or the error-fallback YouTube link) and only
tracks progress — it never unlocks anything.

Labels (PathNode): past watched → "Đã hoàn thành" (green check), past
unwatched → "Chưa hoàn thành" (red), today → "Hôm nay", tomorrow → clock
icon "Mở khoá sau 0h", further out → lock "Chưa mở khóa". New `DayStatus`
values `missed`/`upcoming`; statuses are derived client-side in
`useProgramDays`/`useCatalogProgramDays` via `deriveDayStatus()` +
`daysSinceLocal()` (usePrograms.ts) — the DB row's status only matters
for 'done'. `ActivatedProgram.currentDay` is now the calendar-derived
day (capped at totalDays), so Home's hero and the local reminders'
day-number follow the calendar automatically; the DB `current_day`
column is vestigial.

Server: new `mark_day_watched(p_user_program_id, p_program_day_id)` RPC
(migration `202608311200_calendar_unlock_mark_day_watched`) — marks the
day done idempotently (returns whether newly marked, used to fire the
7/14/last-day share alerts only once), refreshes adherence (done ÷ days
unlocked so far) and streak (terminal consecutive run; rest days don't
break it; streak-milestone notifications preserved), and gates on the
calendar with +1 day of timezone slack. `complete_day` is left in the DB
but the app no longer calls it; its "Ngày N đang chờ bạn" next-day
notification is gone (the local daily reminder covers that job).

Removed from the app: the pain-scale gate before opening a day
(`useRequestDay` deleted; PainScaleModal no longer rendered anywhere —
NOTE: the pain chart keeps its historical data but currently has no
new-entry point; flag this if pain check-ins should return in some form),
`useCompleteDay`/`useDayPainScore`, the finish button/hint on
day/[dayId].tsx (replaced by a "Xem video để hoàn thành" hint), and
roadmap/home now push straight into day detail. Phase quiz/promo footers
now appear when every non-rest day of the phase is done-or-missed (time
has passed), since completion no longer advances anything. Verified live
in the simulator with a program backdated 3 days: labels correct for all
five states, in-frame play marked day 4 done (streak 1, adherence 25%),
and the roadmap/Home "today" selection follows the calendar even after
today is watched.

Follow-up (same day): today's row keeps the "Hôm nay" label even after
it's watched (the circle still becomes the green check) — PathNode gained
an `isToday` prop driven by `program.currentDay`; and the tomorrow label
changed "Mở khoá sau 0h" → "Mở khoá vào 0h" (EN "Unlocks at midnight",
MS "Dibuka pada tengah malam"). Verified in the simulator.

## Sticky roadmap device selection + image-load speedups (2026-08-31)

**Sticky device**: the roadmap's product selection could differ between
app opens for users who never explicitly picked one — the fallback chain
ended at `activatedPrograms[0]` and the `user_programs` query had no ORDER
BY, so Postgres returned rows in effectively random order. Fixes:
`useActivatedPrograms` now orders by `activated_at, id`; and roadmap.tsx
pins the first resolved program into the persisted `selectedProductId`
(zustand persist) so whichever roadmap the user lands on stays their
roadmap until they change it via the dropdown themselves.

**Images**: WEB admin's `uploadStoreItemImage` (Store product cards) and
`uploadPostThumbnail` (pinned-post thumbnails) now run through the same
`downscaleImage` client-side compression as phase-promo images (see WEB
notes 2026-08-30) — multi-MB originals were the main reason Store/roadmap
images loaded slowly. `PhaseUnlockPromo` additionally prefetches the
cross-sell card image alongside the unlock/paywall hero. Store catalog
images were already prefetched from Home's mount. NOTE: images uploaded
before this pass are still the heavy originals on Storage — re-upload the
worst offenders through WEB Admin once so they go through compression.

## App Review compliance pass: wellness wording, AI consent, sources, device FAQ (2026-08-31)

Response to App Store review feedback (5 points). App-side changes:

1. **Third-party AI disclosure + consent**: chat/ai.tsx now blocks the
   composer behind a one-time consent card (persisted
   `aiConsentAccepted` in useAppStore) explaining that message content
   goes to a third-party AI service, what is NOT sent, and that replies
   are fitness reference only — with a link to the privacy policy. The
   privacy policy (legalContent.ts) gained section 5.1 spelling out the
   provider (Groq, US servers), exact data scope, timing (only after
   consent, only when messaging), purpose, and a no-sensitive-info
   warning.
2. **Medical→fitness wording sweep** (vi/en/ms): "Lộ trình phục hồi"→
   "Lộ trình tập luyện", "Biểu đồ sức khoẻ"→"Biểu đồ tiến trình",
   "Chuyên gia TheraHOME"→"Đội ngũ hỗ trợ TheraHOME" (i18n, chat/human
   header, notifications fallback, dispatch-push title — redeployed),
   zone subtitles dropped "Giảm đau"/pain-relief claims, waterTip dropped
   the spinal-disc claim, article titles (mockData + officialArticles +
   DB `articles` rows) de-medicalized, phase-promo seeded copy and the
   `ai_prompts` system prompt rewritten (explicitly: not a medical app,
   no diagnosis/treatment advice, redirect symptom questions to a
   doctor), one `ai_suggested_replies` chip reworded. legalContent's
   remaining rehab/therapy phrasing softened.
3. **Citations**: Help screen gained a "Nguồn tham khảo" section linking
   the WHO physical-activity guidelines, stating content is reference
   only. FAQ answers refreshed (incl. the stale unlock answer — now
   describes calendar unlock).
4. **Hardware explanation in-app**: new FAQ entry "Thiết bị TheraHOME là
   gì?" stating TheraNECK/TheraBACK are home training/relaxation aids,
   not medical devices, measure nothing, and don't sync data with the
   app.

Not code (for App Store Connect): the reviewer also wants a demo video
shot on a REAL iPhone showing the app used together with the physical
device, and review notes explaining the hardware — see the FAQ copy
above for the approved phrasing to reuse.

Follow-up (same day): the login screen and paywall footer were linking the
*information security* doc ('security' — "Chính sách bảo mật thông tin",
the technical-safeguards write-up) where the legally required *privacy
policy* ('privacy' — "Chính sách quyền riêng tư") belongs. Both now link
'privacy'; the paywall footer label became "Quyền riêng tư"/"Privacy"/
"Privasi". The security doc remains available in Profile → Pháp lý only.

## Removed the dev/test notification feature entirely (2026-09-01)

Per explicit request: the "Thử thông báo bài viết" button in
notifications-settings (already __DEV__-gated, now gone completely), its
handler, `scheduleTestBlogNotification` (pushNotifications.ts), and the
whole local AsyncStorage test-inbox subsystem in useNotifications.ts
(`createTestBlogInboxNotification`, TEST_PREFIX rows and their special
branches in read/markRead/markAllRead/delete — the inbox is now purely
server rows). The five test* i18n keys were dropped in all three
languages. `officialArticles.ts` stays — despite its TEST_BLOG_* naming
it is the real content behind the official profile's article list and
the article detail screen.
