import { Prisma } from './generated/prisma/client';
import type { JobExecution, NodeExecutionStatus, PrismaClient } from './generated/prisma/client';

// Inserts one JobExecution row (the parent of a render-clip run's NodeExecution rows below) -
// call once, before running the graph. See schema.prisma's JobExecution doc comment for why a
// job-level parent exists instead of one flat node-row table.
export async function startJobExecution(
  prisma: Pick<PrismaClient, 'jobExecution'>,
  clipId: string,
  graphVersion: string,
  options: { workerVersion?: string; gitCommit?: string; startedAt?: Date } = {},
): Promise<JobExecution> {
  return prisma.jobExecution.create({
    data: {
      clipId,
      graphVersion,
      workerVersion: options.workerVersion ?? null,
      gitCommit: options.gitCommit ?? null,
      startedAt: options.startedAt ?? new Date(),
    },
  });
}

// Stamps a JobExecution's finishedAt/totalDurationMs once the graph settles (success or failure -
// callers should call this from a `finally`).
export async function finishJobExecution(
  prisma: Pick<PrismaClient, 'jobExecution'>,
  jobExecutionId: string,
  totalDurationMs: number,
  finishedAt: Date = new Date(),
): Promise<void> {
  await prisma.jobExecution.update({
    where: { id: jobExecutionId },
    data: { finishedAt, totalDurationMs },
  });
}

// Inserts one NodeExecution row - the Phase 1 render-graph telemetry write (see
// ARCHITECTURE.md's "Composing multiple modules" section and executor.ts's `onNodeComplete`
// hook). Takes any Prisma client-shaped object (a real PrismaClient, or a `tx`) so callers can
// compose it into an existing transaction, same shape as recordVideoStatusEvent() above it.
export async function recordNodeExecution(
  prisma: Pick<PrismaClient, 'nodeExecution'>,
  jobExecutionId: string,
  nodeId: string,
  level: number,
  status: NodeExecutionStatus,
  startedAt: Date,
  finishedAt: Date,
  durationMs: number,
  errorMessage?: string,
  metadata?: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.nodeExecution.create({
    data: {
      jobExecutionId,
      nodeId,
      level,
      status,
      startedAt,
      finishedAt,
      durationMs,
      errorMessage: errorMessage ?? null,
      metadata: metadata ?? Prisma.JsonNull,
    },
  });
}
