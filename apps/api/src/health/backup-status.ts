import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Written by ops/backup's scripts (write_status in ops/backup/lib.sh) after
// every backup attempt - see docs/backup-restore.md. Read by both
// BackupsController (GET /backups) and MonitoringController (GET /alerts) -
// extracted here so there's exactly one place that knows this file's shape
// and one definition of "stale".
interface BackupStatusFile {
  status: 'ok' | 'failed';
  artifact: string;
  sizeBytes: number;
  checkedAt: string;
}

export interface BackupHealth {
  status: 'ok' | 'failed' | 'unknown';
  artifact?: string;
  sizeBytes?: number;
  checkedAt?: string;
  ageHours?: number;
  stale: boolean;
}

// How long a backup can go without a fresh successful run before it's
// considered stale, regardless of what BACKUP_INTERVAL_HOURS is set to
// elsewhere - deliberately more than one interval so a single slow or
// briefly-failed run doesn't flap this to stale, but still well inside "an
// operator should know by now". Independently configurable since backup
// cadence and staleness tolerance are different operational questions.
const STALE_AFTER_HOURS = Number(process.env.BACKUP_STALE_AFTER_HOURS ?? 48);

async function readBackupStatus(file: string): Promise<BackupHealth> {
  try {
    const raw = await readFile(file, 'utf8');
    const parsed = JSON.parse(raw) as BackupStatusFile;
    const ageHours = (Date.now() - new Date(parsed.checkedAt).getTime()) / 3_600_000;
    return {
      status: parsed.status,
      artifact: parsed.artifact,
      sizeBytes: parsed.sizeBytes,
      checkedAt: parsed.checkedAt,
      ageHours: Math.round(ageHours * 10) / 10,
      stale: parsed.status !== 'ok' || ageHours > STALE_AFTER_HOURS,
    };
  } catch {
    // No status file yet - either the backup service has never run (e.g.
    // local dev, where it's opt-in via `docker compose --profile backup`)
    // or hasn't completed its first cycle. Reported as unknown/stale rather
    // than thrown, so callers are safe to poll from boot onward.
    return { stale: true, status: 'unknown' };
  }
}

export async function getBackupStatus(): Promise<{
  postgres: BackupHealth;
  storage: BackupHealth;
}> {
  const dir = process.env.BACKUP_STATUS_DIR ?? join(process.cwd(), '.backup-status');
  const [postgres, storage] = await Promise.all([
    readBackupStatus(join(dir, 'postgres.json')),
    readBackupStatus(join(dir, 'storage.json')),
  ]);
  return { postgres, storage };
}
