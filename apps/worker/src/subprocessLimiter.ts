// A small, dependency-free counting semaphore bounding how many heavy
// Python/FFmpeg subprocesses THIS worker process runs at once, across every
// queue/job currently in flight. BullMQ's per-queue `concurrency: 1` (see
// each worker's construction in workers/*.worker.ts) only limits how many
// JOBS run at once PER QUEUE - it says nothing about how many subprocesses
// those jobs collectively spawn once several queues each have their own job
// running simultaneously (e.g. a render-clip job's ~10 detectors plus a
// concurrent transcribe job's diarization/vocal-emotion passes). Left
// uncapped, that's exactly the CPU contention that turned a single FFmpeg
// encode into a multi-hour hang tonight when two videos happened to process
// at the same time. Every heavy execFile call site (the *Deps.ts adapters,
// ffmpeg.ts) is wrapped with this.
const MAX_CONCURRENT_SUBPROCESSES = Number(process.env.MAX_CONCURRENT_SUBPROCESSES ?? 2);

let active = 0;
const waiting: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT_SUBPROCESSES) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waiting.push(() => {
      active += 1;
      resolve();
    });
  });
}

function release(): void {
  active -= 1;
  const next = waiting.shift();
  if (next) next();
}

// Runs `fn` once fewer than MAX_CONCURRENT_SUBPROCESSES other calls made
// through this same limiter are in flight, queueing FIFO otherwise (the
// slot is always released - even on failure - so one failing subprocess
// call never permanently shrinks the pool).
export async function withSubprocessLimit<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

// Wraps a promise-returning function (typically a promisified execFile) so
// every call goes through withSubprocessLimit, preserving the wrapped
// function's exact parameter/return types - a drop-in replacement at the
// single `const execFileAsync = ...` definition site in each caller, no
// per-call-site changes needed.
export function limitExecFile<F extends (...args: never[]) => Promise<unknown>>(fn: F): F {
  return ((...args: Parameters<F>) => withSubprocessLimit(() => fn(...args))) as F;
}
