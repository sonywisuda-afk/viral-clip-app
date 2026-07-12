import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { QueueName } from '@speedora/shared';
import { checkStorageConnection } from '@speedora/storage';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    // Any one of QueueModule's queues works here - they all share the same
    // underlying Redis connection, so this isn't specifically "is transcribe
    // reachable", just a convenient handle onto that shared connection.
    @InjectQueue(QueueName.TRANSCRIBE) private readonly transcribeQueue: Queue,
  ) {}

  // Liveness only - no dependency checks, just "is the process up and
  // handling requests". Cheap enough for a container orchestrator to poll
  // frequently without putting any load on Postgres/Redis/storage; use
  // /health (below) for anything that needs to know a dependency is down.
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  // Unauthenticated and unthrottled on purpose - a load balancer or
  // orchestrator hits this frequently and won't be carrying a session
  // cookie. It only reports reachability, never video/user data. Checks
  // every durable dependency this app actually needs to serve a request
  // (Postgres, Redis via BullMQ, object storage) - a partial outage in any
  // one of them means real requests will fail, so this should too rather
  // than reporting healthy while, say, uploads are silently broken.
  @Get()
  async check() {
    const [database, redis, storage] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      // BullMQ's IRedisClient interface (adapter-agnostic - ioredis in this
      // deployment, but not assumed) has no ping(); a GET round-trip on a
      // key that will never exist is just as good a reachability probe and
      // is part of that shared interface.
      this.transcribeQueue.client.then((client) => client.get('__health_check__')),
      checkStorageConnection(),
    ]);

    const failures = { database, redis, storage } as const;
    const unreachable = Object.entries(failures)
      .filter(([, result]) => result.status === 'rejected')
      .map(([name]) => name);

    if (unreachable.length > 0) {
      throw new ServiceUnavailableException(`Unreachable: ${unreachable.join(', ')}`);
    }
    return { status: 'ok' };
  }
}
