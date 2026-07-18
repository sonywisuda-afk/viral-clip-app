import { IsArray, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsString()
  clipId?: string;

  // Clip-relative if clipId is set, otherwise video-relative.
  @IsOptional()
  @IsNumber()
  @Min(0)
  timestampSeconds?: number;

  // Replying to a reply is rejected server-side (only root comments can be
  // a parent) - see CommentService.create.
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentionedUserIds?: string[];
}
