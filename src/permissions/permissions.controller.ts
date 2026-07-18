import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
  CreatePermissionGroupDto,
  UpdatePermissionGroupDto,
  AssignGroupsDto,
} from './dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PaginationQueryDto } from '../common/pagination';
import { ResponseMessage } from '../common/response';

@ApiTags('Permissions')
@ApiBearerAuth('JWT')
@Controller('permissions')
@UseGuards(AuthGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @Roles('Admin')
  @Permissions('permissions:create')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Permission successfully created')
  @ApiOperation({ summary: 'Create a new individual permission' })
  @ApiResponse({
    status: 201,
    description: 'Permission successfully created',
    schema: {
      example: {
        statusCode: 201,
        message: 'Permission successfully created',
        data: {
          id: 'perm-id',
          action: 'users:read',
          description: 'Read users',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Permission with that name already exists',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPermission(
    @Body() dto: CreatePermissionDto,
    @CurrentUser() user: any,
  ) {
    return this.permissionsService.createPermission(dto, user);
  }

  @Get()
  @Roles('Admin')
  @Permissions('permissions:read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Permissions retrieved successfully')
  @ApiOperation({
    summary: 'Retrieve all permissions with pagination and search',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all permissions returned',
    schema: {
      example: {
        statusCode: 200,
        message: 'Permissions retrieved successfully',
        data: {
          items: [
            { id: 'perm-id', action: 'users:read', description: 'Read users' },
          ],
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllPermissions(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.permissionsService.getAllPermissions(query, user);
  }

  /**
   *  Permission Groups
   * */

  @Post('groups')
  @Roles('Admin')
  @Permissions('permissions:create')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Permission group successfully created')
  @ApiOperation({ summary: 'Create a new permission group' })
  @ApiResponse({
    status: 201,
    description: 'Permission group successfully created',
    schema: {
      example: {
        statusCode: 201,
        message: 'Permission group successfully created',
        data: {
          id: 'group-id',
          name: 'User Management',
          description: 'Manage users',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Permission group with that name already exists',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPermissionGroup(
    @Body() dto: CreatePermissionGroupDto,
    @CurrentUser() user: any,
  ) {
    return this.permissionsService.createPermissionGroup(dto, user);
  }

  @Get('groups')
  @Roles('Admin')
  @Permissions('permissions:read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Permission groups retrieved successfully')
  @ApiOperation({
    summary: 'Retrieve all permission groups with their permissions',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all permission groups returned',
    schema: {
      example: {
        statusCode: 200,
        message: 'Permission groups retrieved successfully',
        data: [
          {
            id: 'group-id',
            name: 'User Management',
            description: 'Manage users',
            permissions: [
              {
                id: 'perm-id',
                action: 'users:read',
                description: 'Read users',
              },
            ],
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllPermissionGroups(@CurrentUser() user: any) {
    return this.permissionsService.getAllPermissionGroups(user);
  }

  @Get('groups/:id')
  @Roles('Admin')
  @Permissions('permissions:read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Permission group details retrieved successfully')
  @ApiOperation({ summary: 'Retrieve a single permission group by ID' })
  @ApiResponse({
    status: 200,
    description: 'Permission group details returned',
    schema: {
      example: {
        statusCode: 200,
        message: 'Permission group details retrieved successfully',
        data: {
          id: 'group-id',
          name: 'User Management',
          description: 'Manage users',
          permissions: [
            { id: 'perm-id', action: 'users:read', description: 'Read users' },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Permission group not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPermissionGroupById(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.permissionsService.getPermissionGroupById(id, user);
  }

  @Patch('groups/:id')
  @Roles('Admin')
  @Permissions('permissions:update')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Permission group successfully updated')
  @ApiOperation({ summary: 'Update a permission group name or description' })
  @ApiResponse({
    status: 200,
    description: 'Permission group successfully updated',
    schema: {
      example: {
        statusCode: 200,
        message: 'Permission group successfully updated',
        data: {
          id: 'group-id',
          name: 'User Management',
          description: 'Manage users updated',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Permission group name already taken',
  })
  @ApiResponse({ status: 404, description: 'Permission group not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updatePermissionGroup(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionGroupDto,
    @CurrentUser() user: any,
  ) {
    return this.permissionsService.updatePermissionGroup(id, dto, user);
  }

  @Delete('groups/:id')
  @Roles('Admin')
  @Permissions('permissions:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Permission group successfully deleted')
  @ApiOperation({ summary: 'Delete a permission group' })
  @ApiResponse({
    status: 204,
    description: 'Permission group successfully deleted',
  })
  @ApiResponse({ status: 404, description: 'Permission group not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deletePermissionGroup(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    await this.permissionsService.deletePermissionGroup(id, user);
  }

  @Get(':id')
  @Roles('Admin')
  @Permissions('permissions:read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Permission details retrieved successfully')
  @ApiOperation({ summary: 'Retrieve a single permission by ID' })
  @ApiResponse({
    status: 200,
    description: 'Permission details returned',
    schema: {
      example: {
        statusCode: 200,
        message: 'Permission details retrieved successfully',
        data: {
          id: 'perm-id',
          action: 'users:read',
          description: 'Read users',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPermissionById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.permissionsService.getPermissionById(id, user);
  }

  @Patch(':id')
  @Roles('Admin')
  @Permissions('permissions:update')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Permission successfully updated')
  @ApiOperation({ summary: 'Update a permission name or description' })
  @ApiResponse({
    status: 200,
    description: 'Permission successfully updated',
    schema: {
      example: {
        statusCode: 200,
        message: 'Permission successfully updated',
        data: {
          id: 'perm-id',
          action: 'users:read',
          description: 'Read users updated',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Permission name already taken' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updatePermission(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDto,
    @CurrentUser() user: any,
  ) {
    return this.permissionsService.updatePermission(id, dto, user);
  }

  @Delete(':id')
  @Roles('Admin')
  @Permissions('permissions:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Permission successfully deleted')
  @ApiOperation({
    summary: 'Delete a permission, blocked if assigned to any role',
  })
  @ApiResponse({ status: 204, description: 'Permission successfully deleted' })
  @ApiResponse({
    status: 400,
    description: 'Permission is currently assigned to one or more roles',
  })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deletePermission(@Param('id') id: string, @CurrentUser() user: any) {
    await this.permissionsService.deletePermission(id, user);
  }

  @Post(':id/groups')
  @Roles('Admin')
  @Permissions('permissions:update')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Permission successfully assigned to group(s)')
  @ApiOperation({ summary: 'Assign a permission to one or more groups' })
  @ApiResponse({
    status: 200,
    description: 'Permission successfully assigned to group(s)',
    schema: {
      example: {
        statusCode: 200,
        message: 'Permission successfully assigned to group(s)',
        data: { count: 1 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'One or more group IDs do not exist',
  })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async assignPermissionToGroup(
    @Param('id') permissionId: string,
    @Body() dto: AssignGroupsDto,
    @CurrentUser() user: any,
  ) {
    return this.permissionsService.assignPermissionToGroup(
      permissionId,
      dto.groupIds,
      user,
    );
  }

  @Delete(':id/groups')
  @Roles('Admin')
  @Permissions('permissions:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Permission successfully removed from group(s)')
  @ApiOperation({ summary: 'Remove a permission from one or more groups' })
  @ApiResponse({
    status: 204,
    description: 'Permission successfully removed from group(s)',
  })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removePermissionFromGroup(
    @Param('id') permissionId: string,
    @Body() dto: AssignGroupsDto,
    @CurrentUser() user: any,
  ) {
    await this.permissionsService.removePermissionFromGroup(
      permissionId,
      dto.groupIds,
      user,
    );
  }
}
