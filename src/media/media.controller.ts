import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { MediaService } from './media.service';
import { TenantMemberGuard } from '../auth/guards/tenant-member.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Media & Files')
@ApiBearerAuth('JWT')
@Controller('tenants/:tenantId/media')
@UseGuards(TenantMemberGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  // NOTE: In Fastify, you would typically use @fastify/multipart interceptors
  // For standard NestJS with Express, FileInterceptor('file') from @nestjs/platform-express is used
  // Since this project uses fastify, we expect the route to be mapped using fastify multipart or a custom interceptor.
  // Assuming a custom interceptor or request handling for file uploads is set up:

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file to the tenant workspace' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        purpose: {
          type: 'string',
          example: 'ATTACHMENT',
        },
      },
    },
  })
  async uploadFile(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: any,
    @UploadedFile() file: any,
    @Param('purpose') purpose?: string,
  ) {
    if (!file) throw new BadRequestException('File is required');

    return this.mediaService.uploadFile({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      tenantId,
      uploadedById: user.userId || user.id,
      purpose: purpose || 'ATTACHMENT',
    });
  }

  @Get(':fileId/download-url')
  @ApiOperation({ summary: 'Get a temporary download link for a file' })
  async getDownloadUrl(
    @Param('tenantId') tenantId: string,
    @Param('fileId') fileId: string,
  ) {
    const url = await this.mediaService.getDownloadUrl(fileId, tenantId, 3600);
    return { url, expires_in: 3600 };
  }
}
