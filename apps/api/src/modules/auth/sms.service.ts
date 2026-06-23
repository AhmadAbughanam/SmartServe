import { BadGatewayException, Injectable, Logger } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { env } from "../../config/env.js";
import { MetricsService } from "../metrics/metrics.service.js";

export type SmsPurpose = "CUSTOMER_OTP";

export type SendSmsInput = {
  to: string;
  body: string;
  purpose: SmsPurpose;
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @Inject(MetricsService) private readonly metricsService: MetricsService,
  ) {}

  async send(input: SendSmsInput): Promise<void> {
    if (env.smsProvider === "noop") {
      this.metricsService.recordSmsAttempt(env.smsProvider, input.purpose, "noop");
      this.logger.debug(`SMS noop provider skipped purpose=${input.purpose} to=${this.maskPhone(input.to)}`);
      return;
    }

    if (env.smsProvider === "twilio") {
      await this.sendTwilio(input);
      return;
    }
  }

  private async sendTwilio(input: SendSmsInput): Promise<void> {
    if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioFromNumber) {
      throw new BadGatewayException("SMS provider is not configured");
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.twilioAccountSid)}/Messages.json`;
    const body = new URLSearchParams({
      To: input.to,
      From: env.twilioFromNumber,
      Body: input.body,
    });
    const auth = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      const providerStatus = response.status;
      this.metricsService.recordSmsAttempt(env.smsProvider, input.purpose, "failed");
      this.logger.warn(`SMS provider failed purpose=${input.purpose} to=${this.maskPhone(input.to)} status=${providerStatus}`);
      throw new BadGatewayException("Failed to send SMS");
    }

    this.metricsService.recordSmsAttempt(env.smsProvider, input.purpose, "sent");
    this.logger.log(`SMS sent purpose=${input.purpose} to=${this.maskPhone(input.to)} provider=${env.smsProvider}`);
  }

  private maskPhone(phone: string): string {
    if (phone.length <= 4) return "****";
    return `${"*".repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`;
  }
}
