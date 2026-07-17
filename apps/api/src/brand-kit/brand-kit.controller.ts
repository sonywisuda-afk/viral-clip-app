import {
  Body,
  Controller,
  Get,
  NotFoundException,
  ParseFilePipeBuilder,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { getObjectStream } from '@speedora/storage';
import type { Response } from 'express';
import type { SafeUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from '../storage/storage.service';
import { BrandKitService } from './brand-kit.service';
import { UpdateBrandKitDto } from './dto/update-brand-kit.dto';

// A logo, not a video - same MAX_UPLOAD_SIZE_BYTES-style constant as
// VideosController, just a much smaller cap.
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// getObjectStream returns just a Readable, no stored Content-Type metadata
// (same reason VideosController/ClipsController derive thumbnailContentType
// from the key's own extension rather than trusting S3 metadata) - a brand
// logo can be any common image type the user uploaded, not just webp/jpeg,
// so this covers a wider set than thumbnailContentType does.
function logoContentType(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

// Sprint 03d (Export Center roadmap) - the minimal Brand Kit Brand Report
// needs. Standalone, not bolted onto AuthModule (purely an auth-flow
// module) - this is its own distinct resource.
@Controller('brand-kit')
@UseGuards(JwtAuthGuard)
export class BrandKitController {
  constructor(
    private readonly brandKit: BrandKitService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  get(@CurrentUser() user: SafeUser) {
    return this.brandKit.get(user.id);
  }

  @Put()
  update(@CurrentUser() user: SafeUser, @Body() dto: UpdateBrandKitDto) {
    return this.brandKit.update(user.id, dto);
  }

  @Post('logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_LOGO_SIZE_BYTES } }))
  async uploadLogo(
    @CurrentUser() user: SafeUser,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\// })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    const logoKey = await this.storage.saveBrandLogo(file);
    return this.brandKit.saveLogo(user.id, logoKey);
  }

  @Get('logo')
  async downloadLogo(@CurrentUser() user: SafeUser, @Res() res: Response) {
    const { logoKey } = await this.brandKit.findLogoKeyOrThrow(user.id);
    if (!logoKey) {
      throw new NotFoundException('No brand logo has been uploaded yet');
    }

    const stream = await getObjectStream(logoKey);
    res.setHeader('Content-Type', logoContentType(logoKey));
    res.setHeader('Cache-Control', 'private, max-age=86400');
    stream.pipe(res);
  }
}
