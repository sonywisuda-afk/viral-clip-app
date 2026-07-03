import type { Readable } from 'node:stream';

const INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';

export interface TikTokUploadParams {
  accessToken: string;
  videoStream: Readable;
}

export interface TikTokUploadResult {
  publishId: string;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// "Upload to Inbox" (draft) target of TikTok's Content Posting API - see
// CLAUDE.md's Fase 6d section for why this was chosen over Direct Post.
// Unlike Direct Post, this endpoint's init body is just source_info (no
// title/caption/privacy fields at all) - the video lands in the user's
// TikTok inbox as a draft, and they add a caption/finish posting themselves
// inside the TikTok app. There's no way to pre-fill a caption via this
// call, unlike uploadYouTubeVideo()'s title/description.
//
// Uploads as a single chunk (total_chunk_count: 1) rather than TikTok's
// full multi-chunk PUT protocol - this project's clips are capped at ~60s
// by detect-clips' own prompt, so a rendered 9:16 clip is always well
// within a single PUT in practice. Buffering the whole stream up front
// (rather than piping, like uploadYouTubeVideo() can) is required either
// way, since the init call must declare the exact video_size before any
// bytes are sent.
export async function uploadTikTokVideo(params: TikTokUploadParams): Promise<TikTokUploadResult> {
  const { accessToken, videoStream } = params;
  const video = await streamToBuffer(videoStream);

  const initRes = await fetch(INIT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: video.length,
        chunk_size: video.length,
        total_chunk_count: 1,
      },
    }),
  });
  const initBody = (await initRes.json()) as {
    data?: { publish_id?: string; upload_url?: string };
    error?: { code?: string; message?: string };
  };
  if (!initRes.ok || !initBody.data?.publish_id || !initBody.data.upload_url) {
    throw new Error(
      `TikTok inbox/video/init failed: ${initRes.status} ${initBody.error?.code ?? ''} ${
        initBody.error?.message ?? ''
      }`.trim(),
    );
  }

  const uploadRes = await fetch(initBody.data.upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${video.length - 1}/${video.length}`,
    },
    body: video,
  });
  if (!uploadRes.ok) {
    throw new Error(
      `TikTok video upload PUT failed: ${uploadRes.status} ${await uploadRes.text()}`,
    );
  }

  return { publishId: initBody.data.publish_id };
}
