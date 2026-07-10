# Redis

Two uses only — Redis never holds anything that must survive a restart/flush unrecoverably. See
`architecture.md`'s "PostgreSQL as source of truth" principle.

## BullMQ backing store

Every queue in `queue.md` is backed by Redis via `createRedisConnection()`. Job state (waiting/
active/completed/failed) lives here, but the *durable* result of a job (transcript rows, clip
rows, status) is always written to Postgres before/as part of the job completing — losing Redis
loses in-flight job scheduling, never a completed pipeline stage's data.

`schedule-publish-clip`'s design is the clearest illustration of this principle: a "scheduled
publish" is deliberately **not** a Redis delayed job. It's a Postgres row (`PublishRecord.
scheduledAt`) polled by a BullMQ *repeatable* job — if Redis loses its state (restart without
persistence, flush), the only consequence is the next poll fires late; the scheduled publish
itself is never silently dropped, because Postgres never depended on Redis to remember it existed.

## Rate limiting

`POST /auth/login` is rate-limited via `@nestjs/throttler`, configured **in-memory**, not
Redis-backed — acceptable because `apps/api` runs as a single instance for this project's current
scale. Would need a Redis-backed store if `apps/api` were ever horizontally scaled.
