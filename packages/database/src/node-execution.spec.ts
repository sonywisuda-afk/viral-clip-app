import { Prisma } from './generated/prisma/client';
import { finishJobExecution, recordNodeExecution, startJobExecution } from './node-execution';

describe('startJobExecution', () => {
  it('creates one JobExecution row with the given graph version', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'job-1' });
    const prisma = { jobExecution: { create } };
    const startedAt = new Date('2026-07-11T00:00:00.000Z');

    await startJobExecution(prisma as never, 'clip-1', 'render-clip-v1', { startedAt });

    expect(create).toHaveBeenCalledWith({
      data: {
        clipId: 'clip-1',
        graphVersion: 'render-clip-v1',
        workerVersion: null,
        gitCommit: null,
        startedAt,
      },
    });
  });

  it('includes workerVersion and gitCommit when given', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'job-1' });
    const prisma = { jobExecution: { create } };

    await startJobExecution(prisma as never, 'clip-1', 'render-clip-v1', {
      workerVersion: '0.1.0',
      gitCommit: 'abc123',
      startedAt: new Date('2026-07-11T00:00:00.000Z'),
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workerVersion: '0.1.0', gitCommit: 'abc123' }),
      }),
    );
  });
});

describe('finishJobExecution', () => {
  it('stamps finishedAt and totalDurationMs', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = { jobExecution: { update } };
    const finishedAt = new Date('2026-07-11T00:00:05.000Z');

    await finishJobExecution(prisma as never, 'job-1', 5000, finishedAt);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { finishedAt, totalDurationMs: 5000 },
    });
  });
});

describe('recordNodeExecution', () => {
  it('creates one NodeExecution row with no error message or metadata', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { nodeExecution: { create } };
    const startedAt = new Date('2026-07-11T00:00:00.000Z');
    const finishedAt = new Date('2026-07-11T00:00:00.042Z');

    await recordNodeExecution(
      prisma as never,
      'job-1',
      'sceneCuts',
      0,
      'SUCCESS' as never,
      startedAt,
      finishedAt,
      42,
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        jobExecutionId: 'job-1',
        nodeId: 'sceneCuts',
        level: 0,
        status: 'SUCCESS',
        startedAt,
        finishedAt,
        durationMs: 42,
        errorMessage: null,
        metadata: Prisma.JsonNull,
      },
    });
  });

  it('includes an error message when given one', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { nodeExecution: { create } };
    const startedAt = new Date('2026-07-11T00:00:00.000Z');
    const finishedAt = new Date('2026-07-11T00:00:00.015Z');

    await recordNodeExecution(
      prisma as never,
      'job-1',
      'sceneCuts',
      0,
      'FALLBACK' as never,
      startedAt,
      finishedAt,
      15,
      'boom',
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ errorMessage: 'boom' }) }),
    );
  });
});
