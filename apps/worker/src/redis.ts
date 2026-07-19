import { Redis } from 'ioredis';

// TODO(tech debt, found during the cross-feature E2E verification pass -
// apps/worker/src/scripts/cross-feature-e2e/): read at module-load time, not
// lazily. Fine for main.ts (dotenv's config() is its very first line), but
// any dotenv-based tsx/esbuild script where config() doesn't run before this
// module gets transitively imported will silently fall through to the
// 'redis://localhost:6379' default instead of throwing - esbuild/tsx hoists
// ES `import` declarations ahead of same-file code even under its CJS
// output, so a same-file config()-then-import ordering doesn't actually
// protect you (see cross-feature-e2e/index.ts's bootstrap() comment for a
// real instance: it silently connected to an unrelated project's Redis
// container). Not fixed here - flagging only. A real fix would make this
// lazy (read process.env.REDIS_URL inside createRedisConnection() below
// instead of at module scope).
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export function createRedisConnection(): Redis {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: null });
}
