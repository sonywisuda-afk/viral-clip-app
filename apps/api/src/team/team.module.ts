import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

// PrismaService needs no import - it's @Global() (prisma.module.ts).
@Module({
  imports: [MailModule],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
