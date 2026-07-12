import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { SafeUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePendingInviteDto } from './dto/create-pending-invite.dto';
import { TeamService } from './team.service';

@Controller('team')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post('invites')
  createInvite(@CurrentUser() user: SafeUser, @Body() dto: CreatePendingInviteDto) {
    return this.teamService.createInvite(user.id, user.email, dto);
  }

  @Get('invites')
  listInvites(@CurrentUser() user: SafeUser) {
    return this.teamService.listInvites(user.id);
  }
}
