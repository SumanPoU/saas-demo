import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/pagination';
import { ResponseMessage } from '../common/response';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth('JWT')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('Admin')
  @Permissions('audit:read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Audit logs retrieved successfully')
  @ApiOperation({ summary: 'Retrieve audit logs with pagination and search' })
  @ApiResponse({ status: 200, description: 'Audit logs returned successfully' })
  async getAuditLogs(@Query() query: PaginationQueryDto) {
    return this.auditService.getAuditLogs(query);
  }
}
