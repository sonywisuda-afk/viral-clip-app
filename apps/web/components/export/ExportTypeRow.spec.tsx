/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ExportJobStatus, ExportType, type ExportJobDto } from '@speedora/shared';
import { createExportJob, getExportJob } from '@/lib/api';
import { ExportTypeRow } from './ExportTypeRow';

jest.mock('@/lib/api', () => ({
  createExportJob: jest.fn(),
  getExportJob: jest.fn(),
  exportJobDownloadUrl: (id: string) => `/api/export/${id}/download`,
}));

const mockCreateExportJob = createExportJob as jest.Mock;
const mockGetExportJob = getExportJob as jest.Mock;

function job(overrides: Partial<ExportJobDto>): ExportJobDto {
  return {
    id: 'job-1',
    videoId: 'video-1',
    type: ExportType.PDF,
    status: ExportJobStatus.READY,
    resultUrl: null,
    failReason: null,
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
    ...overrides,
  };
}

// Recent Exports / Persistent Export History - the first component test in
// this app (see jest.config.js's comment on the RTL decision). Covers the
// seeding behavior this feature adds (initialJob -> immediate correct
// status, no loading flash) plus the pre-existing Generate flow, so a
// regression in either shows up here.
describe('ExportTypeRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Generate" when there is no job yet', () => {
    render(<ExportTypeRow videoId="video-1" type={ExportType.PDF} initialJob={null} />);

    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
  });

  it('renders Download and "Generate Ulang" immediately for a READY initialJob', () => {
    const ready = job({ status: ExportJobStatus.READY });

    render(<ExportTypeRow videoId="video-1" type={ExportType.PDF} initialJob={ready} />);

    expect(screen.getByRole('link', { name: /Unduh/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Ulang' })).toBeInTheDocument();
    expect(screen.getByText('Siap')).toBeInTheDocument();
    // Seeded from initialJob via SWR fallbackData - no fetch needed to show it.
    expect(mockGetExportJob).not.toHaveBeenCalled();
  });

  it('renders a processing indicator for a PROCESSING initialJob', () => {
    const processing = job({ status: ExportJobStatus.PROCESSING });

    render(<ExportTypeRow videoId="video-1" type={ExportType.PDF} initialJob={processing} />);

    expect(screen.getByText('Memproses...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate' })).not.toBeInTheDocument();
  });

  it('renders the fail reason and "Coba Lagi" for a FAILED initialJob', () => {
    const failed = job({
      status: ExportJobStatus.FAILED,
      failReason: 'Render gagal',
    });

    render(<ExportTypeRow videoId="video-1" type={ExportType.PDF} initialJob={failed} />);

    expect(screen.getByText('Render gagal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coba Lagi' })).toBeInTheDocument();
  });

  it('clicking Generate creates a new export job', async () => {
    mockCreateExportJob.mockResolvedValue(job({ id: 'job-new', status: ExportJobStatus.PENDING }));
    mockGetExportJob.mockResolvedValue(job({ id: 'job-new', status: ExportJobStatus.PENDING }));

    render(<ExportTypeRow videoId="video-1" type={ExportType.PDF} initialJob={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    expect(mockCreateExportJob).toHaveBeenCalledWith('video-1', ExportType.PDF);
    await screen.findByText('Menunggu');
  });
});
