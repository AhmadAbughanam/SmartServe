import type { DomainEvent } from "@smart-restaurant/shared-types";

export interface EventBus {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
}

