import { ServiceUnavailableException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { PrismaService } from '../prisma/prisma.service';

const checkStorageConnectionMock = jest.fn();
jest.mock('@speedora/storage', () => ({
  checkStorageConnection: (...args: unknown[]) => checkStorageConnectionMock(...args),
}));

import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };
  let pingMock: jest.Mock;
  let transcribeQueue: { client: Promise<{ get: jest.Mock }> };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    pingMock = jest.fn().mockResolvedValue(null);
    transcribeQueue = { client: Promise.resolve({ get: pingMock }) };
    checkStorageConnectionMock.mockResolvedValue(undefined);
    controller = new HealthController(
      prisma as unknown as PrismaService,
      transcribeQueue as unknown as Queue,
    );
  });

  describe('live', () => {
    it('returns ok with no dependency checks', () => {
      expect(controller.live()).toEqual({ status: 'ok' });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(pingMock).not.toHaveBeenCalled();
      expect(checkStorageConnectionMock).not.toHaveBeenCalled();
    });
  });

  describe('check', () => {
    it('returns ok when the database, Redis, and storage are all reachable', async () => {
      const result = await controller.check();

      expect(result).toEqual({ status: 'ok' });
      expect(pingMock).toHaveBeenCalled();
      expect(checkStorageConnectionMock).toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException naming the database when it is unreachable', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

      await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
      await expect(controller.check()).rejects.toThrow(/database/);
    });

    it('throws ServiceUnavailableException naming redis when it is unreachable', async () => {
      pingMock.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
      await expect(controller.check()).rejects.toThrow(/redis/);
    });

    it('throws ServiceUnavailableException naming storage when it is unreachable', async () => {
      checkStorageConnectionMock.mockRejectedValue(new Error('bucket not found'));

      await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
      await expect(controller.check()).rejects.toThrow(/storage/);
    });

    it('names every unreachable dependency at once', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
      checkStorageConnectionMock.mockRejectedValue(new Error('bucket not found'));

      await expect(controller.check()).rejects.toThrow(/database.*storage|storage.*database/);
    });
  });
});
