// A thin, dependency-free structured-JSON logger for apps/api - same shape
// as apps/worker/src/logger.ts's forStage (kept as two small, independent
// files rather than a shared package: this is a ~20 line utility on each
// side, well under the size where sharing it across a package boundary
// pays for itself). One JSON object per line with the fields a
// log-aggregation pipeline needs to query by - request id, which user/video/
// clip a request touched, duration, and the error if any.
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  requestId?: string;
  userId?: string;
  videoId?: string;
  clipId?: string;
  durationMs?: number;
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
    app: 'api',
    message,
    ...fields,
    ...(error !== undefined ? { error: serializeError(error) } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write('debug', message, fields ?? {}),
  info: (message: string, fields?: LogFields) => write('info', message, fields ?? {}),
  warn: (message: string, fields?: LogFields, error?: unknown) =>
    write('warn', message, fields ?? {}, error),
  error: (message: string, fields?: LogFields, error?: unknown) =>
    write('error', message, fields ?? {}, error),
};
