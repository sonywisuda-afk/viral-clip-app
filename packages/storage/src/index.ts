import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';

let client: S3Client | null = null;

// Lazy - constructed on first use, not at module load time. Both apps/api
// (via NestJS's module graph) and apps/worker (via CommonJS require order)
// can end up importing this before their root .env file has been loaded;
// reading STORAGE_* eagerly at module scope would silently pick up
// undefined values in that case. See QueueModule/JwtStrategy in apps/api
// for the same class of bug hit earlier in this project.
function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: process.env.STORAGE_REGION ?? 'auto',
      endpoint: process.env.STORAGE_ENDPOINT,
      forcePathStyle: (process.env.STORAGE_FORCE_PATH_STYLE ?? 'true') === 'true',
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? '',
      },
      // The SDK's default request timeout is 0 (disabled) - a keep-alive
      // connection from this client's pool that goes stale (observed
      // against R2: reused successfully once, then a later call on the
      // exact same client hangs forever with no error) would otherwise
      // block the caller indefinitely instead of failing. connectionTimeout
      // bounds establishing a new connection; requestTimeout bounds the
      // whole request/response, generous enough for a large legitimate
      // video upload/download over a slow link. throwOnRequestTimeout is
      // required - without it a request-timeout breach is only logged as a
      // warning, not thrown (see @smithy/types's NodeHttpHandlerOptions).
      requestHandler: {
        connectionTimeout: 10_000,
        requestTimeout: 5 * 60 * 1000,
        throwOnRequestTimeout: true,
      },
    });
  }
  return client;
}

function bucket(): string {
  const value = process.env.STORAGE_BUCKET;
  if (!value) {
    throw new Error('STORAGE_BUCKET is not set');
  }
  return value;
}

// A connection-level failure (as opposed to a real S3 error like NoSuchKey,
// which comes back as a normal HTTP response) - the classes of error a stale
// keep-alive pool produces. Observed for real against R2 from a long-running
// apps/api process: every request from the existing client timed out at
// exactly connectionTimeout while a freshly-constructed client on the same
// machine connected instantly, so the client instance itself was the problem.
function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  return (
    error.name === 'TimeoutError' ||
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    error.message.includes('socket hang up')
  );
}

// Every storage call goes through this instead of getClient().send()
// directly: when the cached client's connection pool has gone bad (see
// isConnectionError above), the whole pool is thrown away and the call
// retried ONCE on a brand-new client - self-healing without restarting the
// process. Non-connection errors (NoSuchKey, auth, etc.) propagate
// immediately; a retry that fails again propagates too.
async function sendResilient<Output>(command: {
  // Matches any @aws-sdk command for this client without naming the SDK's
  // internal command union type.
  input: object;
}): Promise<Output> {
  try {
    return (await getClient().send(command as never)) as Output;
  } catch (error) {
    if (!isConnectionError(error)) throw error;
    client = null;
    return (await getClient().send(command as never)) as Output;
  }
}

// `body` accepts a Readable, not just a Buffer, so a large source file (e.g. import-youtube.
// worker.ts's downloaded YouTube video, which can run several hundred MB+) can be streamed
// straight from disk instead of first being read fully into memory - avoiding both the extra
// peak-memory pressure and, more importantly, giving the upload a real bound: streamed through
// this client, it inherits the SAME requestTimeout the PutObjectCommand itself already enforces
// (see getClient() above), where an unbounded readFile() beforehand would not.
// Returns the response's ETag (ETag header value, quotes included as S3
// sends them) so a caller that wants integrity verification on top of an
// ordinary upload can compare it against a locally-computed MD5 - see
// render-clip.worker.ts's checksum check on the final rendered output.
// Existing callers that don't need this just don't use the return value.
export async function uploadObject(
  key: string,
  body: Buffer | Readable,
  contentType?: string,
): Promise<string | undefined> {
  const result = await sendResilient<{ ETag?: string }>(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
  );
  return result.ETag;
}

export async function getObjectStream(key: string): Promise<Readable> {
  const result = await sendResilient<{ Body: Readable }>(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );
  return result.Body;
}

export interface RangeObjectResult {
  stream: Readable;
  contentType?: string;
  // Total size of the requested range (or the whole object, if no Range
  // header was sent) - what the caller sets Content-Length to.
  contentLength?: number;
  // Only set when `range` was provided and the request was satisfiable -
  // the caller uses this as the HTTP Content-Range response header and to
  // decide between a 200 and a 206 status.
  contentRange?: string;
}

// Like getObjectStream, but passes through an HTTP Range header (e.g.
// "bytes=0-1023") so a <video> element can seek within a large file without
// downloading the whole thing first - see GET /videos/:id/source in
// apps/api, the only caller that needs this. Kept separate from
// getObjectStream rather than adding an optional param there, since none of
// its three existing callers (clip download, worker transcribe/render-clip
// source reads) need partial-content semantics.
export async function getObjectStreamRange(
  key: string,
  range?: string,
): Promise<RangeObjectResult> {
  const result = await sendResilient<{
    Body: Readable;
    ContentType?: string;
    ContentLength?: number;
    ContentRange?: string;
  }>(new GetObjectCommand({ Bucket: bucket(), Key: key, Range: range }));
  return {
    stream: result.Body,
    contentType: result.ContentType,
    contentLength: result.ContentLength,
    contentRange: result.ContentRange,
  };
}

export async function deleteObject(key: string): Promise<void> {
  await sendResilient(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

// A lightweight reachability check for apps/api's /health endpoint - confirms
// the bucket exists and credentials/endpoint are valid without transferring
// any object data (unlike every other function here, which all move real
// bytes). Throws on failure; the caller decides how to report that.
export async function checkStorageConnection(): Promise<void> {
  await sendResilient(new HeadBucketCommand({ Bucket: bucket() }));
}

// The one caller (apps/worker's publish-clip job, for an Instagram Reels
// publish - see CLAUDE.md's Fase 6d "Instagram" section) needs to hand a
// clip to Meta's servers, and Instagram's Content Publishing API can only
// ingest video via a public HTTPS URL it fetches itself - unlike YouTube/
// TikTok, there's no direct byte-upload option. This is the first time this
// project exposes anything resembling a direct link to the bucket (every
// other read path goes through an authenticated apps/api endpoint) - kept
// short-lived and scoped to exactly one object/one call, generated
// server-side and never returned to a browser client.
export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds: number,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}
