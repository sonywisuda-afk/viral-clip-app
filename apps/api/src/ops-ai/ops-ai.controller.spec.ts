import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@speedora/database';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { OpsAiService } from './ops-ai.service';
import { OpsAiController } from './ops-ai.controller';

describe('OpsAiController', () => {
  let controller: OpsAiController;
  let opsAiService: {
    getHealth: jest.Mock;
    getSignals: jest.Mock;
    getDistribution: jest.Mock;
    getCorrelation: jest.Mock;
    getCalibration: jest.Mock;
    getDrift: jest.Mock;
    getReadiness: jest.Mock;
  };

  beforeEach(() => {
    opsAiService = {
      getHealth: jest.fn(),
      getSignals: jest.fn(),
      getDistribution: jest.fn(),
      getCorrelation: jest.fn(),
      getCalibration: jest.fn(),
      getDrift: jest.fn(),
      getReadiness: jest.fn(),
    };
    controller = new OpsAiController(opsAiService as unknown as OpsAiService);
  });

  it('is restricted to ADMIN/AI_ENGINEER/OPERATOR via @Roles metadata', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, OpsAiController);
    expect(roles).toEqual([UserRole.ADMIN, UserRole.AI_ENGINEER, UserRole.OPERATOR]);
  });

  it('applies both JwtAuthGuard and RolesGuard at the class level', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, OpsAiController);
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it('delegates each route to the matching OpsAiService method', async () => {
    const routes: Array<[() => Promise<unknown>, jest.Mock]> = [
      [() => controller.getHealth(), opsAiService.getHealth],
      [() => controller.getSignals(), opsAiService.getSignals],
      [() => controller.getDistribution(), opsAiService.getDistribution],
      [() => controller.getCorrelation(), opsAiService.getCorrelation],
      [() => controller.getCalibration(), opsAiService.getCalibration],
      [() => controller.getDrift(), opsAiService.getDrift],
      [() => controller.getReadiness(), opsAiService.getReadiness],
    ];

    for (const [call, mock] of routes) {
      const sentinel = { ok: true };
      mock.mockResolvedValue(sentinel);
      const result = await call();
      expect(result).toBe(sentinel);
    }
  });
});
