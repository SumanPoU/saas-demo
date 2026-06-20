import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto, UpdatePlanDto, SubscribeDto } from './dto/billing.dto';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  // --- Plans ---
  async createPlan(dto: CreatePlanDto) {
    return this.prisma.tenantPlan.create({
      data: {
        name: dto.name,
        priceMonthly: dto.price,
        isPublic: true,
      },
    });
  }

  async getPlans() {
    return this.prisma.tenantPlan.findMany({
      where: { isPublic: true },
      orderBy: { priceMonthly: 'asc' },
    });
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.tenantPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return this.prisma.tenantPlan.update({
      where: { id },
      data: {
        name: dto.name,
        isPublic: dto.isActive,
      },
    });
  }

  // --- Subscriptions ---
  async subscribe(tenantId: string, dto: SubscribeDto) {
    const plan = await this.prisma.tenantPlan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    // Soft logic: cancel existing active subscription
    await this.prisma.subscription.updateMany({
      where: { tenantId, status: 'ACTIVE' },
      data: { status: 'CANCELED', canceledAt: new Date() },
    });

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // defaulting to monthly

    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId,
        planId: dto.planId,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: endDate,
        billingInterval: 'MONTHLY',
      },
    });

    await this.prisma.subscriptionHistory.create({
      data: {
        subscriptionId: subscription.id,
        previousStatus: 'TRIALING',
        newStatus: 'ACTIVE',
        reason: `Subscribed to ${plan.name}`,
      },
    });

    return subscription;
  }

  async getSubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('No active subscription found');
    return sub;
  }

  async cancelSubscription(tenantId: string) {
    const sub = await this.getSubscription(tenantId);

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELED', canceledAt: new Date() },
    });

    await this.prisma.subscriptionHistory.create({
      data: {
        subscriptionId: sub.id,
        previousStatus: 'ACTIVE',
        newStatus: 'CANCELED',
        reason: 'Subscription canceled by user',
      },
    });

    return { message: 'Subscription canceled successfully' };
  }

  // --- Invoices ---
  async getInvoices(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoiceById(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }
}
