import type { Response } from 'express';
import type { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: { getStats: jest.Mock; getActivity: jest.Mock; exportCsv: jest.Mock };
  const user = { id: 'user-1', email: 'a@example.com', role: 'CREATOR' as const };

  beforeEach(() => {
    dashboardService = {
      getStats: jest.fn(),
      getActivity: jest.fn(),
      exportCsv: jest.fn(),
    };
    controller = new DashboardController(dashboardService as unknown as DashboardService);
  });

  it('delegates GET stats to DashboardService.getStats with the requesting user', async () => {
    const stats = { totalVideos: 3 };
    dashboardService.getStats.mockResolvedValue(stats);

    const result = await controller.getStats(user);

    expect(dashboardService.getStats).toHaveBeenCalledWith('user-1');
    expect(result).toBe(stats);
  });

  describe('getActivity', () => {
    it('parses limit and delegates to the service', async () => {
      await controller.getActivity(user, '10');

      expect(dashboardService.getActivity).toHaveBeenCalledWith('user-1', 10);
    });

    it('falls back to the default limit when given an invalid value, instead of throwing', async () => {
      await controller.getActivity(user, 'not-a-number');

      expect(dashboardService.getActivity).toHaveBeenCalledWith('user-1', 20);
    });

    it('clamps an out-of-range limit rather than passing it through raw', async () => {
      await controller.getActivity(user, '9999');

      expect(dashboardService.getActivity).toHaveBeenCalledWith('user-1', 100);
    });
  });

  describe('exportCsv', () => {
    it('sends the CSV with the right content type and attachment filename', async () => {
      dashboardService.exportCsv.mockResolvedValue('Section,Metric,Value\n');
      const res = { setHeader: jest.fn(), send: jest.fn() } as unknown as Response;

      await controller.exportCsv(user, res);

      expect(dashboardService.exportCsv).toHaveBeenCalledWith('user-1');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="speedora-report.csv"',
      );
      expect(res.send).toHaveBeenCalledWith('Section,Metric,Value\n');
    });
  });
});
