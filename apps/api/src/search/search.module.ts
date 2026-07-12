import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

// No `imports` needed - PrismaService is @Global() (prisma.module.ts), same
// as every other module that only needs DB access.
@Module({
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
