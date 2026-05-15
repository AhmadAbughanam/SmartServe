export const actorRoles = [
  "CUSTOMER",
  "WAITER",
  "CHEF",
  "KITCHEN_LEAD",
  "CASHIER",
  "MANAGER",
  "OWNER",
] as const;

export type ActorRole = (typeof actorRoles)[number];

export type TenantId = string;
export type BranchId = string;
export type TableId = string;
export type SessionId = string;
export type OrderId = string;

export interface ScopeContext {
  tenantId: TenantId;
  branchId: BranchId;
}

export const orderStatuses = [
  "PLACED",
  "CONFIRMED",
  "IN_KITCHEN",
  "READY",
  "SERVED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export const tableStatuses = [
  "AVAILABLE",
  "OCCUPIED",
  "RESERVED",
  "CLEANING",
  "OUT_OF_SERVICE",
] as const;

export type TableStatus = (typeof tableStatuses)[number];

export const sessionStatuses = [
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
] as const;

export type SessionStatus = (typeof sessionStatuses)[number];

export const kitchenStatuses = [
  "PENDING",
  "IN_PROGRESS",
  "READY",
  "CANCELLED",
] as const;

export type KitchenStatus = (typeof kitchenStatuses)[number];

export const paymentStatuses = [
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
] as const;

export type PaymentStatus = (typeof paymentStatuses)[number];

export const orderPaymentStatuses = [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "REFUNDED",
] as const;

export type OrderPaymentStatus = (typeof orderPaymentStatuses)[number];

export const serviceRequestStatuses = [
  "NEW",
  "CLAIMED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ServiceRequestStatus = (typeof serviceRequestStatuses)[number];

export interface HealthCheckPayload {
  service: string;
  status: "ok";
  timestamp: string;
  dependencies?: Record<string, string>;
}

export const domainEvents = [
  "ORDER_PLACED",
  "ORDER_UPDATED",
  "ORDER_READY",
  "ORDER_SERVED",
  "PAYMENT_COMPLETED",
  "PAYMENT_REFUNDED",
  "TABLE_STATE_CHANGED",
  "SERVICE_REQUEST_CREATED",
  "NOTIFICATION_DISPATCH_REQUESTED",
  "ITEM_86ED",
  "TABLE_CLEARED",
  "SERVICE_REQUEST_UPDATED",
] as const;

export type DomainEventName = (typeof domainEvents)[number];

export interface DomainEvent<TPayload = unknown> {
  name: DomainEventName;
  tenantId: TenantId;
  branchId: BranchId;
  payload: TPayload;
  occurredAt: string;
}

export * from "./recommendations.js";
export * from "./menu-chat.js";
export * from "./demand-forecasting.js";
export * from "./review-sentiment.js";
export * from "./business-insights.js";
export * from "./geofencing.js";
