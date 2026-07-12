import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@speedora/database';

export const ROLES_KEY = 'roles';

// Milestone 5C-B - gates GET /ops/ai/* (system-wide aggregate data, not any
// one user's own) behind ADMIN/AI_ENGINEER/OPERATOR. Paired with RolesGuard.
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
