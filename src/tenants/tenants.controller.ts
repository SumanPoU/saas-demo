import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { TenantMemberGuard } from '../auth/guards/tenant-member.guard';
import { TenantOwnerGuard } from '../auth/guards/tenant-owner.guard';

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
    schema: {
      example: {
        statusCode: 201,
        message: 'Workspace created successfully',
        data: {
          id: 'tenant-id',
          name: 'My Workspace',
          domain: 'my-workspace',
        },
      },
    },
  })
  create(@CurrentUser() user: any, @Body() dto: CreateTenantDto) {
    return this.tenantsService.create(user.userId || user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all workspaces the user belongs to' })
  @ApiResponse({
    status: 200,
    description: 'Workspaces retrieved successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'Workspaces retrieved successfully',
        data: [
          {
            id: 'tenant-id',
            name: 'My Workspace',
            domain: 'my-workspace',
          },
        ],
      },
    },
  })
  findAll(@CurrentUser() user: any) {
    return this.tenantsService.findAll(
      user.userId || user.id,
      user.isSuperAdmin,
    );
  }

  @Get(':id')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Get workspace details' })
  @ApiResponse({
    status: 200,
    description: 'Workspace details returned',
    schema: {
      example: {
        statusCode: 200,
        message: 'Workspace details retrieved successfully',
        data: {
          id: 'tenant-id',
          name: 'My Workspace',
          domain: 'my-workspace',
          isActive: true,
        },
      },
    },
  })
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(TenantOwnerGuard)
  @ApiOperation({ summary: 'Update workspace settings (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Workspace updated successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'Workspace updated successfully',
        data: {
          id: 'tenant-id',
          name: 'My Updated Workspace',
          domain: 'my-updated-workspace',
        },
      },
    },
  })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(TenantOwnerGuard)
  @ApiOperation({ summary: 'Delete workspace (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Workspace deleted successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'Workspace deleted successfully',
        data: null,
      },
    },
  })
  remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }
}
