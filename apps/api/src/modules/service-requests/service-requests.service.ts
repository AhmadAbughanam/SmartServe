import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  NotificationType,
  type Prisma,
  ServiceRequestStatus,
  type ServiceRequestType,
  SessionStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { LogsService } from "../logs/logs.service.js";
import { isValidServiceRequestTransition } from "./service-request-status.rules.js";

@Injectable()
export class ServiceRequestsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(LogsService) private readonly logsService: LogsService,
  ) {}

  // ── Customer / public ────────────────────────────────

  async create(sessionId: string, type: ServiceRequestType) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { branch: { select: { tenantId: true } } },
    });
    if (!session) throw new NotFoundException("Session not found");
    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot create request: session is ${session.status}`,
      );
    }

    const request = await this.prisma.serviceRequest.create({
      data: {
        tenantId: session.branch.tenantId,
        branchId: session.branchId,
        sessionId,
        tableId: session.tableId,
        type,
      },
      include: {
        table: { select: { tableCode: true } },
      },
    });

    // Create a staff notification for the branch
    await this.prisma.notification.create({
      data: {
        tenantId: session.branch.tenantId,
        branchId: session.branchId,
        type: NotificationType.SYSTEM,
        title: `Service Request: ${type}`,
        body: `Table ${request.table.tableCode} requests ${type.replace(/_/g, " ").toLowerCase()}`,
      },
    });

    this.realtime.emit(
      "SERVICE_REQUEST_CREATED",
      session.branch.tenantId,
      session.branchId,
      {
        requestId: request.id,
        sessionId,
        tableId: session.tableId,
        tableCode: request.table.tableCode,
        type,
      },
    );
    void this.logsService.writeOperational({
      tenantId: session.branch.tenantId,
      branchId: session.branchId,
      sessionId,
      tableId: session.tableId,
      eventType: "SERVICE_REQUEST_CREATED",
      message: `Table ${request.table.tableCode} requested ${type.replace(/_/g, " ").toLowerCase()}`,
      metadata: {
        requestId: request.id,
        type,
        tableCode: request.table.tableCode,
      },
    });

    return request;
  }

  async listForSession(sessionId: string) {
    return this.prisma.serviceRequest.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      include: {
        table: { select: { tableCode: true } },
        claimedByStaff: { select: { id: true, name: true } },
      },
    });
  }

  // ── Staff / waiter feed ──────────────────────────────

  async listForBranch(
    branchId: string,
    tenantId: string,
    staffId: string,
    statusFilter?: ServiceRequestStatus,
    typeFilter?: ServiceRequestType,
  ) {
    const where: Prisma.ServiceRequestWhereInput = {
      branchId,
      tenantId,
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(statusFilter
        ? {
            status: statusFilter,
            ...(statusFilter === ServiceRequestStatus.CLAIMED
              ? { claimedByStaffId: staffId }
              : {}),
          }
        : {
            OR: [
              { status: ServiceRequestStatus.NEW },
              {
                status: ServiceRequestStatus.CLAIMED,
                claimedByStaffId: staffId,
              },
            ],
          }),
    };

    return this.prisma.serviceRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        table: { select: { id: true, tableCode: true } },
        session: { select: { id: true, guestCount: true } },
        claimedByStaff: { select: { id: true, name: true } },
      },
    });
  }

  async getById(requestId: string, tenantId: string) {
    const req = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        table: { select: { id: true, tableCode: true } },
        session: { select: { id: true, guestCount: true } },
        claimedByStaff: { select: { id: true, name: true } },
      },
    });
    if (!req || req.tenantId !== tenantId) {
      throw new NotFoundException("Service request not found");
    }
    return req;
  }

  async claim(requestId: string, tenantId: string, staffId: string) {
    const req = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });
    if (!req || req.tenantId !== tenantId) {
      throw new NotFoundException("Service request not found");
    }

    if (!isValidServiceRequestTransition(req.status, ServiceRequestStatus.CLAIMED)) {
      throw new BadRequestException(
        `Cannot claim: request is ${req.status}`,
      );
    }

    const claimed = await this.prisma.serviceRequest.updateMany({
      where: {
        id: requestId,
        tenantId,
        status: ServiceRequestStatus.NEW,
        claimedByStaffId: null,
      },
      data: {
        status: ServiceRequestStatus.CLAIMED,
        claimedByStaffId: staffId,
      },
    });
    if (claimed.count === 0) {
      throw new BadRequestException("Request was already claimed");
    }

    const updated = await this.prisma.serviceRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { table: { select: { tableCode: true } } },
    });

    this.emitUpdate(updated);
    void this.logsService.writeOperational({
      tenantId,
      branchId: updated.branchId,
      sessionId: updated.sessionId,
      tableId: updated.tableId,
      actorStaffId: staffId,
      eventType: "SERVICE_REQUEST_CLAIMED",
      message: `Service request ${requestId.slice(-6)} was claimed`,
      metadata: {
        requestId,
        type: updated.type,
        tableCode: updated.table.tableCode,
      },
    });
    return updated;
  }

  async complete(
    requestId: string,
    tenantId: string,
    staffId: string,
  ) {
    const req = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });
    if (!req || req.tenantId !== tenantId) {
      throw new NotFoundException("Service request not found");
    }

    if (!isValidServiceRequestTransition(req.status, ServiceRequestStatus.COMPLETED)) {
      throw new BadRequestException(
        `Cannot complete: request is ${req.status}`,
      );
    }

    if (!req.claimedByStaffId) {
      throw new BadRequestException("Request must be claimed before completion");
    }
    if (req.claimedByStaffId !== staffId) {
      throw new ForbiddenException("Only the claiming waiter can complete this request");
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        status: ServiceRequestStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: {
        table: { select: { tableCode: true } },
      },
    });

    this.emitUpdate(updated);
    void this.logsService.writeOperational({
      tenantId,
      branchId: updated.branchId,
      sessionId: updated.sessionId,
      tableId: updated.tableId,
      actorStaffId: staffId,
      eventType: "SERVICE_REQUEST_COMPLETED",
      message: `Service request ${requestId.slice(-6)} was completed`,
      metadata: {
        requestId,
        type: updated.type,
        tableCode: updated.table.tableCode,
      },
    });
    return updated;
  }

  async cancel(requestId: string, tenantId: string) {
    const req = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });
    if (!req || req.tenantId !== tenantId) {
      throw new NotFoundException("Service request not found");
    }

    if (!isValidServiceRequestTransition(req.status, ServiceRequestStatus.CANCELLED)) {
      throw new BadRequestException(
        `Cannot cancel: request is ${req.status}`,
      );
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: ServiceRequestStatus.CANCELLED },
      include: {
        table: { select: { tableCode: true } },
      },
    });

    this.emitUpdate(updated);
    void this.logsService.writeOperational({
      tenantId,
      branchId: updated.branchId,
      sessionId: updated.sessionId,
      tableId: updated.tableId,
      eventType: "SERVICE_REQUEST_CANCELLED",
      message: `Service request ${requestId.slice(-6)} was cancelled`,
      metadata: {
        requestId,
        type: updated.type,
        tableCode: updated.table.tableCode,
      },
    });
    return updated;
  }

  private emitUpdate(
    req: { id: string; tenantId: string; branchId: string; sessionId: string; tableId: string; type: ServiceRequestType; status: ServiceRequestStatus; table: { tableCode: string } },
  ) {
    this.realtime.emit(
      "SERVICE_REQUEST_CREATED", // reuse — shared-types doesn't have a separate UPDATE event name
      req.tenantId,
      req.branchId,
      {
        requestId: req.id,
        sessionId: req.sessionId,
        tableId: req.tableId,
        tableCode: req.table.tableCode,
        type: req.type,
        status: req.status,
      },
    );
  }
}
