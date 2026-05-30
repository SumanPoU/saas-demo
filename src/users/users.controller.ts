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
} from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/pagination';
import { ResponseMessage } from '../common/response';
import { CreateUserDto, UpdateUserDto } from './dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('Admin')
  @Permissions('users:create')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('User created successfully')
  @ApiBody({ type: CreateUserDto })
  @ApiOperation({
    summary: 'Create a user with a generated temporary password sent by email',
    description:
      'The request body does not accept a password. The API generates a temporary password, emails it to the user, marks mustChangePassword as true, and returns only safe user fields.',
  })
  @ApiResponse({
    status: 201,
    description:
      'User created successfully. Temporary password is sent by email and is not returned in the response.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid role IDs or validation failed',
  })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async createUser(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.usersService.createUser(dto, user.id);
  }

  @Get()
  @Roles('Admin')
  @Permissions('users:read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Users retrieved successfully')
  @ApiOperation({ summary: 'Retrieve users with pagination and search' })
  @ApiResponse({ status: 200, description: 'Users returned successfully' })
  async getUsers(@Query() query: PaginationQueryDto) {
    return this.usersService.getUsers(query);
  }

  @Get(':id')
  @Roles('Admin')
  @Permissions('users:read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User retrieved successfully')
  @ApiOperation({ summary: 'Retrieve a single user by ID' })
  @ApiResponse({ status: 200, description: 'User returned successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Patch(':id')
  @Roles('Admin')
  @Permissions('users:update')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User updated successfully')
  @ApiOperation({ summary: 'Update safe user profile and status fields' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto);
  }

  @Post(':id/reset-password')
  @Roles('Admin')
  @Permissions('users:update')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Temporary password generated and emailed successfully')
  @ApiOperation({
    summary:
      'Generate a temporary password for a user and require password change on next login',
    description:
      'Admin reset flow. Generates a new temporary password, emails it to the selected user, sets mustChangePassword to true, and revokes active sessions and refresh tokens.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Temporary password emailed. The generated password is not returned in the response.',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetUserPassword(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.resetUserPassword(id, user.id);
  }

  @Delete(':id')
  @Roles('Admin')
  @Permissions('users:delete')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User deleted successfully')
  @ApiOperation({
    summary:
      'Soft-delete a user by deactivating the account and revoking sessions',
    description:
      'This endpoint deactivates the account instead of removing the database row. A user cannot delete their own account.',
  })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete your own account' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.deleteUser(id, user.id);
  }
}
