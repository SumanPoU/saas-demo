import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LimitsService {
  private readonly logger = new Logger(LimitsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Increment API usage for a specific tenant and endpoint.
   * Checks against limits and records a violation if exceeded.
   */
  async recordApiUsage(tenantId: string, endpoint: string) {
    try {
      const now = new Date();
      // Track usage by hour
      const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000);

      // Default hourly limit
      const limitValue = 1000;

      const usage = await this.prisma.apiUsage.upsert({
        where: {
          tenantId_endpoint_windowStart: {
            tenantId,
            endpoint,
            windowStart,
          },
        },
        create: {
          tenantId,
          endpoint,
          windowStart,
          windowEnd,
          requestCount: 1,
          limitValue,
          isExceeded: false,
        },
        update: {
          requestCount: { increment: 1 },
        },
      });

      // Check if limit exceeded
      if (usage.requestCount > usage.limitValue && !usage.isExceeded) {
        // Mark as exceeded
        await this.prisma.apiUsage.update({
          where: { id: usage.id },
          data: { isExceeded: true },
        });

        // Record violation
        await this.prisma.planLimitViolation.create({
          data: {
            tenantId,
            limitType: `API_CALLS_${endpoint}`,
            limitValue,
            actualValue: usage.requestCount,
            action: 'THROTTLED',
            wasBlocked: true,
          },
        });
        
        return { exceeded: true };
      }

      return { exceeded: usage.isExceeded };
    } catch (err) {
      this.logger.error(`Error recording API usage: ${err.message}`);
      return { exceeded: false }; // Fail open
    }
  }

  async getViolations(tenantId: string) {
    return this.prisma.planLimitViolation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
