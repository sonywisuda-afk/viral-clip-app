// Phase 1 instrumentation for the render-graph executor - the render-clip-specific fan-out layer
// executor.ts itself can't own (that file stays Prisma/Sentry-agnostic, see its top-of-file
// comment). One JobExecution row per runGraph() call, one NodeExecution row per node - see
// schema.prisma's doc comments for why (Phase 2 weight-calibration queries need this to be
// SQL-queryable, not scraped out of logs).
//
// Every node's outcome fans out to three places, each doing a different job:
//   - Postgres (NodeExecution/JobExecution) - the source of truth for Phase 2 statistical
//     analysis (fallback rates, latency by node, correlation with highlightScore).
//   - Sentry - real-time alerting, but only for outcome: 'failure' (a "never throws" node
//     throwing anyway is a real bug worth paging on; a routine optional-node fallback is expected
//     behavior already logged by onRenderGraphNodeFailure below and would just be alert noise).
//   - console.debug - a structured line per node for local dev/investigation without a DB round
//     trip.
// All three are best-effort: a telemetry failure must never fail or slow down the render-clip job
// itself, so every write here is fire-and-forget with its own catch.
import * as Sentry from '@sentry/node';
import {
  finishJobExecution,
  recordNodeExecution,
  startJobExecution,
  type NodeExecutionStatus,
} from '@speedora/database';
import { version as WORKER_VERSION } from '../../package.json';
import { prisma } from '../prisma';
import {
  runGraph,
  type GraphNode,
  type NodeExecutionEvent,
  type NodeId,
  type NodeOutcome,
} from './executor';
import type { RenderGraphContext } from './context';

// Reproduces render-clip.worker.ts's exact pre-graph warn-message format
// (`[render-clip] ${label} failed for clip ${clipId}, continuing without ${dataLabel}:`) - kept
// here (render-clip-specific), not in executor.ts (which stays generic and knows nothing about
// this wording or about `clipId`).
export function onRenderGraphNodeFailure(
  node: GraphNode<RenderGraphContext, unknown>,
  error: unknown,
  ctx: RenderGraphContext,
): void {
  console.warn(
    `[render-clip] ${node.label} failed for clip ${ctx.clipId}, continuing without ${node.dataLabel}:`,
    error,
  );
}

// Bump manually when renderClipGraph's node set changes in a way that would make historical
// telemetry non-comparable (a node added/removed/renamed) - not on every unrelated worker change.
export const RENDER_CLIP_GRAPH_VERSION = 'render-clip-v1';

// Unset in local dev unless explicitly exported - deployment can set this from `git rev-parse
// HEAD` at build/deploy time. Best-effort: null telemetry rows are still useful, just not
// attributable to an exact commit.
const GIT_COMMIT = process.env.GIT_COMMIT;

const OUTCOME_TO_STATUS: Record<NodeOutcome, NodeExecutionStatus> = {
  success: 'SUCCESS',
  fallback: 'FALLBACK',
  failure: 'FAILED',
};

function reportNodeExecution(
  jobExecutionId: string,
  event: NodeExecutionEvent<RenderGraphContext>,
): void {
  console.debug(
    `[render-graph] node="${event.node.id}" level=${event.level} outcome=${event.outcome} ` +
      `durationMs=${event.durationMs} clip=${event.ctx.clipId}`,
  );

  if (event.outcome === 'failure') {
    Sentry.captureException(event.error, {
      tags: { clipId: event.ctx.clipId, nodeId: event.node.id },
    });
  }

  const errorMessage = event.error instanceof Error ? event.error.message : undefined;
  recordNodeExecution(
    prisma,
    jobExecutionId,
    event.node.id,
    event.level,
    OUTCOME_TO_STATUS[event.outcome],
    event.startedAt,
    event.finishedAt,
    event.durationMs,
    errorMessage,
  ).catch((error: unknown) => {
    console.warn(
      `[render-graph] failed to record NodeExecution telemetry for node "${event.node.id}" (clip ${event.ctx.clipId}):`,
      error,
    );
  });
}

// Same shape as runGraph() (same nodes/ctx in, same Record<NodeId, unknown> out) plus the
// telemetry fan-out above wrapped around it - render-clip.worker.ts's only call site swaps
// runGraph() for this and is otherwise unchanged.
export async function runInstrumentedRenderGraph(
  nodes: ReadonlyArray<GraphNode<RenderGraphContext, unknown>>,
  ctx: RenderGraphContext,
): Promise<Record<NodeId, unknown>> {
  const jobStartedAt = Date.now();
  let jobExecutionId: string | null = null;
  try {
    const job = await startJobExecution(prisma, ctx.clipId, RENDER_CLIP_GRAPH_VERSION, {
      workerVersion: WORKER_VERSION,
      gitCommit: GIT_COMMIT,
    });
    jobExecutionId = job.id;
  } catch (error) {
    console.warn(
      `[render-graph] failed to start JobExecution telemetry row for clip ${ctx.clipId}, continuing without node telemetry:`,
      error,
    );
  }

  try {
    return await runGraph(nodes, ctx, {
      onNodeFailure: onRenderGraphNodeFailure,
      onNodeComplete: jobExecutionId
        ? (event) => reportNodeExecution(jobExecutionId as string, event)
        : undefined,
    });
  } finally {
    if (jobExecutionId) {
      finishJobExecution(prisma, jobExecutionId, Date.now() - jobStartedAt).catch(
        (error: unknown) => {
          console.warn(
            `[render-graph] failed to finish JobExecution telemetry row ${jobExecutionId} for clip ${ctx.clipId}:`,
            error,
          );
        },
      );
    }
  }
}
