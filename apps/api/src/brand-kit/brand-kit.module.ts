import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { BrandKitController } from './brand-kit.controller';
import { BrandKitService } from './brand-kit.service';

@Module({
  imports: [StorageModule],
  controllers: [BrandKitController],
  providers: [BrandKitService],
})
export class BrandKitModule {}
