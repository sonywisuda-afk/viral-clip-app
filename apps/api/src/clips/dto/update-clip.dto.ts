import { CaptionStyle } from '@viral-clip-app/database';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateClipDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  startTime?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  endTime?: number;

  @IsOptional()
  @IsEnum(CaptionStyle)
  captionStyle?: CaptionStyle;
}
