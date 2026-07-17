import { IsHexColor, IsOptional } from 'class-validator';

export class UpdateBrandKitDto {
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;
}
