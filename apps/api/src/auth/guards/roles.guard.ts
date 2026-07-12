import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { SafeUser } from '../auth.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Milestone 5C-B - runs AFTER JwtAuthGuard (which populates request.user via
// JwtStrategy's per-request DB lookup, so `role` here is always the live
// value, not a stale JWT claim). No role list on the route = no restriction
// (every existing endpoint stays untouched since none of them use @Roles).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user: SafeUser }>();
    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('This endpoint is restricted to AI Ops roles');
    }
    return true;
  }
}
