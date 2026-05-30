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
  @Roles('Admin')
  @Permissions('permissions:read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Permissions retrieved successfully')
  @ApiOperation({
    summary: 'Retrieve all permissions with their groups and roles (Paginated)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of permissions returned',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllPermissions(@Query() query: PaginationQueryDto) {
    return this.permissionsService.getAllPermissions(query);
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
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllPermissionGroups() {
    return this.permissionsService.getAllPermissionGroups();
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
  })
  @ApiResponse({ status: 404, description: 'Permission group not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPermissionGroupById(@Param('id') id: string) {
    return this.permissionsService.getPermissionGroupById(id);
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
  async deletePermissionGroup(@Param('id') id: string) {
    await this.permissionsService.deletePermissionGroup(id);
  }

  @Get(':id')
  @Roles('Admin')
  @Permissions('permissions:read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Permission details retrieved successfully')
  @ApiOperation({ summary: 'Retrieve a single permission by ID' })
  @ApiResponse({ status: 200, description: 'Permission details returned' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPermissionById(@Param('id') id: string) {
    return this.permissionsService.getPermissionById(id);
  }

  @Patch(':id')
  @Roles('Admin')
  @Permissions('permissions:update')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Permission successfully updated')
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
  async deletePermission(@Param('id') id: string) {
    await this.permissionsService.deletePermission(id);
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
  ) {
    await this.permissionsService.removePermissionFromGroup(
      permissionId,
      dto.groupIds,
    );
  }
}
