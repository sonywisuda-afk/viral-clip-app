import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@speedora/database';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OpsAiService } from './ops-ai.service';

// Milestone 5C-B (AI Operations Dashboard) - system-wide, NOT owner-scoped
// (contrast with AnalyticsController). Restricted to ADMIN/AI_ENGINEER/
// OPERATOR - RolesGuard runs after JwtAuthGuard so it can read the live
// role JwtStrategy attaches to request.user. Every response is wrapped
// `{ results: [{ engine: 'v2', ... }] }` so a future Fusion v3 comparison
// doesn't need a redesign (see OpsAiEngineVersion in packages/shared).
@Controller('ops/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.AI_ENGINEER, UserRole.OPERATOR)
export class OpsAiController {
  constructor(private readonly opsAiService: OpsAiService) {}

  @Get('health')
  getHealth() {
    return this.opsAiService.getHealth();
  }

  @Get('signals')
  getSignals() {
    return this.opsAiService.getSignals();
  }

  @Get('distribution')
  getDistribution() {
    return this.opsAiService.getDistribution();
  }

  @Get('correlation')
  getCorrelation() {
    return this.opsAiService.getCorrelation();
  }

  @Get('calibration')
  getCalibration() {
    return this.opsAiService.getCalibration();
  }

  @Get('drift')
  getDrift() {
    return this.opsAiService.getDrift();
  }

  @Get('readiness')
  getReadiness() {
    return this.opsAiService.getReadiness();
  }
}
