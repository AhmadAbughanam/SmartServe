import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { PaymentsService } from "./payments.service.js";
import { CreatePaymentDto } from "./dto/create-payment.dto.js";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto.js";
import { CreateRefundDto } from "./dto/create-refund.dto.js";
import { SplitPaymentRequestDto } from "./dto/split-payment.dto.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { Public } from "../auth/decorators/public.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import { getPaymentGateway, getGatewayByName } from "./gateways/gateway-registry.js";

@Controller()
export class PaymentsController {
  constructor(
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService,
  ) {}

  /** Current unpaid bill for all orders in a customer session. */
  @Public()
  @Get("sessions/:sessionId/bill")
  getSessionBill(@Param("sessionId") sessionId: string) {
    return this.paymentsService.getSessionBill(sessionId);
  }

  /** Staff-recorded manual payment (CASH/CARD terminal reference). */
  @Post("orders/:orderId/payments")
  @RequirePermissions("payments:write")
  createPayment(
    @Param("orderId") orderId: string,
    @Body() dto: CreatePaymentDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.paymentsService.createPayment(orderId, dto, staff);
  }

  /** Create gateway payment intent (customer-initiated online payment). */
  @Public()
  @Post("orders/:orderId/payments/intent")
  createPaymentIntent(
    @Param("orderId") orderId: string,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    // For public intent creation, we resolve tenantId from the order itself.
    // This is safe because the intent only creates a PENDING payment —
    // actual completion requires a signed webhook.
    const gateway = getPaymentGateway();
    return this.paymentsService.createPaymentIntent(
      orderId,
      dto.paymentMethod,
      dto.returnUrl,
      "", // tenantId resolved inside service from order
      gateway,
    );
  }

  /** Create one gateway payment intent for all unpaid orders in a customer session. */
  @Public()
  @Post("sessions/:sessionId/payments/intent")
  createSessionPaymentIntent(
    @Param("sessionId") sessionId: string,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    const gateway = getPaymentGateway();
    return this.paymentsService.createSessionPaymentIntent(
      sessionId,
      dto.paymentMethod,
      dto.returnUrl,
      gateway,
    );
  }

  /** Webhook callback from payment provider. */
  @Public()
  @Post("payments/webhook/:provider")
  async handleWebhook(
    @Param("provider") provider: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") stripeSignature: string | undefined,
    @Headers("x-webhook-signature") fallbackSignature: string | undefined,
  ) {
    const gateway = getGatewayByName(provider);
    if (!gateway) {
      throw new BadRequestException(`Unknown provider: ${provider}`);
    }

    const signature = provider === "stripe" ? stripeSignature : (stripeSignature ?? fallbackSignature);
    const payload =
      req.rawBody?.toString("utf8")
      ?? (typeof req.body === "string" ? req.body : JSON.stringify(req.body));

    if (provider === "stripe" && !req.rawBody) {
      throw new BadRequestException("Missing raw webhook body");
    }

    if (!signature || !gateway.verifyWebhookSignature(payload, signature)) {
      throw new BadRequestException("Invalid webhook signature");
    }

    const event = gateway.parseWebhookEvent(payload);
    return this.paymentsService.handleWebhookEvent(event);
  }

  @Get("orders/:orderId/payments")
  @RequirePermissions("payments:read")
  listPayments(
    @Param("orderId") orderId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.paymentsService.listForOrder(orderId, staff);
  }

  @Get("payments/:paymentId")
  @RequirePermissions("payments:read")
  getPayment(
    @Param("paymentId") paymentId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.paymentsService.getById(paymentId, staff);
  }

  @Post("payments/:paymentId/refunds")
  @RequirePermissions("payments:refund")
  createRefund(
    @Param("paymentId") paymentId: string,
    @Body() dto: CreateRefundDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.paymentsService.createRefund(paymentId, dto, staff);
  }

  /** Split-bill preview: compute split allocations without creating payments. */
  @Public()
  @Post("orders/:orderId/payments/splits/preview")
  async previewSplits(
    @Param("orderId") orderId: string,
    @Body() body: SplitPaymentRequestDto,
  ) {
    return this.paymentsService.previewSplits(orderId, body);
  }

  /** Create split payments: commits split allocations as individual payment intents. */
  @Public()
  @Post("orders/:orderId/payments/splits")
  async createSplitPayments(
    @Param("orderId") orderId: string,
    @Body() body: SplitPaymentRequestDto,
  ) {
    const gateway = getPaymentGateway();
    return this.paymentsService.createSplitPayments(orderId, body, gateway);
  }

  /**
   * DEV ONLY: Simulate mock payment completion.
   * Disabled in production via NODE_ENV check.
   */
  @Public()
  @Post("payments/:paymentId/mock-complete")
  async mockComplete(@Param("paymentId") paymentId: string) {
    if (process.env.NODE_ENV === "production") {
      throw new BadRequestException("Mock completion disabled in production");
    }
    // Look up the payment to get its externalId
    const payment = await this.paymentsService.getByReference(paymentId);
    if (!payment) throw new BadRequestException("Payment not found");

    return this.paymentsService.handleWebhookEvent({
      type: "payment.completed",
      externalId: payment.paymentReference ?? paymentId,
      amount: payment.amount.mul(100).toNumber(),
      currency: "USD",
    });
  }
}
