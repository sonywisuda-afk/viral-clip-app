import { TranscriptionProvider } from '@speedora/shared';
import { IsEnum, IsOptional, IsString } from 'class-validator';

// Only the non-file fields of the multipart upload form - multer parses
// these alongside the 'file' field into req.body, and Nest's @Body() picks
// them up the same way it would for a plain JSON request. transcriptionProvider
// is chosen fresh per upload (not an account-level setting) - omitted
// defaults to the free GROQ tier in VideosController. workspaceId (Sprint
// 5A, Collaboration Foundation) - omitted defaults to the uploader's own
// personal workspace, preserving every pre-5A caller's behavior exactly.
export class UploadVideoDto {
  @IsOptional()
  @IsEnum(TranscriptionProvider)
  transcriptionProvider?: TranscriptionProvider;

  @IsOptional()
  @IsString()
  workspaceId?: string;
}
