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

@ApiTags('Permissions')
@ApiBearerAuth('JWT')
@Controller('permissions')
@UseGuards(AuthGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @Roles('admin')
  @Permissions('permissions:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new permission' })
  @ApiResponse({ status: 201, description: 'Permission successfully created' })
  @ApiResponse({
    status: 400,
    description: 'Permission with that name already exists',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPermission(
    @Body() dto: CreatePermissionDto,
    @CurrentUser() user: any,
  ) {
    return this.permissionsService.createPermission(dto, user.id);
  }

  @Get()
  @Roles('admin')
  @Permissions('permissions:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retrieve all permissions with their groups and roles',
  })
  @ApiResponse({ status: 200, description: 'List of all permissions returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllPermissions() {
    return this.permissionsService.getAllPermissions();
  }

  @Get(':id')
  @Roles('admin')
  @Permissions('permissions:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve a single permission by ID' })
  @ApiResponse({ status: 200, description: 'Permission details returned' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPermissionById(@Param('id') id: string) {
    return this.permissionsService.getPermissionById(id);
  }

  @Patch(':id')
  @Roles('admin')
  @Permissions('permissions:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a permission name or description' })
  @ApiResponse({ status: 200, description: 'Permission successfully updated' })
  @ApiResponse({ status: 400, description: 'Permission name already taken' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updatePermission(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.permissionsService.updatePermission(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @Permissions('permissions:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
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
  async deletePermission(@Param('id') id: string) {
    await this.permissionsService.deletePermission(id);
  }

  @Post(':id/groups')
  @Roles('admin')
  @Permissions('permissions:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a permission to one or more groups' })
  @ApiResponse({
    status: 200,
    description: 'Permission successfully assigned to group(s)',
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
  ) {
    return this.permissionsService.assignPermissionToGroup(
      permissionId,
      dto.groupIds,
    );
  }

  @Delete(':id/groups')
  @Roles('admin')
  @Permissions('permissions:update')
  @HttpCode(HttpStatus.NO_CONTENT)
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
  ) {
    await this.permissionsService.removePermissionFromGroup(
      permissionId,
      dto.groupIds,
    );
  }

  /**
   *  Permission Groups
   * */

  @Post('groups')
  @Roles('admin')
  @Permissions('permissions:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new permission group' })
  @ApiResponse({
    status: 201,
    description: 'Permission group successfully created',
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
    return this.permissionsService.createPermissionGroup(dto, user.id);
  }

  @Get('groups')
  @Roles('admin')
  @Permissions('permissions:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retrieve all permission groups with their permissions',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all permission groups returned',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllPermissionGroups() {
    return this.permissionsService.getAllPermissionGroups();
  }

  @Get('groups/:id')
  @Roles('admin')
  @Permissions('permissions:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve a single permission group by ID' })
  @ApiResponse({
    status: 200,
    description: 'Permission group details returned',
  })
  @ApiResponse({ status: 404, description: 'Permission group not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPermissionGroupById(@Param('id') id: string) {
    return this.permissionsService.getPermissionGroupById(id);
  }

  @Patch('groups/:id')
  @Roles('admin')
  @Permissions('permissions:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a permission group name or description' })
  @ApiResponse({
    status: 200,
    description: 'Permission group successfully updated',
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
  ) {
    return this.permissionsService.updatePermissionGroup(id, dto);
  }

  @Delete('groups/:id')
  @Roles('admin')
  @Permissions('permissions:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a permission group' })
  @ApiResponse({
    status: 204,
    description: 'Permission group successfully deleted',
  })
  @ApiResponse({ status: 404, description: 'Permission group not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deletePermissionGroup(@Param('id') id: string) {
    await this.permissionsService.deletePermissionGroup(id);
  }
}
