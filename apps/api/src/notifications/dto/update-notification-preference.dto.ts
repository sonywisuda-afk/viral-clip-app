import { NotificationChannel } from '@speedora/shared';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

// Sprint 4B - enabled/toast both optional so a single toggle click only
// sends the field that changed; NotificationsService.updatePreference reads
// current row state for the other. Milestone 04d - channel optional,
// defaults to IN_APP server-side (preserves every existing caller
// unchanged); toast stays meaningful only for IN_APP, ignored for
// SLACK/DISCORD/WEBHOOK.
export class UpdateNotificationPreferenceDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  toast?: boolean;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}
