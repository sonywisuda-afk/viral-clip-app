import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { SafeUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post('workspaces/:workspaceId/campaigns')
  create(
    @CurrentUser() user: SafeUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaigns.create(user.id, workspaceId, dto);
  }

  @Get('workspaces/:workspaceId/campaigns')
  list(@CurrentUser() user: SafeUser, @Param('workspaceId') workspaceId: string) {
    return this.campaigns.listByWorkspace(user.id, workspaceId);
  }

  @Get('campaigns/:id')
  get(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.campaigns.get(user.id, id);
  }

  @Patch('campaigns/:id')
  update(@CurrentUser() user: SafeUser, @Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaigns.update(user.id, id, dto);
  }

  @Post('campaigns/:id/cancel')
  cancel(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.campaigns.cancel(user.id, id);
  }
}
