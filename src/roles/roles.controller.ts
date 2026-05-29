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
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto, AssignUsersDto } from './dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('roles')
@UseGuards(AuthGuard)
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Post()
  @Roles('admin')
  @Permissions('roles:create')
  async createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: any) {
    return this.rolesService.createRole(dto, user.id);
  }

  @Get()
  @Roles('admin')
  @Permissions('roles:read')
  async getAllRoles() {
    return this.rolesService.getAllRoles();
  }

  @Get(':id')
  @Roles('admin')
  @Permissions('roles:read')
  async getRoleById(@Param('id') id: string) {
    return this.rolesService.getRoleById(id);
  }

  @Patch(':id')
  @Roles('admin')
  @Permissions('roles:update')
  async updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.updateRole(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  @Permissions('roles:delete')
  async deleteRole(@Param('id') id: string) {
    await this.rolesService.deleteRole(id);
  }

  @Post(':id/permissions')
  @Roles('admin')
  @Permissions('roles:update')
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  @Permissions('roles:update')
  async removePermissionsFromRole(
    @Param('id') roleId: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    await this.rolesService.removePermissionsFromRole(roleId, dto.permissionIds);
  }

  @Post(':id/users')
  @Roles('admin')
  @Permissions('roles:assign')
  async assignRoleToUsers(
    @Param('id') roleId: string,
    @Body() dto: AssignUsersDto,
  ) {
    return this.rolesService.assignRoleToUsers(roleId, dto.userIds);
  }

  @Delete(':id/users')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  @Permissions('roles:assign')
  async removeRoleFromUsers(
    @Param('id') roleId: string,
    @Body() dto: AssignUsersDto,
  ) {
    await this.rolesService.removeRoleFromUsers(roleId, dto.userIds);
  }

  @Get('user/:userId/roles')
  @Roles('admin')
  @Permissions('roles:read')
  async getUserRoles(@Param('userId') userId: string) {
    return this.rolesService.getUserRoles(userId);
  }
}
