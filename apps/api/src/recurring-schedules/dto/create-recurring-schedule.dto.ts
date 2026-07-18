import { SocialPlatform } from '@speedora/shared';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateRecurringScheduleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  // Which connected account to publish to - see RecurringSchedule's schema
  // comment for why `platform` alone isn't enough. RecurringSchedulesService
  // validates this account belongs to the requester and matches `platform`.
  @IsString()
  @IsNotEmpty()
  socialAccountId!: string;

  // IANA timezone name (e.g. "Asia/Jakarta") - validated for realness (not
  // just non-empty) in the service, since `Intl` is the only thing that
  // actually knows the full IANA database.
  @IsString()
  @IsNotEmpty()
  timezone!: string;

  // 0=Sunday..6=Saturday, matches Date.getUTCDay().
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek!: number[];

  // 24h "HH:mm", wall-clock time in `timezone`.
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'timeOfDay must be 24h "HH:mm"' })
  timeOfDay!: string;
}
