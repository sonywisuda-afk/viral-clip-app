import type { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';

// Not re-exported from '@nestjs/throttler's public entry point (only
// referenced internally by ThrottlerStorage's method signature), so it's
// redeclared here rather than reaching into a dist-internal import path -
// structurally identical, which is all TypeScript needs to accept it as
// this method's return type.
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

// Reimplements @nestjs/throttler's default ThrottlerStorageService (an
// in-memory Map) against Redis, atomically via a Lua script, so N
// concurrent apps/api replicas racing on the same key (e.g. the same IP
// hammering POST /auth/login) can never under-count each other's hits -
// the exact gap the in-memory version has once there's more than one
// replica: each replica keeps its own independent counter, so the
// effective limit silently becomes `limit x replica count`.
//
// Reproduces the in-memory version's actual behavior - a genuine sliding
// window (every hit is remembered for exactly `ttl` ms from when it
// happened, via ThrottlerStorageService.setExpirationTime's
// per-hit setTimeout, not "reset at a fixed window boundary") - via a
// per-key sorted set of hit timestamps, since Redis has no per-member
// expiry within a ZSET; the block state gets its own key so its TTL can be
// tracked independently of the hit-timestamp set. Uses Redis's own clock
// (TIME) rather than the calling app server's clock so multiple replicas
// agree on "now" even if their local clocks drift.
const INCREMENT_SCRIPT = `
local hitsKey = KEYS[1]
local blockedKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local time = redis.call('TIME')
local now = math.floor(tonumber(time[1]) * 1000 + tonumber(time[2]) / 1000)

local blockPttl = redis.call('PTTL', blockedKey)
local isBlocked = blockPttl and blockPttl > 0
local totalHits

if isBlocked then
  -- Matches the in-memory version's "if (!isBlocked) fireHitCount(...)" -
  -- a request that arrives while already blocked doesn't get counted
  -- again, it just re-reports the current state.
  totalHits = redis.call('ZCARD', hitsKey)
else
  redis.call('ZREMRANGEBYSCORE', hitsKey, '-inf', now - ttl)
  local seqKey = hitsKey .. ':seq'
  local seq = redis.call('INCR', seqKey)
  redis.call('ZADD', hitsKey, now, now .. '-' .. seq)
  redis.call('PEXPIRE', hitsKey, ttl)
  redis.call('PEXPIRE', seqKey, ttl)
  totalHits = redis.call('ZCARD', hitsKey)

  if totalHits > limit then
    redis.call('SET', blockedKey, '1', 'PX', blockDuration)
    isBlocked = true
    blockPttl = blockDuration
  end
end

local timeToExpire = 0
local oldest = redis.call('ZRANGE', hitsKey, 0, 0, 'WITHSCORES')
if oldest[2] then
  timeToExpire = math.ceil((tonumber(oldest[2]) + ttl - now) / 1000)
  if timeToExpire < 0 then timeToExpire = 0 end
end

local timeToBlockExpire = 0
if isBlocked then
  timeToBlockExpire = math.ceil((blockPttl or 0) / 1000)
  if timeToBlockExpire < 0 then timeToBlockExpire = 0 end
end

return {totalHits, timeToExpire, isBlocked and 1 or 0, timeToBlockExpire}
`;

export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly client: Redis;

  constructor() {
    // Constructed inside ThrottlerModule.forRootAsync's useFactory (see
    // auth.module.ts), which Nest defers until DI instantiation time -
    // after ConfigModule.forRoot() has loaded the root .env file. Reading
    // REDIS_URL any earlier (e.g. at module-import time) would silently
    // pick up an undefined value - the same class of bug QueueModule's own
    // comment documents having hit for real.
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `throttler:${throttlerName}:${key}:hits`;
    const blockedKey = `throttler:${throttlerName}:${key}:blocked`;
    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = (await this.client.eval(
      INCREMENT_SCRIPT,
      2,
      hitsKey,
      blockedKey,
      ttl,
      limit,
      blockDuration,
    )) as [number, number, number, number];

    return {
      totalHits,
      timeToExpire,
      isBlocked: isBlocked === 1,
      timeToBlockExpire,
    };
  }
}
