import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, SessionStatus, TableStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { SESSION_STARTABLE_STATUSES } from "../tables/table-status.rules.js";
import { GeoFencingService } from "../geofencing/geofencing.service.js";
import type { GeoFenceLocationInput } from "@smart-restaurant/shared-types";

@Injectable()
export class SessionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GeoFencingService)
    private readonly geoFencingService: GeoFencingService,
  ) {}

  /**
   * Start a dining session.
   *
   * Business rules:
   * - Table must be found via branchId + tableCode.
   * - Table must be in a startable status (AVAILABLE or RESERVED).
   * - There must not be an existing ACTIVE session on the table.
   * - Starting a session moves the table to OCCUPIED.
   */
  async startSession(input: {
    branchId: string;
    tableCode: string;
    guestCount: number;
    notes?: string;
    userId?: string;
    createdByStaffId?: string;
    location?: GeoFenceLocationInput;
    enforceGeoFence?: boolean;
  }) {
    const table = await this.prisma.table.findUnique({
      where: {
        branchId_tableCode: {
          branchId: input.branchId,
          tableCode: input.tableCode,
        },
      },
      include: { branch: { select: { tenantId: true } } },
    });

    if (!table) {
      throw new NotFoundException(
        `Table '${input.tableCode}' not found in branch`,
      );
    }

    if (!SESSION_STARTABLE_STATUSES.includes(table.status)) {
      throw new BadRequestException(
        `Cannot start session: table is currently ${table.status}`,
      );
    }

    // Prevent duplicate active sessions
    const existingActive = await this.prisma.session.findFirst({
      where: {
        tableId: table.id,
        status: SessionStatus.ACTIVE,
      },
    });
    if (existingActive) {
      throw new ConflictException(
        "An active session already exists on this table",
      );
    }

    if (input.enforceGeoFence) {
      await this.geoFencingService.enforceStartTableSession({
        branchId: input.branchId,
        userId: input.userId,
        location: input.location,
      });
    }

    let session;
    try {
      [session] = await this.prisma.$transaction([
        this.prisma.session.create({
          data: {
            tenantId: table.branch.tenantId,
            branchId: input.branchId,
            tableId: table.id,
            guestCount: input.guestCount,
            notes: input.notes,
            userId: input.userId,
            createdByStaffId: input.createdByStaffId,
          },
          include: {
            table: { select: { id: true, tableCode: true, status: true } },
          },
        }),
        this.prisma.table.update({
          where: { id: table.id },
          data: {
            status: TableStatus.OCCUPIED,
            lastOccupiedTime: new Date(),
          },
        }),
      ]);
    } catch (error) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
        (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002")
      ) {
        throw new ConflictException("An active session already exists on this table");
      }
      throw error;
    }

    // Update lastSessionId outside the main transaction (non-critical)
    await this.prisma.table.update({
      where: { id: table.id },
      data: { lastSessionId: session.id },
    });

    return session;
  }

  async getById(sessionId: string, tenantId?: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        table: {
          select: { id: true, tableCode: true, capacity: true, status: true },
        },
        user: { select: { id: true, phone: true, name: true } },
        createdByStaff: { select: { id: true, name: true } },
        participants: {
          select: { id: true, displayName: true, userId: true },
        },
      },
    });

    if (!session || (tenantId && session.tenantId !== tenantId)) {
      throw new NotFoundException("Session not found");
    }

    return session;
  }

  async getPublicSummary(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        branchId: true,
        guestCount: true,
        status: true,
        branch: {
          select: {
            name: true,
          },
        },
        table: {
          select: {
            tableCode: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    return {
      id: session.id,
      branchId: session.branchId,
      branchName: session.branch.name,
      tableCode: session.table.tableCode,
      guestCount: session.guestCount,
      status: session.status,
    };
  }

  /**
   * End a dining session.
   *
   * Business rules:
   * - Only ACTIVE sessions can be ended.
   * - Ending sets session status to COMPLETED and endTime to now.
   * - The table moves to CLEANING.
   */
  async endSession(sessionId: string, tenantId?: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    if (tenantId && session.tenantId !== tenantId) {
      throw new NotFoundException("Session not found");
    }

    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot end session: status is ${session.status}`,
      );
    }

    const [updatedSession] = await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.COMPLETED,
          endTime: new Date(),
        },
        include: {
          table: {
            select: { id: true, tableCode: true, status: true },
          },
        },
      }),
      this.prisma.table.update({
        where: { id: session.tableId },
        data: { status: TableStatus.CLEANING },
      }),
    ]);

    return updatedSession;
  }
}
