import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { RestoreTenantDto } from './dto/restore-tenant.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { TenantMemberGuard } from '../auth/guards/tenant-member.guard';
import { TenantOwnerGuard } from '../auth/guards/tenant-owner.guard';
import { ResponseMessage } from '../common/response';

@ApiTags('Tenants')
@ApiBearerAuth('JWT')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({
    status: 201,
    description: 'Workspace created successfully',
  })
  create(
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: CreateTenantDto,
  ) {
    return this.tenantsService.create(user.userId || user.id!, dto);
  }

  @Public()
  @Post('restore')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Workspace restored successfully')
  @ApiOperation({
    summary:
      'Restore a soft-deleted workspace using the emailed restoration token',
  })
  @ApiResponse({ status: 200, description: 'Workspace restored successfully' })
  @ApiResponse({
    status: 404,
    description: 'Invalid or expired restoration token',
  })
  restore(@Body() dto: RestoreTenantDto) {
    return this.tenantsService.restore(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all workspaces the user belongs to' })
  @ApiResponse({
    status: 200,
    description: 'Workspaces retrieved successfully',
  })
  findAll(
    @CurrentUser()
    user: { id?: string; userId?: string; isSuperAdmin?: boolean },
  ) {
    return this.tenantsService.findAll(
      user.userId || user.id!,
      Boolean(user.isSuperAdmin),
    );
  }

  @Get(':id')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Get workspace details' })
  @ApiResponse({ status: 200, description: 'Workspace details returned' })
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(TenantOwnerGuard)
  @ApiOperation({ summary: 'Update workspace settings (Owner only)' })
  @ApiResponse({ status: 200, description: 'Workspace updated successfully' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(TenantOwnerGuard)
  @ApiOperation({
    summary: 'Soft-delete workspace and email a restoration token (Owner only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Workspace soft-deleted; restoration token emailed to owner',
  })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id?: string; userId?: string },
  ) {
    return this.tenantsService.remove(id, user.userId || user.id!);
  }
}
