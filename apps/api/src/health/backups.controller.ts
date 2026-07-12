import { Controller, Get } from '@nestjs/common';
import { getBackupStatus } from './backup-status';

@Controller('backups')
export class BackupsController {
  // Unauthenticated, same posture as /health - reports only backup
  // timestamps/sizes, never video/user data, and an operator or uptime
  // check needs to reach it without a session.
  @Get()
  async check() {
    return getBackupStatus();
  }
}
