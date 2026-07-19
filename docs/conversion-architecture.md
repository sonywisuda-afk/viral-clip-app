# Conversion Architecture

Sprint 6K ("Conversion") — a from-scratch feature, `apps/api/src/tracked-links/`. Lets a creator
attach a trackable, branded-looking short link to a `PublishRecord` or a `Campaign`, then reports
how many times it was clicked back on the performance/campaign dashboards.

**Read this first: "conversion" here means click count, not a purchase/signup/lead.** Every
`conversionCount` field in this system is a bot-filtered, deduplicated count of `GET /r/:slug`
hits — there is no purchase pixel, no goal/event tracking, no funnel. The frontend is explicit
about this too: `ClipTrafficTable`/`CampaignAnalyticsTab` render `conversionCount.toLocaleString()`
immediately followed by the literal label `klik` ("clicks"). Read "conversion" throughout this doc
(and this codebase) as "click," not as a commerce or lead-gen event — if a future sprint adds a
real conversion event (a pixel, a webhook from the destination site), it does not exist yet.

## The flow

```
Tracked Link → Redirect → Bot Filter → Dedup → Click Event → Conversion Count → Dashboard
```

### 1. Tracked Link (creation)

`POST /workspaces/:workspaceId/tracked-links` → `TrackedLinksService.create()`
(`apps/api/src/tracked-links/tracked-links.service.ts`). EDITOR+ only (same role floor as
`CampaignsService` — the closest precedent: a workspace-scoped resource attributable to a publish
or a campaign).

- **Slug**: `generateSlug()` (`slug.util.ts`) — `randomBytes(6)` base64url-encoded, 8 characters,
  48 bits of entropy (~2.8×10¹⁴ possible values). Never regenerated once created; it's the public
  path segment a creator shares (`/r/<slug>`). Collisions are handled by catching Prisma's `P2002`
  (unique constraint violation on the `slug` column) and retrying up to `MAX_SLUG_ATTEMPTS = 5`
  times — the column's own `@unique` constraint is the real guarantee, entropy just makes a retry
  loop unnecessary in practice.
- **Attribution**: exactly one of `publishRecordId` / `campaignId`, enforced both at the API layer
  (`hasPublishRecord === hasCampaign` → 400) and by a database CHECK constraint on `TrackedLink`
  (the schema comment calls the API-layer check "just a friendlier 400 before ever reaching it").
  The target must belong to the caller's own workspace — checked by an explicit lookup
  (`record.clip.video.workspaceId !== workspaceId` / `campaign.workspaceId !== workspaceId`) before
  the row is created, so a member of workspace A can never attribute a link's clicks to workspace
  B's publish or campaign.
- **Self-redirect guard**: `assertNotSelfRedirect()` rejects a `destinationUrl` that would resolve
  back into this app's own `/r/` path — otherwise a `TrackedLink` could chain into another
  `TrackedLink` (or itself), an open-redirect-style abuse vector this app's own domain shouldn't
  enable. Any other `http(s)` URL is accepted and never re-validated at redirect time — this is
  deliberately a general-purpose link shortener for a creator's own landing page/product link, not
  restricted to same-domain destinations.

The one piece of creation UI is `TrackedLinkCreator.tsx` — a destination-URL input plus submit,
attributed to whichever `{ publishRecordId }` or `{ campaignId }` its parent passes in. There is no
standalone tracked-links management page; `ClipTrafficTable`/`CampaignAnalyticsTab` show the
resulting `conversionCount` once the parent re-fetches, which the sprint judged enough to make the
feature usable.

### 2. Redirect

`GET /r/:slug` → `RedirectController.handleRedirect()` (`redirect.controller.ts`). Deliberately
public — no `JwtAuthGuard` — same "public route, does something, then redirects" shape as
`SocialController.callback()` (the OAuth callback): this link is clicked by a creator's own
audience in a browser, never by an authenticated app user. `ThrottlerGuard` here is a coarse
per-IP backstop against a scripted flood, not the real duplicate-click protection (that's the Dedup
stage below) — `TrackedLinksModule` registers its own separate `ThrottlerModule` (name `'redirect'`,
30 requests/10s/IP, Redis-backed via `RedisThrottlerStorage` so the limit is shared across every
`apps/api` replica, not counted independently per replica), deliberately distinct from
`AuthModule`'s 5-per-60s login limit — that limit would make a genuinely popular tracked link
unusable within seconds.

A slug that doesn't resolve to any `TrackedLink` throws `NotFoundException` (plain 404) — same
"resolve-or-404" convention as `ShareController`'s public token-scoped routes.

**The redirect is a 302 (`HttpStatus.FOUND`), never a 301.** This is load-bearing, not a stylistic
choice: a 301 (permanent redirect) is cacheable by browsers and CDNs, which would make every
repeat click from the same client resolve locally after the first — silently undercounting every
click after the first one, forever, with no way to detect it. A 302 forces every single click to
hit this endpoint, which is what click counting requires.

### 3. Bot Filter

`isBotUserAgent()` (`bot-detection.util.ts`) — best-effort, substring match over the lowercased
`User-Agent` header against a fixed list covering three categories: link-preview/unfurl bots
(Slack, Discord, `facebookexternalhit`, Twitterbot, WhatsApp, Telegram, LinkedIn — the bots that
fetch a shared link once, immediately after it's posted, to generate a preview card), generic
search-engine crawlers (Googlebot-style `bot`/`spider`/`crawl` substrings, DuckDuckBot, Baiduspider,
Yandexbot), and common scripted-request tools (`curl/`, `wget/`, `python-requests`,
`go-http-client`, `okhttp`, `HeadlessChrome`). **A missing `User-Agent` entirely is itself treated
as a bot** — a real browser click always sends one, so its absence is unusual enough to not trust.

This is deliberately biased toward over-flagging: the code comment states the reasoning explicitly
— a false negative (an uncaught bot) undercounts less than a false positive would inflate a real
creator's numbers, and this app's cross-cutting rule is "never a fabricated/inflated business KPI."
No ML, no third-party bot-detection service — a fixed substring list, revisited only if a new class
of bot traffic shows up in practice.

A bot-flagged request still gets a `TrackedLinkClick` row written (`isBot: true`) — the hit
genuinely happened — but is excluded from `TrackedLink.clickCount` and therefore from every
`conversionCount` this app reports anywhere.

### 4. Dedup

`ClickDedupService.isFirstOccurrence()` (`click-dedup.service.ts`) — a narrow, single-purpose raw
`ioredis` client (same hand-rolled-client shape as `NotificationPublisherService` and
`RedisThrottlerStorage` elsewhere in this app; there's no general-purpose injectable Redis client).

`RedirectService.recordClickAndResolve()` builds the dedup key as
`click-dedup:<trackedLinkId>:<sha256(ip + ':' + userAgent).slice(0, 16)>` and calls Redis
`SET key 1 EX 5 NX` — atomic "set only if not already present, expire in 5 seconds." The `SET NX`
return value (`'OK'` vs. `null`) is exactly "was this the first occurrence in the window," with no
separate read-then-write race. This catches the common near-duplicate cases: a browser retry, an
accidental double-click, a link-preview bot's own duplicate fetch immediately after a real click.

**Privacy posture, and why this doesn't need an IP column**: the raw IP and User-Agent are hashed
into that Redis key and *never persisted anywhere* — not logged, not written to Postgres. The key
itself expires within 5 seconds. This is the one place in the app that reads a raw client IP for
click-tracking, and it exists purely as ephemeral dedup state. `TrackedLinkClick`'s schema comment
states the corresponding durable-storage side of this: no IP column, no raw User-Agent column, no
cookies, no fingerprinting — "only store what's genuinely needed for analytics and attribution."

### 5. Click Event

Only on the first occurrence within the dedup window, `RedirectService` writes both halves of the
outcome in one Prisma `$transaction`:

1. `TrackedLinkClick.create({ trackedLinkId, referrer, isBot })` — `referrer` is read from the
   `Referer` header (a real attribution signal: did this click come from the actual published post,
   or somewhere else), truncated to 512 characters defensively against an oversized header.
2. `TrackedLink.update({ clickCount: { increment: 1 } })` — **conditionally included, skipped
   entirely when `isBot` is true.** The array-spread pattern
   (`...(isBot ? [] : [prisma.trackedLink.update(...)])`) means a bot click still lands its
   `TrackedLinkClick` row (detail history) but never touches the counter.

`TrackedLinkClick` is explicitly documented as append-only *detail* history behind
`TrackedLink.clickCount`'s denormalized total — kept for this dedup lookback and for a possible
future time-series drill-down, not read on every performance-page load (that reads the O(1)
counter instead, see below).

**Scalability note carried over from the code comment**: at click volumes far beyond what this app
sees today, this synchronous write pair would move behind a BullMQ job (already wired for exactly
this kind of decoupling elsewhere in this app) so the redirect itself never waits on Postgres. Not
done today — a single indexed transactional write pair is fast enough at current volumes, and
queueing it now would be complexity with no present benefit.

### 6. Conversion Count

`TrackedLink.clickCount` is the only number ever read for "how many conversions" — never a live
`COUNT(*)` over `TrackedLinkClick`. Every read site sums `clickCount` across however many
`TrackedLink` rows are attributed to the same parent, and reports **`null`, never a fabricated
`0`, when no `TrackedLink` has been created yet**:

- **Per publish record** — `clip-performance.util.ts`'s `CLIP_WITH_PERFORMANCE` include selects
  only `trackedLinks: { select: { clickCount: true } }` (an O(1) read per link, never a `COUNT()`
  scan), and `toClipPerformanceDto()` computes
  `traffic[].conversionCount = record.trackedLinks.length > 0 ? sum(clickCount) : null`. This feeds
  `ClipTrafficTable`'s "Conversion" column, which either shows the summed click count, the
  just-created link's redirect URL (before the parent re-fetches), or a `TrackedLinkCreator` if no
  link exists yet for that publish record.
- **Per campaign** — `CampaignsService.get()` computes `conversionCount` the identical way, but off
  `campaign.trackedLinks` directly (a `TrackedLink` can be attributed straight to a `Campaign`
  rather than to one specific `PublishRecord` — see attribution above). Feeds
  `CampaignAnalyticsTab`.

A `TrackedLink` can have zero, one, or more clicks, and a `PublishRecord`/`Campaign` can have zero,
one, or more `TrackedLink`s attached (a creator may want more than one trackable link for the same
publish) — the sum-across-links behavior is what makes multiple links per target meaningful rather
than silently overwriting each other.

### 7. Dashboard

`ClipTrafficTable.tsx` (per-clip performance page) and `CampaignAnalyticsTab.tsx` (campaign
analytics) are the two read surfaces. Both follow the same three-state render: a real number
(`conversionCount !== null`), a just-created link's redirect URL (client-side-only state, keyed by
`publishRecordId`, so it survives a re-render without forcing a re-fetch just to show what was just
made), or the `TrackedLinkCreator` form when neither applies yet.

## Data model summary

```
Workspace ──┬── TrackedLink ──┬── (0..1) PublishRecord   (exactly one of these two,
            │                 └── (0..1) Campaign          enforced by a DB CHECK constraint)
            │
            └── TrackedLinkClick (append-only, FK → TrackedLink, isBot flag)
```

`TrackedLink.clickCount` is the denormalized, bot-filtered running total; `TrackedLinkClick` rows
are the append-only detail log behind it. See `docs/data-ownership.md` for how `TrackedLink` fits
into the rest of the entity graph (`Workspace`/`PublishRecord`/`Campaign` ownership).

## Known limits (verified against the code, not speculative)

- Bot detection is substring/User-Agent-based only — no JS challenge, no CAPTCHA, no behavioral
  signal. It will not catch a bot that spoofs a normal browser User-Agent.
- Dedup is a 5-second best-effort window, not a cryptographic guarantee — the code comment calls
  this out directly ("a fuzzy, best-effort debounce... the right tradeoff for a window this
  short").
- There is no tracked-links management UI (list/delete outside of what `remove()` supports via
  `DELETE /tracked-links/:id`) — creation-only UI, by explicit sprint scope.
- "Conversion" is click-through only; there is no post-redirect signal (no pixel on the destination
  page, no webhook) that this app could ever receive, so a genuine purchase/signup conversion rate
  is not something this system can report today.
