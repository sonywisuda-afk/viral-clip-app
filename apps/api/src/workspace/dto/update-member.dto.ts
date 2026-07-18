import { WorkspaceRole } from '@speedora/shared';
import { IsEnum } from 'class-validator';

export class UpdateMemberDto {
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}
