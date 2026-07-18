import { IsOptional, IsString } from 'class-validator';

// Sprint 5A (Collaboration Foundation). All fields optional - an omitted
// key means "don't touch this field," while an explicit `null` on
// projectId/folderId clears it (moves the video back to the workspace
// root). class-validator has no clean way to distinguish "field absent"
// from "field explicitly null" at the decorator level - VideosService.move()
// does that distinction itself via `!== undefined` checks.
export class MoveVideoDto {
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  projectId?: string | null;

  @IsOptional()
  @IsString()
  folderId?: string | null;
}
