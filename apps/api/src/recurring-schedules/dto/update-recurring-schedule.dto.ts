import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

// `platform`/`socialAccountId` are deliberately NOT editable - changing
// which account a schedule targets is a different-enough operation
// (re-validating platform/account ownership, and it's ambiguous what
// should happen to already-assigned future slots) that it's simpler and
// safer to delete and recreate the schedule instead, same "smallest viable
// surface" call as other first-pass resources in this app.
export class UpdateRecurringScheduleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timezone?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'timeOfDay must be 24h "HH:mm"' })
  timeOfDay?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
