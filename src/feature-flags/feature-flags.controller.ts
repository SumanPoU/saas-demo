import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FeatureFlagsService } from './feature-flags.service';
import { TenantMemberGuard } from '../auth/guards/tenant-member.guard';
import { TenantOwnerGuard } from '../auth/guards/tenant-owner.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Feature Flags')
@ApiBearerAuth('JWT')
@Controller('tenants/:tenantId/feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Get active feature flags for the tenant' })
  @ApiResponse({
    status: 200,
    description: 'Feature flags returned successfully',
  })
  getFlags(@Param('tenantId') tenantId: string) {
    return this.featureFlagsService.getTenantFlags(tenantId);
  }

  @Post(':flagKey')
  @UseGuards(TenantOwnerGuard)
  @ApiOperation({ summary: 'Set a feature flag override (Owner only)' })
  @ApiResponse({
    status: 201,
    description: 'Feature flag override set',
  })
  setOverride(
    @Param('tenantId') tenantId: string,
    @Param('flagKey') flagKey: string,
    @Body('value') value: any,
    @Body('reason') reason: string,
    @Body('expiresAt') expiresAt: string,
    @CurrentUser() user: any,
  ) {
    return this.featureFlagsService.setOverride(
      tenantId,
      flagKey,
      value,
      user.userId || user.id,
      reason,
      expiresAt ? new Date(expiresAt) : undefined,
    );
  }

  @Delete(':flagKey')
  @UseGuards(TenantOwnerGuard)
  @ApiOperation({ summary: 'Remove a feature flag override (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Feature flag override removed',
  })
  async removeOverride(
    @Param('tenantId') tenantId: string,
    @Param('flagKey') flagKey: string,
  ) {
    await this.featureFlagsService.removeOverride(tenantId, flagKey);
    return { message: 'Override removed' };
  }
}
