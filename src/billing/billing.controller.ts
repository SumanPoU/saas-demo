import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreatePlanDto, UpdatePlanDto, SubscribeDto } from './dto/billing.dto';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { TenantMemberGuard } from '../auth/guards/tenant-member.guard';
import { TenantOwnerGuard } from '../auth/guards/tenant-owner.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Billing')
@ApiBearerAuth('JWT')
@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // --- Plans ---
  @Post('billing/plans')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Create a subscription plan (Super Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Plan created successfully',
    schema: {
      example: {
        statusCode: 201,
        message: 'Plan created successfully',
        data: {
          id: 'plan-id',
          name: 'Pro',
          price: 29.99,
          currency: 'USD',
          interval: 'MONTHLY',
        },
      },
    },
  })
  createPlan(@Body() dto: CreatePlanDto) {
    return this.billingService.createPlan(dto);
  }

  @Get('billing/plans')
  @ApiOperation({ summary: 'List all active subscription plans' })
  @ApiResponse({
    status: 200,
    description: 'Plans retrieved successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'Plans retrieved successfully',
        data: [
          {
            id: 'plan-id',
            name: 'Pro',
            price: 29.99,
            currency: 'USD',
            interval: 'MONTHLY',
          },
        ],
      },
    },
  })
  getPlans() {
    return this.billingService.getPlans();
  }

  @Patch('billing/plans/:id')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Update a subscription plan (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Plan updated successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'Plan updated successfully',
        data: {
          id: 'plan-id',
          name: 'Pro Updated',
          price: 39.99,
        },
      },
    },
  })
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.billingService.updatePlan(id, dto);
  }

  // --- Subscriptions ---
  @Post('tenants/:tenantId/billing/subscribe')
  @UseGuards(TenantOwnerGuard)
  @ApiOperation({ summary: 'Subscribe to a plan (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Subscribed successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'Subscribed successfully',
        data: {
          id: 'sub-id',
          tenantId: 'tenant-id',
          planId: 'plan-id',
          status: 'ACTIVE',
        },
      },
    },
  })
  subscribe(@Param('tenantId') tenantId: string, @Body() dto: SubscribeDto) {
    return this.billingService.subscribe(tenantId, dto);
  }

  @Get('tenants/:tenantId/billing/subscription')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'Get active subscription details' })
  @ApiResponse({
    status: 200,
    description: 'Subscription details returned',
    schema: {
      example: {
        statusCode: 200,
        message: 'Subscription retrieved successfully',
        data: {
          id: 'sub-id',
          planId: 'plan-id',
          status: 'ACTIVE',
          currentPeriodEnd: '2026-07-16T00:00:00Z',
        },
      },
    },
  })
  getSubscription(@Param('tenantId') tenantId: string) {
    return this.billingService.getSubscription(tenantId);
  }

  @Get('tenants/:tenantId/billing/subscription/history')
  @UseGuards(TenantOwnerGuard)
  @ApiOperation({ summary: 'Get active subscription history (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Subscription history returned',
  })
  getSubscriptionHistory(@Param('tenantId') tenantId: string) {
    return this.billingService.getSubscriptionHistory(tenantId);
  }

  @Post('tenants/:tenantId/billing/cancel')
  @UseGuards(TenantOwnerGuard)
  @ApiOperation({ summary: 'Cancel active subscription (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Subscription cancelled successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'Subscription cancelled successfully',
        data: {
          id: 'sub-id',
          status: 'CANCELED',
        },
      },
    },
  })
  cancelSubscription(@Param('tenantId') tenantId: string) {
    return this.billingService.cancelSubscription(tenantId);
  }

  // --- Invoices ---
  @Get('tenants/:tenantId/billing/invoices')
  @UseGuards(TenantOwnerGuard)
  @ApiOperation({ summary: 'List all invoices for the workspace (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Invoices retrieved successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'Invoices retrieved successfully',
        data: [
          {
            id: 'invoice-id',
            amount: 29.99,
            status: 'PAID',
            issuedAt: '2026-06-16T00:00:00Z',
          },
        ],
      },
    },
  })
  getInvoices(@Param('tenantId') tenantId: string) {
    return this.billingService.getInvoices(tenantId);
  }

  @Get('tenants/:tenantId/billing/invoices/:id')
  @UseGuards(TenantOwnerGuard)
  @ApiOperation({ summary: 'Get details of a specific invoice (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Invoice details returned',
    schema: {
      example: {
        statusCode: 200,
        message: 'Invoice retrieved successfully',
        data: {
          id: 'invoice-id',
          amount: 29.99,
          status: 'PAID',
          issuedAt: '2026-06-16T00:00:00Z',
        },
      },
    },
  })
  getInvoiceById(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.billingService.getInvoiceById(tenantId, id);
  }

  @Post('tenants/:tenantId/billing/invoices/:id/generate-pdf')
  @UseGuards(TenantOwnerGuard)
  @ApiOperation({ summary: 'Generate PDF for an invoice (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'PDF generated and URL returned',
  })
  generateInvoicePdf(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.billingService.generateInvoicePdf(tenantId, id);
  }
}
