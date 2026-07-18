import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PublishClipDto {
  @IsString()
  @IsNotEmpty()
  socialAccountId!: string;

  // Omitted entirely means "publish now" (Fase 6b's original behavior).
  // Fase 6c: a future ISO 8601 timestamp schedules the publish instead -
  // ClipsService.publish() validates it's actually in the future. IGNORED
  // when recurringScheduleId is set - the server computes scheduledAt
  // itself in that case (see next-slot.util.ts).
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  // Publishing Expansion Phase 6 (Scheduling) - both optional and
  // independent of each other, see Campaign/RecurringSchedule's own doc
  // comments in schema.prisma. socialAccountId above is still required
  // even when recurringScheduleId is set - the server validates it matches
  // the schedule's own account rather than silently overriding it, to
  // catch a stale/wrong client state.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  campaignId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  recurringScheduleId?: string;
}
