# Deployment

Production runs via `docker-compose.prod.yml`. See `docker.md` for image-build details and
`architecture.md` for the general service topology (api/worker/web + Postgres/Redis/object
storage).

## Bringing up production

```bash
docker compose -f docker-compose.prod.yml up --build
```

`docker-compose.prod.yml` has an explicit `name: speedora-prod` so it never collides with
`docker-compose.yml` (dev) if both happen to run on the same machine in the same directory —
without it, compose derives the project name from the folder, and `postgres`/`redis` in both
files would be treated as the same containers (a `down` on one could delete the other's data).

## Migration-before-boot ordering

`packages/database/Dockerfile` builds a one-shot `migrate` service; both `api` and `worker`
services declare `depends_on: { migrate: { condition: service_completed_successfully } }`, so
neither app starts against a database that hasn't been migrated yet.

## Env var sourcing

Two files, layered via `env_file` as a **list** on the `api`/`worker` services:

```yaml
env_file:
  - .env
  - .env.production
```

Later files win on shared keys. `.env` is the single source for everything that's the *same* value
in dev and prod (`JWT_SECRET`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `MIDTRANS_*`, etc.) — it is not
copied into any Docker image; these values come from the real environment the compose file is run
in. `.env.production` (gitignored, start from the tracked `.env.production.example`) overrides
just `STORAGE_*`, because `.env`'s copy points at the dev-only MinIO container (`docker.md`) which
doesn't exist in the prod compose stack. `DATABASE_URL`/`REDIS_URL`/`FFMPEG_PATH` are overridden
directly in the compose file itself (compose network service names / the container's own ffmpeg
binary), not sourced from either env file.

Forgetting to populate `.env.production` before a prod deploy does **not** fail boot — `STORAGE_*`
isn't validated at startup (see `backend.md`'s boot-time guarantees) — but every upload/download
will fail trying to reach `localhost:9000`, which doesn't exist inside the prod container network.
Check this explicitly before/after a deploy, it will not surface as a boot error.

## Storage: MinIO (dev) vs. R2/S3 (prod)

See `docker.md` for the full MinIO story. The only thing that differs between dev and prod is the
`STORAGE_*` env values — `packages/storage`'s client code is fully generic over any S3-compatible
endpoint and needs zero changes either way.
