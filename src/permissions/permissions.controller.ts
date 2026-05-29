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

@Controller('permissions')
@UseGuards(AuthGuard)
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Post()
  @Roles('admin')
  @Permissions('permissions:create')
  async createPermission(
    @Body() dto: CreatePermissionDto,
    @CurrentUser() user: any,
  ) {
    return this.permissionsService.createPermission(dto, user.id);
  }

  @Get()
  @Roles('admin')
  @Permissions('permissions:read')
  async getAllPermissions() {
    return this.permissionsService.getAllPermissions();
  }

  @Get(':id')
  @Roles('admin')
  @Permissions('permissions:read')
  async getPermissionById(@Param('id') id: string) {
    return this.permissionsService.getPermissionById(id);
  }

  @Patch(':id')
  @Roles('admin')
  @Permissions('permissions:update')
  async updatePermission(@Param('id') id: string, @Body() dto: UpdatePermissionDto) {
    return this.permissionsService.updatePermission(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  @Permissions('permissions:delete')
  async deletePermission(@Param('id') id: string) {
    await this.permissionsService.deletePermission(id);
  }

  @Post(':id/groups')
  @Roles('admin')
  @Permissions('permissions:update')
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  @Permissions('permissions:update')
  async removePermissionFromGroup(
    @Param('id') permissionId: string,
    @Body() dto: AssignGroupsDto,
  ) {
    await this.permissionsService.removePermissionFromGroup(
      permissionId,
      dto.groupIds,
    );
  }

  @Post('groups')
  @Roles('admin')
  @Permissions('permissions:create')
  async createPermissionGroup(
    @Body() dto: CreatePermissionGroupDto,
    @CurrentUser() user: any,
  ) {
    return this.permissionsService.createPermissionGroup(dto, user.id);
  }

  @Get('groups')
  @Roles('admin')
  @Permissions('permissions:read')
  async getAllPermissionGroups() {
    return this.permissionsService.getAllPermissionGroups();
  }

  @Get('groups/:id')
  @Roles('admin')
  @Permissions('permissions:read')
  async getPermissionGroupById(@Param('id') id: string) {
    return this.permissionsService.getPermissionGroupById(id);
  }

  @Patch('groups/:id')
  @Roles('admin')
  @Permissions('permissions:update')
  async updatePermissionGroup(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionGroupDto,
  ) {
    return this.permissionsService.updatePermissionGroup(id, dto);
  }

  @Delete('groups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  @Permissions('permissions:delete')
  async deletePermissionGroup(@Param('id') id: string) {
    await this.permissionsService.deletePermissionGroup(id);
  }
}
