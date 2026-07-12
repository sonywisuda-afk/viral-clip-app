// A thin, dependency-free structured-JSON logger for apps/worker - no HTTP
// framework here (unlike apps/api, which already has NestJS's own Logger -
// see mail.service.ts/storage.service.ts for that convention), so there's
// nothing to build on top of. One JSON object per line, matching the fields
// a log-aggregation pipeline actually needs to query by: which pipeline
// stage, which video/clip/job, how long it took, which attempt, and the
// error if any - the exact shape ARCHITECTURE.md's "Explicitly deferred"
// structured-logging note called for. Deliberately NOT a new npm dependency
// (no pino/winston) - this is a small enough surface that wrapping
// console.log/warn/error directly is the whole implementation, same
// "no new package for a ~20 line utility" precedent as subprocessLimiter.ts.
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  // Which pipeline stage/worker emitted this line (e.g. 'transcribe',
  // 'render-clip') - always present in practice (each worker file sets its
  // own logger via forStage below), optional here only so LogFields stays
  // usable standalone.
  stage?: string;
  videoId?: string;
  clipId?: string;
  jobId?: string;
  publishRecordId?: string;
  durationMs?: number;
  attempt?: number;
  [key: string]: unknown;
}

// Errors don't serialize through JSON.stringify on their own (an Error
// instance stringifies to `{}` - only its OWN enumerable properties survive,
// which excludes message/stack) - pulled out explicitly instead.
function serializeError(error: unknown): { name?: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function write(level: LogLevel, message: string, fields: LogFields, error?: unknown): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    app: 'worker',
    message,
    ...fields,
    ...(error !== undefined ? { error: serializeError(error) } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export interface StageLogger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields, error?: unknown): void;
  error(message: string, fields?: LogFields, error?: unknown): void;
}

// Binds `stage` once per caller (one call per worker/module file) so every
// line it logs carries that field without repeating it at each call site -
// e.g. `const logger = forStage('render-clip')` then
// `logger.error('render failed', { clipId, videoId }, error)`.
export function forStage(stage: string): StageLogger {
  return {
    debug: (message, fields) => write('debug', message, { stage, ...fields }),
    info: (message, fields) => write('info', message, { stage, ...fields }),
    warn: (message, fields, error) => write('warn', message, { stage, ...fields }, error),
    error: (message, fields, error) => write('error', message, { stage, ...fields }, error),
  };
}
