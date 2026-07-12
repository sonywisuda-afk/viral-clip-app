import { PendingInviteRole } from '@speedora/shared';
import { IsEmail, IsEnum } from 'class-validator';

export class CreatePendingInviteDto {
  @IsEmail()
  email!: string;

  @IsEnum(PendingInviteRole)
  role!: PendingInviteRole;
}
