import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all active feature flags for a tenant.
   * Merges plan defaults with tenant overrides.
   */
  async getTenantFlags(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    const overrides = await this.prisma.featureFlagOverride.findMany({
      where: {
        tenantId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    // Merge plan flags and overrides
    const planFlags = (tenant.plan?.featureFlags as Record<string, any>) || {};
    const finalFlags = { ...planFlags };

    for (const override of overrides) {
      finalFlags[override.flagKey] = override.flagValue;
    }

    return finalFlags;
  }

  /**
   * Set a feature flag override for a tenant
   */
  async setOverride(
    tenantId: string,
    flagKey: string,
    flagValue: any,
    setBy: string,
    reason?: string,
    expiresAt?: Date,
  ) {
    return this.prisma.featureFlagOverride.upsert({
      where: {
        tenantId_flagKey: {
          tenantId,
          flagKey,
        },
      },
      create: {
        tenantId,
        flagKey,
        flagValue,
        setBy,
        reason,
        expiresAt,
      },
      update: {
        flagValue,
        setBy,
        reason,
        expiresAt,
      },
    });
  }

  /**
   * Remove a feature flag override
   */
  async removeOverride(tenantId: string, flagKey: string) {
    try {
      await this.prisma.featureFlagOverride.delete({
        where: {
          tenantId_flagKey: { tenantId, flagKey },
        },
      });
    } catch (e) {
      // Ignore if it doesn't exist
    }
  }
}
