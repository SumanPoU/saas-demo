import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ResponseMessage } from '../common/response';
import { CreateGlobalConfigDto, UpdateGlobalConfigDto } from './dto';
import { GlobalConfigService } from './global-config.service';

@ApiTags('Global Config')
@ApiBearerAuth('JWT')
@Controller('global-config')
export class GlobalConfigController {
  constructor(private readonly globalConfigService: GlobalConfigService) {}

  @Get()
  @Roles('Admin')
  @Permissions('settings:manage')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Global configurations retrieved successfully')
  @ApiQuery({ name: 'category', required: false, example: 'system' })
  @ApiOperation({
    summary: 'Retrieve global configuration records',
    description:
      'Returns global_config records. Optional category filters include security, auth, system, and mail.',
  })
  @ApiResponse({ status: 200, description: 'Global configurations returned' })
  async getConfigs(@Query('category') category?: string) {
    return this.globalConfigService.getConfigs(category);
  }

  @Post()
  @Roles('Admin')
  @Permissions('settings:manage')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Global configuration created successfully')
  @ApiOperation({
    summary: 'Create a global configuration record',
    description:
      'Creates a global_config record by key. Seeded runtime keys are bcrypt, throttle, jwt, app, and mail.',
  })
  @ApiBody({
    schema: {
      example: {
        key: 'app',
        category: 'system',
        value: {
          name: 'SaaS Enterprise Demo',
          frontendUrl: 'http://localhost:3000',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Global configuration created' })
  @ApiResponse({ status: 409, description: 'Global configuration exists' })
  async createConfig(
    @Body() dto: CreateGlobalConfigDto,
    @CurrentUser() user: any,
  ) {
    return this.globalConfigService.createConfig({
      ...dto,
      updatedBy: user.id,
    });
  }

  @Get(':key')
  @Roles('Admin')
  @Permissions('settings:manage')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Global configuration retrieved successfully')
  @ApiOperation({
    summary: 'Retrieve a global configuration by key',
    description:
      'Use keys such as bcrypt, throttle, jwt, app, mail, auth_settings, or system_branding.',
  })
  @ApiParam({
    name: 'key',
    required: true,
    enum: [
      'bcrypt',
      'throttle',
      'jwt',
      'app',
      'mail',
      'auth_settings',
      'system_branding',
    ],
  })
  @ApiResponse({ status: 200, description: 'Global configuration returned' })
  @ApiResponse({ status: 404, description: 'Global configuration not found' })
  async getConfigByKey(@Param('key') key: string) {
    return this.globalConfigService.getConfigByKey(key);
  }

  @Patch(':key')
  @Roles('Admin')
  @Permissions('settings:manage')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Global configuration updated successfully')
  @ApiOperation({
    summary: 'Update a global configuration by key',
    description:
      'Updates the JSON value for the selected key. Runtime config changes are read dynamically by services through RuntimeConfigService; throttler settings may require an application restart depending on NestJS throttler initialization.',
  })
  @ApiParam({
    name: 'key',
    required: true,
    enum: ['bcrypt', 'throttle', 'jwt', 'app', 'mail'],
  })
  @ApiBody({
    schema: {
      examples: {
        bcrypt: {
          summary: 'bcrypt',
          value: {
            category: 'security',
            value: { saltRounds: 10 },
          },
        },
        throttle: {
          summary: 'throttle',
          value: {
            category: 'security',
            value: {
              shortTtl: 1000,
              shortLimit: 10,
              longTtl: 60000,
              longLimit: 100,
            },
          },
        },
        jwt: {
          summary: 'jwt',
          value: {
            category: 'auth',
            value: {
              accessTokenExpiry: '15m',
              refreshTokenExpiry: '7d',
              mfaPendingTokenExpiry: '5m',
            },
          },
        },
        app: {
          summary: 'app',
          value: {
            category: 'system',
            value: {
              name: 'SaaS Enterprise Demo',
              frontendUrl: 'http://localhost:3000',
            },
          },
        },
        mail: {
          summary: 'mail',
          value: {
            category: 'mail',
            value: {
              from: '"SaaS Demo" <noreply@demo.com>',
              host: 'localhost',
              port: 2525,
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Global configuration updated' })
  @ApiResponse({ status: 404, description: 'Global configuration not found' })
  async updateConfigByKey(
    @Param('key') key: string,
    @Body() dto: UpdateGlobalConfigDto,
    @CurrentUser() user: any,
  ) {
    return this.globalConfigService.updateConfigByKey(key, {
      ...dto,
      updatedBy: user.id,
    });
  }
}
