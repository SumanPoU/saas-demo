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
import { ResponseMessage } from '../common/response';

@ApiTags('Roles')
@ApiBearerAuth('JWT')
@Controller('roles')
@UseGuards(AuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Roles('Admin')
  @Permissions('roles:create')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Role successfully created')
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({
    status: 201,
    description: 'Role successfully created',
    schema: {
      example: {
        statusCode: 201,
        message: 'Role successfully created',
        data: {
          id: 'role-id',
          name: 'Manager',
          description: 'Team Manager',
          isDefault: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Role with that name already exists',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: any) {
    return this.rolesService.createRole(dto, user);
  }

  @Get()
  @Roles('Admin')
  @Permissions('roles:read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Roles retrieved successfully')
  @ApiOperation({
    summary: 'Retrieve all roles with their permissions and users',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all roles returned',
    schema: {
      example: {
        statusCode: 200,
        message: 'Roles retrieved successfully',
        data: [
          {
            id: 'role-id',
            name: 'Admin',
            description: 'Administrator role',
            isDefault: false,
            permissions: ['users:read', 'users:write'],
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllRoles(@CurrentUser() user: any) {
    return this.rolesService.getAllRoles(user);
  }

  @Get('user/:userId/roles')
  @Roles('Admin')
  @Permissions('roles:read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User roles retrieved successfully')
  @ApiOperation({ summary: 'Retrieve all roles assigned to a specific user' })
  @ApiResponse({
    status: 200,
    description: "User's roles returned",
    schema: {
      example: {
        statusCode: 200,
        message: 'User roles retrieved successfully',
        data: [
          {
            id: 'role-id',
            name: 'User',
            description: 'Standard User',
            permissions: ['dashboard:read'],
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserRoles(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.rolesService.getUserRoles(userId, user);
  }

  @Get(':id')
  @Roles('Admin')
  @Permissions('roles:read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Role details retrieved successfully')
  @ApiOperation({ summary: 'Retrieve a single role by ID' })
  @ApiResponse({
    status: 200,
    description: 'Role details returned',
    schema: {
      example: {
        statusCode: 200,
        message: 'Role details retrieved successfully',
        data: {
          id: 'role-id',
          name: 'Admin',
          description: 'Administrator role',
          isDefault: false,
          permissions: ['users:read', 'users:write'],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRoleById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.rolesService.getRoleById(id, user);
  }

  @Patch(':id')
  @Roles('Admin')
  @Permissions('roles:update')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Role successfully updated')
  @ApiOperation({ summary: 'Update a role name, description, or default flag' })
  @ApiResponse({
    status: 200,
    description: 'Role successfully updated',
    schema: {
      example: {
        statusCode: 200,
        message: 'Role successfully updated',
        data: {
          id: 'role-id',
          name: 'Super Admin',
          description: 'Super Administrator',
          isDefault: false,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Role name already taken' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: any,
  ) {
    return this.rolesService.updateRole(id, dto, user);
  }

  @Delete(':id')
  @Roles('Admin')
  @Permissions('roles:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Role successfully deleted')
  @ApiOperation({ summary: 'Delete a role, blocked if assigned to any user' })
  @ApiResponse({ status: 204, description: 'Role successfully deleted' })
  @ApiResponse({
    status: 400,
    description: 'Role is currently assigned to one or more users',
  })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteRole(@Param('id') id: string, @CurrentUser() user: any) {
    await this.rolesService.deleteRole(id, user);
  }

  @Post(':id/permissions')
  @Roles('Admin')
  @Permissions('roles:update')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Permissions successfully assigned to role')
  @ApiOperation({ summary: 'Assign one or more permissions to a role' })
  @ApiResponse({
    status: 200,
    description: 'Permissions successfully assigned to role',
    schema: {
      example: {
        statusCode: 200,
        message: 'Permissions successfully assigned to role',
        data: { count: 2 },
      },
    },
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
      user,
      user.id,
    );
  }

  @Delete(':id/permissions')
  @Roles('Admin')
  @Permissions('roles:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Permissions successfully removed from role')
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
    @CurrentUser() user: any,
  ) {
    await this.rolesService.removePermissionsFromRole(
      roleId,
      dto.permissionIds,
      user,
    );
  }

  @Post(':id/users')
  @Roles('Admin')
  @Permissions('roles:assign')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Role successfully assigned to user(s)')
  @ApiOperation({ summary: 'Assign a role to one or more users' })
  @ApiResponse({
    status: 200,
    description: 'Role successfully assigned to user(s)',
    schema: {
      example: {
        statusCode: 200,
        message: 'Role successfully assigned to user(s)',
        data: { count: 1 },
      },
    },
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
    @CurrentUser() user: any,
  ) {
    return this.rolesService.assignRoleToUsers(roleId, dto.userIds, user);
  }

  @Delete(':id/users')
  @Roles('Admin')
  @Permissions('roles:assign')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Role successfully removed from user(s)')
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
    @CurrentUser() user: any,
  ) {
    await this.rolesService.removeRoleFromUsers(roleId, dto.userIds, user);
  }
}
