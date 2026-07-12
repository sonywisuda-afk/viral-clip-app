// Defense-in-depth outer bound on a whole job processor's wall-clock time.
// By now every individual subprocess call this pipeline makes has its own
// timeout (diarization, vocal emotion, ffmpeg trim/render, yt-dlp download) -
// this doesn't replace any of those, it catches whatever ISN'T covered by
// one of them: an unbounded await on some future code path, or several
// individually-bounded steps whose worst cases happen to stack up past a
// sane total. Note this can only make the PROCESSOR reject promptly so
// BullMQ marks the job failed and moves on - it can't force-cancel whatever
// async work is still in flight underneath (Promise.race doesn't cancel the
// loser), so the real work may keep running briefly in the background until
// its own timeout (if any) eventually tears it down too.
export class JobTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} exceeded its ${timeoutMs}ms job-level timeout`);
    this.name = 'JobTimeoutError';
  }
}

export async function withJobTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer!: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new JobTimeoutError(label, timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
