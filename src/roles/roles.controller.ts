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
import { RolesService } from './roles.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignPermissionsDto,
  AssignUsersDto,
} from './dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Roles')
@ApiBearerAuth('JWT')
@Controller('roles')
@UseGuards(AuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Roles('admin')
  @Permissions('roles:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, description: 'Role successfully created' })
  @ApiResponse({
    status: 400,
    description: 'Role with that name already exists',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: any) {
    return this.rolesService.createRole(dto, user.id);
  }

  @Get()
  @Roles('admin')
  @Permissions('roles:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retrieve all roles with their permissions and users',
  })
  @ApiResponse({ status: 200, description: 'List of all roles returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllRoles() {
    return this.rolesService.getAllRoles();
  }

  @Get(':id')
  @Roles('admin')
  @Permissions('roles:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve a single role by ID' })
  @ApiResponse({ status: 200, description: 'Role details returned' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRoleById(@Param('id') id: string) {
    return this.rolesService.getRoleById(id);
  }

  @Patch(':id')
  @Roles('admin')
  @Permissions('roles:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a role name, description, or default flag' })
  @ApiResponse({ status: 200, description: 'Role successfully updated' })
  @ApiResponse({ status: 400, description: 'Role name already taken' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.updateRole(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @Permissions('roles:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a role, blocked if assigned to any user' })
  @ApiResponse({ status: 204, description: 'Role successfully deleted' })
  @ApiResponse({
    status: 400,
    description: 'Role is currently assigned to one or more users',
  })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteRole(@Param('id') id: string) {
    await this.rolesService.deleteRole(id);
  }

  @Post(':id/permissions')
  @Roles('admin')
  @Permissions('roles:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign one or more permissions to a role' })
  @ApiResponse({
    status: 200,
    description: 'Permissions successfully assigned to role',
  })
  @ApiResponse({
    status: 400,
    description: 'One or more permission IDs do not exist',
  })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async assignPermissionsToRole(
    @Param('id') roleId: string,
    @Body() dto: AssignPermissionsDto,
    @CurrentUser() user: any,
  ) {
    return this.rolesService.assignPermissionsToRole(
      roleId,
      dto.permissionIds,
      user.id,
    );
  }

  @Delete(':id/permissions')
  @Roles('admin')
  @Permissions('roles:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove one or more permissions from a role' })
  @ApiResponse({
    status: 204,
    description: 'Permissions successfully removed from role',
  })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removePermissionsFromRole(
    @Param('id') roleId: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    await this.rolesService.removePermissionsFromRole(
      roleId,
      dto.permissionIds,
    );
  }

  @Post(':id/users')
  @Roles('admin')
  @Permissions('roles:assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a role to one or more users' })
  @ApiResponse({
    status: 200,
    description: 'Role successfully assigned to user(s)',
  })
  @ApiResponse({
    status: 400,
    description: 'One or more user IDs do not exist',
  })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async assignRoleToUsers(
    @Param('id') roleId: string,
    @Body() dto: AssignUsersDto,
  ) {
    return this.rolesService.assignRoleToUsers(roleId, dto.userIds);
  }

  @Delete(':id/users')
  @Roles('admin')
  @Permissions('roles:assign')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a role from one or more users' })
  @ApiResponse({
    status: 204,
    description: 'Role successfully removed from user(s)',
  })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeRoleFromUsers(
    @Param('id') roleId: string,
    @Body() dto: AssignUsersDto,
  ) {
    await this.rolesService.removeRoleFromUsers(roleId, dto.userIds);
  }

  @Get('user/:userId/roles')
  @Roles('admin')
  @Permissions('roles:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve all roles assigned to a specific user' })
  @ApiResponse({ status: 200, description: "User's roles returned" })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserRoles(@Param('userId') userId: string) {
    return this.rolesService.getUserRoles(userId);
  }
}
