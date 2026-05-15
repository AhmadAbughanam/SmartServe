import { Injectable, Logger } from "@nestjs/common";
import { Subject, type Observable } from "rxjs";
import { filter } from "rxjs/operators";
import type { DomainEvent, DomainEventName } from "@smart-restaurant/shared-types";

/**
 * In-process event bus for realtime SSE delivery.
 *
 * All events flow through a single Subject. SSE endpoints subscribe
 * to this subject filtered by branchId (and optionally sessionId).
 *
 * This is intentionally simple — no external broker, no persistence.
 * A Redis pub/sub adapter can replace the Subject later without
 * changing the publish/subscribe API.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly events$ = new Subject<DomainEvent>();

  publish(event: DomainEvent): void {
    this.logger.debug(
      `[${event.name}] tenant=${event.tenantId} branch=${event.branchId}`,
    );
    this.events$.next(event);
  }

  /** Helper to build and publish an event in one call. */
  emit(
    name: DomainEventName,
    tenantId: string,
    branchId: string,
    payload: unknown,
  ): void {
    this.publish({
      name,
      tenantId,
      branchId,
      payload,
      occurredAt: new Date().toISOString(),
    });
  }

  /** Subscribe to all events for a specific branch. */
  branchEvents$(branchId: string): Observable<DomainEvent> {
    return this.events$.pipe(
      filter((e) => e.branchId === branchId),
    );
  }

  /** Subscribe to events relevant to a specific session. */
  sessionEvents$(sessionId: string): Observable<DomainEvent> {
    return this.events$.pipe(
      filter((e) => {
        const p = e.payload as Record<string, unknown> | null;
        return p?.sessionId === sessionId;
      }),
    );
  }
}
