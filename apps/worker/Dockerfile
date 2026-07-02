# Build from the repo root: docker build -f apps/worker/Dockerfile .
# This is a pnpm workspace - packages/shared, packages/database, and
# packages/storage are real source dependencies of apps/worker, not
# published packages, so the build context has to be the whole monorepo.

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @viral-clip-app/shared build \
    && pnpm --filter @viral-clip-app/database build \
    && pnpm --filter @viral-clip-app/storage build \
    && pnpm --filter @viral-clip-app/worker build
# Bundles apps/worker's dist output with only its production dependencies
# (workspace deps included as real copies, not symlinks) into a
# self-contained directory - see https://pnpm.io/cli/deploy. --ignore-scripts
# because this reruns packages/database's postinstall (`prisma generate`),
# and the prod-only install here has already stripped out the `prisma` CLI
# (a devDependency) - the generated client from the build step above is
# already sitting in packages/database/dist and gets copied over as-is.
RUN pnpm --filter @viral-clip-app/worker deploy --prod --ignore-scripts /out

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
# render-clip shells out to ffmpeg directly (apps/worker/src/ffmpeg.ts) -
# needs the real binary on PATH, not a Node wrapper library.
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY --from=build /out .
# No .env file is copied into the image on purpose - config comes entirely
# from real environment variables passed at `docker run`/orchestrator level.
# main.ts's dotenv config() call just no-ops when the file isn't found, same
# as it already does in CI where DATABASE_URL etc. also aren't a file.
USER node
# No HTTP server here (apps/worker only consumes BullMQ jobs), so there's no
# endpoint to HEALTHCHECK against. Liveness is the process itself: if it
# crashes, the container exits non-zero and the orchestrator restarts it -
# see validateEnv() in env.ts for the fail-fast-at-boot half of that story.
CMD ["node", "dist/main.js"]
