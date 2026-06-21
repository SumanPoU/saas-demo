import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto, UpdatePlanDto, SubscribeDto } from './dto/billing.dto';
import { MediaService } from '../media/media.service';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

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
      where: { tenantId, status: { in: ['ACTIVE', 'TRIALING'] } },
      data: { status: 'CANCELED', canceledAt: new Date(), cancelAtPeriodEnd: true },
    });

    const isTrial = true; // Simplified: usually based on tenant history or plan settings
    const startDate = new Date();
    
    let trialEnd: Date | null = null;
    let currentPeriodStart = startDate;
    let currentPeriodEnd = new Date(startDate);
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1); // defaulting to monthly

    if (isTrial) {
      trialEnd = new Date(startDate);
      trialEnd.setDate(trialEnd.getDate() + 14); // 14-day trial
      currentPeriodStart = trialEnd;
      currentPeriodEnd = new Date(trialEnd);
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    }

    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId,
        planId: dto.planId,
        status: isTrial ? 'TRIALING' : 'ACTIVE',
        trialStart: isTrial ? startDate : null,
        trialEnd: trialEnd,
        currentPeriodStart,
        currentPeriodEnd,
        billingInterval: 'MONTHLY',
        cancelAtPeriodEnd: false,
      },
    });

    await this.prisma.subscriptionHistory.create({
      data: {
        subscriptionId: subscription.id,
        previousStatus: 'TRIALING',
        newStatus: subscription.status,
        reason: `Subscribed to ${plan.name}`,
      },
    });

    return subscription;
  }

  async getSubscriptionHistory(tenantId: string) {
    const sub = await this.getSubscription(tenantId);
    return this.prisma.subscriptionHistory.findMany({
      where: { subscriptionId: sub.id },
      orderBy: { createdAt: 'desc' },
    });
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

  /**
   * Generates a PDF invoice and uploads it via MediaService
   */
  async generateInvoicePdf(tenantId: string, invoiceId: string) {
    const invoice = await this.getInvoiceById(tenantId, invoiceId);
    
    // Generate PDF
    const doc = new PDFDocument();
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    
    doc.fontSize(25).text('Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Invoice ID: ${invoice.id}`);
    doc.text(`Status: ${invoice.status}`);
    doc.text(`Amount Due: ${invoice.amountDue} ${invoice.currency}`);
    doc.text(`Date: ${invoice.createdAt.toISOString()}`);
    doc.end();

    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });

    // Upload via MediaService
    const mediaFile = await this.mediaService.uploadFile({
      buffer: pdfBuffer,
      originalName: `invoice-${invoiceId}.pdf`,
      mimeType: 'application/pdf',
      size: pdfBuffer.length,
      tenantId,
      purpose: 'INVOICE_PDF',
    });

    // Update invoice record
    const updatedInvoice = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        invoicePdf: mediaFile.bucketName + '/' + mediaFile.storagePath,
      },
    });

    return updatedInvoice;
  }
}
