import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH ?? 'ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH ?? 'ffprobe';

export async function getVideoDimensions(
  inputPath: string,
): Promise<{ width: number; height: number }> {
  const { stdout } = await execFileAsync(FFPROBE_PATH, [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-of',
    'csv=p=0',
    inputPath,
  ]);
  const [width, height] = stdout.trim().split(',').map(Number);
  return { width, height };
}

// ffmpeg's filtergraph mini-language treats ':' and '\' as syntax, so a
// Windows absolute path (e.g. C:\Users\...\clip.ass) needs both escaped
// before it can be used as a subtitles= filter argument.
export function escapeFfmpegFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:');
}

export interface ReframeOptions {
  width: number;
  height: number;
  // Initial crop position - also the only position used when sendCmdPath is
  // null (static center-crop fallback, no detected face to track).
  x: number;
  y: number;
  // Path to a sendcmd command file (see reframe.ts's buildSendCmdScript) -
  // null when no face was detected anywhere in the clip, in which case the
  // crop is static at (x, y) for the whole clip instead of tracking a face.
  sendCmdPath: string | null;
}

export async function renderClip(options: {
  // Local file path - ffmpeg can't operate on an object storage key
  // directly, so the caller must download the source first.
  inputPath: string;
  startTime: number;
  endTime: number;
  // null when the clip has no overlapping transcript text - a valid case
  // (e.g. a musical/silent moment), not an error. libass chokes on a
  // subtitle file with zero events, so the filter is omitted entirely
  // rather than pointed at one.
  subtitlesPath: string | null;
  outputPath: string;
  // null skips cropping entirely (keeps the source aspect ratio) - not used
  // by the current pipeline (every clip gets reframed to 9:16), kept
  // optional for the same reason subtitlesPath is: easy to test and a
  // natural, already-established pattern in this function's signature.
  reframe: ReframeOptions | null;
}): Promise<void> {
  const { inputPath, startTime, endTime, subtitlesPath, outputPath, reframe } = options;
  const duration = endTime - startTime;

  const args = ['-y', '-ss', startTime.toString(), '-i', inputPath, '-t', duration.toString()];

  const filters: string[] = [];
  if (reframe) {
    if (reframe.sendCmdPath) {
      // sendcmd must precede the filter it targets in the chain - crop is
      // tagged @reframe so sendcmd's command file (one "TIME crop@reframe x
      // .., crop@reframe y ..;" line per interpolated point - see
      // reframe.ts) can address it.
      filters.push(`sendcmd=f=${escapeFfmpegFilterPath(reframe.sendCmdPath)}`);
      filters.push(
        `crop@reframe=w=${reframe.width}:h=${reframe.height}:x=${reframe.x}:y=${reframe.y}`,
      );
    } else {
      filters.push(`crop=w=${reframe.width}:h=${reframe.height}:x=${reframe.x}:y=${reframe.y}`);
    }
  }
  if (subtitlesPath) {
    // After crop, not before - captions burn onto the final (possibly
    // reframed) frame, not the original wide one.
    filters.push(`subtitles='${escapeFfmpegFilterPath(subtitlesPath)}'`);
  }
  if (filters.length > 0) {
    args.push('-vf', filters.join(','));
  }

  args.push('-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', outputPath);

  await execFileAsync(FFMPEG_PATH, args);
}
