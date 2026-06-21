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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiConsumes,
} from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/pagination';
import { ResponseMessage } from '../common/response';
import { CreateUserDto, UpdateUserDto, UpdateProfileDto } from './dto';
import { UsersService } from './users.service';
import { FastifyFileInterceptor } from '../common/interceptors/fastify-file.interceptor';

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
    schema: {
      example: {
        statusCode: 201,
        message: 'User created successfully',
        data: {
          id: 'user-id',
          email: 'newuser@example.com',
          username: 'newuser',
          isActive: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid role IDs or validation failed',
  })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async createUser(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.usersService.createUser(dto, user);
  }

  @Get()
  @Roles('Admin')
  @Permissions('users:read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Users retrieved successfully')
  @ApiOperation({ summary: 'Retrieve users with pagination and search' })
  @ApiResponse({
    status: 200,
    description: 'Users returned successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'Users retrieved successfully',
        data: {
          items: [
            {
              id: 'user-1',
              email: 'user1@example.com',
              username: 'user1',
              isActive: true,
            },
            {
              id: 'user-2',
              email: 'user2@example.com',
              username: 'user2',
              isActive: true,
            },
          ],
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      },
    },
  })
  async getUsers(@Query() query: PaginationQueryDto, @CurrentUser() user: any) {
    return this.usersService.getUsers(query, user);
  }

  @Patch('me/profile')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Profile updated successfully')
  @ApiOperation({
    summary:
      'Update your own profile, including avatar upload via multipart/form-data',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FastifyFileInterceptor)
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
  })
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: any,
    @UploadedFile() file?: any,
  ) {
    return this.usersService.updateProfile(user.userId || user.id, dto, file);
  }

  @Get(':id')
  @Roles('Admin')
  @Permissions('users:read')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User retrieved successfully')
  @ApiOperation({ summary: 'Retrieve a single user by ID' })
  @ApiResponse({
    status: 200,
    description: 'User returned successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'User retrieved successfully',
        data: {
          id: 'user-id',
          email: 'user@example.com',
          username: 'user',
          isActive: true,
          roles: [],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.getUserById(id, user);
  }

  @Patch(':id')
  @Roles('Admin')
  @Permissions('users:update')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User updated successfully')
  @ApiOperation({ summary: 'Update safe user profile and status fields' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'User updated successfully',
        data: {
          id: 'user-id',
          email: 'user@example.com',
          username: 'user',
          firstName: 'John',
          lastName: 'Doe',
          isActive: true,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.updateUser(id, dto, user);
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
    schema: {
      example: {
        statusCode: 200,
        message: 'Temporary password generated and emailed successfully',
        data: {
          id: 'user-id',
          email: 'user@example.com',
          username: 'user',
          isActive: true,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetUserPassword(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.resetUserPassword(id, user);
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
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'User deleted successfully',
        data: {
          id: 'user-id',
          email: 'user@example.com',
          username: 'user',
          isActive: false,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Cannot delete your own account' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.deleteUser(id, user);
  }
}
