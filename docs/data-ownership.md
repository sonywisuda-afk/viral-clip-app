# Data Ownership

Who owns what, and which of the two access-control models — direct user ownership vs. workspace
membership — governs each entity. This is the map that explains decisions like "why does
`AnalyticsController` filter by `ownerId` while `WorkspaceAnalyticsController` filters by
`workspaceId`" (Sprint 6D/6E/6F/6K all had to make this call explicitly). Read
`packages/database/prisma/schema.prisma` for the authoritative field list; this doc explains the
relationships and *why* they're shaped this way, not every column.

## The two scoping models

This codebase has two coexisting, deliberately separate access-control boundaries:

1. **Direct user ownership** — a row has a `userId`/`ownerId`/`createdById` column pointing
   straight at `User`, with no workspace in between. `SocialAccount.userId` is the clearest case:
   a platform OAuth connection belongs to the *person* who authorized it, never to a workspace —
   which is why a `Campaign` or `TrackedLink` scoped to a workspace can only publish through
   social accounts its *creator* personally connected, not any account any workspace member
   happens to hold.
2. **Workspace membership** — a row has a `workspaceId` column, and access is resolved through
   `WorkspaceMembership` (`WorkspaceAccessService.assertMinRole`/`assertVideoAccess`), not through
   who created it. `Video`, `Project`, `Folder`, `Campaign`, `RecurringSchedule`, `TrackedLink`,
   and `Workspace` itself are all workspace-scoped this way.

Sprint 5A (Collaboration Foundation) introduced the second model on top of an app that originally
only had the first. `Video` grew a `workspaceId` column (every `User` gets exactly one
`isPersonal` `Workspace` at signup, so every pre-existing video could be backfilled onto one),
but **`Video.ownerId` was deliberately kept, not removed** — it's retained as "who uploaded this"
display metadata, while `workspaceId` + the requester's `WorkspaceMembership` role is the real
access-control read going forward (`workspace-access.service.ts`).

This is why two analytics surfaces exist side by side instead of one being migrated into the
other: `AnalyticsController`/`AnalyticsService` (Milestones 5A/5B, predates most of the workspace
model's downstream use) still filters by `ownerId` — "how did *my* content perform," a creator
looking at their own numbers, unchanged since before Sprint 5A. `WorkspaceAnalyticsController`
(Sprint 6D) is a **new, additive, workspace-scoped sibling** — "how did *my team's* content
perform" — reusing the same aggregation functions (`analytics-architecture.md`) over a
workspace-filtered candidate set instead of an owner-filtered one. `CampaignsController` and
`TrackedLinksController` are workspace-scoped from the start (Publishing Expansion Phase 6 /
Sprint 6K), since a campaign or a trackable link is inherently a team object, not a personal one.
Neither surface was collapsed into the other — the plan's explicit position (see `backend.md`'s
Analytics Dashboard section) is that owner-scoped and workspace-scoped are different questions
with different audiences, not two representations of the same data.

## Entity map

```
User ──┬── owns ──> SocialAccount ──┬── publishRecords ──> PublishRecord
       │                            └── followerSnapshots ──> SocialAccountFollowerSnapshot
       │
       └── workspaceMemberships ──> WorkspaceMembership ──> Workspace
                                                                │
                                        ┌───────────┬──────────┼───────────────┬──────────────┐
                                        ▼           ▼          ▼               ▼              ▼
                                     Project    Campaign  RecurringSchedule TrackedLink      Video
                                        │           │          │               │              │
                                     Folder     PublishRecord ◄┴───────────────┘         Clip ◄┘
                                                     │
                                                     ├── statsSnapshots ──> PublishRecordStatsSnapshot
                                                     └── trackedLinks ──> TrackedLink
```

- **`User`** — the root identity. Owns `SocialAccount`s directly, and reaches every `Workspace` it
  can act in through `WorkspaceMembership` (including its own personal one, role `OWNER`).
- **`Workspace`** — the real access-control boundary for everything created inside it.
  `Workspace.ownerId` is "who created this workspace," display metadata only, same pattern as
  `Video.ownerId` — never used for access checks (`WorkspaceMembership` is).
- **`SocialAccount`** — belongs to a `User`, never a `Workspace`. A `Campaign`/`RecurringSchedule`/
  ad-hoc publish scoped to a workspace still ultimately publishes through one specific member's
  personally-connected account (`PublishRecord.socialAccountId`) — there's no "workspace-level"
  OAuth connection.
- **`Video` → `Clip`** — `Video.workspaceId` is the access boundary; `Video.ownerId` is "who
  uploaded it," used for the owner-scoped Analytics surface above. `Video.projectId`/`folderId`
  are optional organizational placement within the workspace, unrelated to access control.
  `Clip.videoId` inherits its video's workspace implicitly — a `Clip` has no `workspaceId` column
  of its own; anything that needs a clip's workspace joins through `Clip.video.workspaceId`.
- **`Campaign`** — workspace-scoped (`Campaign.workspaceId`), `createdById` is display metadata
  only (same pattern as `Workspace.ownerId`). Deliberately has no budget/KPI/target-reach/ROI/
  ad-spend fields — those belong to a future Marketing Automation suite, an explicit scope cut,
  not an oversight (see the model's own schema comment).
- **`PublishRecord`** — the actual unit of "a clip published to a platform," and the join point
  almost everything above hangs off. It has **no `workspaceId` column of its own** — its
  workspace is reached by joining `clip.video.workspaceId`, which is why
  `WorkspaceAnalyticsService`'s queries filter through that relation chain rather than a direct
  column. `campaignId`/`recurringScheduleId` are both nullable and independent (a record can
  belong to neither, either, or both), and both use **`onDelete: SetNull`**, not `Cascade` —
  deleting a `Campaign` or `RecurringSchedule` must never delete or orphan a `PublishRecord` that
  already fired or is in flight; it just detaches from the group and the publish itself stands.
- **`PublishRecordStatsSnapshot`** / **`SocialAccountFollowerSnapshot`** — append-only history
  hanging off `PublishRecord`/`SocialAccount` respectively (see `analytics-architecture.md`'s
  Snapshot stage for how they're populated). Both `onDelete: Cascade` from their parent — a
  snapshot has no meaning once the thing it's a snapshot *of* is gone.
- **`TrackedLink`** — workspace-scoped (`TrackedLink.workspaceId`), and separately attaches to
  *either* a single `PublishRecord` *or* a whole `Campaign` (mutually exclusive at the service
  layer, see `tracked-links.service.ts`) — a campaign-wide trackable link vs. a per-publish one.
  Unlike `PublishRecord`'s own `campaignId`/`recurringScheduleId`, **this relation is
  `onDelete: Cascade`**: a `TrackedLink` scoped to one specific publish (or campaign) has no
  meaning once that publish (or campaign) is gone, the opposite reasoning from the `SetNull`
  case above — the thing being deleted here is the tracked link's *entire reason to exist*, not
  just its grouping. See `conversion-architecture.md` for `TrackedLink`'s own click-processing
  pipeline (`TrackedLinkClick`, bot filtering, dedup) — this doc only covers how it attaches to
  `PublishRecord`/`Campaign`.

## See also

- `analytics-architecture.md` — how `PublishRecord`/the two snapshot models feed the dashboard.
- `conversion-architecture.md` — `TrackedLink`/`TrackedLinkClick`'s own internal pipeline.
- `backend.md`'s "Ownership & security" section — the request-level enforcement
  (`@CurrentUser()`, identical 404s) built on top of the model this doc describes.
