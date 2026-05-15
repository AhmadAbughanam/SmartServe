import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PaymentMethod, PaymentStatus, ShiftStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class ShiftsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ── Shifts ───────────────────────────────────────────

  async openShift(staffId: string, tenantId: string, branchId: string) {
    // Prevent duplicate open shift
    const existing = await this.prisma.shift.findFirst({
      where: { staffId, branchId, status: ShiftStatus.OPEN },
    });
    if (existing) {
      throw new ConflictException(
        "You already have an open shift in this branch",
      );
    }

    return this.prisma.shift.create({
      data: {
        tenantId,
        branchId,
        staffId,
        startTime: new Date(),
        status: ShiftStatus.OPEN,
      },
    });
  }

  async closeShift(
    shiftId: string,
    tenantId: string,
    staffId: string,
  ) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
    });
    if (!shift || shift.tenantId !== tenantId) {
      throw new NotFoundException("Shift not found");
    }
    if (shift.status !== ShiftStatus.OPEN) {
      throw new BadRequestException("Shift is already closed");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.shift.update({
        where: { id: shiftId },
        data: { status: ShiftStatus.CLOSED, endTime: new Date() },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId: shift.branchId,
          actorStaffId: staffId,
          actionCode: "SHIFT_CLOSED",
          entityType: "Shift",
          entityId: shiftId,
          afterJson: {
            shiftId,
            staffId: shift.staffId,
            startTime: shift.startTime.toISOString(),
            endTime: result.endTime?.toISOString(),
          },
        },
      });

      return result;
    });

    return updated;
  }

  async getOpenShift(staffId: string, branchId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { staffId, branchId, status: ShiftStatus.OPEN },
      include: { tills: true, attendance: true },
    });
    if (!shift) throw new NotFoundException("No open shift found");
    return shift;
  }

  async listShifts(branchId: string, tenantId: string) {
    return this.prisma.shift.findMany({
      where: { branchId, tenantId },
      orderBy: { startTime: "desc" },
      take: 50,
      include: {
        staff: { select: { id: true, name: true, primaryRole: true } },
        tills: true,
      },
    });
  }

  // ── Attendance ───────────────────────────────────────

  async checkIn(staffId: string, tenantId: string, branchId: string) {
    // Prevent duplicate open check-in
    const existing = await this.prisma.staffAttendance.findFirst({
      where: { staffId, branchId, checkOut: null },
    });
    if (existing) {
      throw new ConflictException("Already checked in");
    }

    // Link to open shift if one exists
    const openShift = await this.prisma.shift.findFirst({
      where: { staffId, branchId, status: ShiftStatus.OPEN },
    });

    return this.prisma.staffAttendance.create({
      data: {
        tenantId,
        branchId,
        staffId,
        checkIn: new Date(),
        shiftId: openShift?.id,
      },
    });
  }

  async checkOut(staffId: string, branchId: string) {
    const record = await this.prisma.staffAttendance.findFirst({
      where: { staffId, branchId, checkOut: null },
    });
    if (!record) {
      throw new NotFoundException("No open check-in found");
    }

    return this.prisma.staffAttendance.update({
      where: { id: record.id },
      data: { checkOut: new Date() },
    });
  }

  async getMyAttendance(staffId: string, branchId: string) {
    return this.prisma.staffAttendance.findFirst({
      where: { staffId, branchId, checkOut: null },
    });
  }

  // ── Till ─────────────────────────────────────────────

  async closeTill(
    shiftId: string,
    actualCash: number,
    tenantId: string,
    staffId: string,
  ) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: { tills: true },
    });
    if (!shift || shift.tenantId !== tenantId) {
      throw new NotFoundException("Shift not found");
    }
    if (shift.tills.length > 0) {
      throw new ConflictException("Till already closed for this shift");
    }

    // Calculate expected cash: sum of completed CASH payments during this shift's window
    const paymentWhere: Record<string, unknown> = {
      branchId: shift.branchId,
      tenantId,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.COMPLETED,
      paymentDate: { gte: shift.startTime },
    };
    if (shift.endTime) {
      (paymentWhere["paymentDate"] as Record<string, unknown>)["lte"] = shift.endTime;
    }

    const cashPayments = await this.prisma.payment.findMany({ where: paymentWhere });

    const expectedCash = cashPayments.reduce(
      (sum, p) => sum.add(p.amount),
      new Decimal(0),
    );

    const actualDec = new Decimal(actualCash);
    const difference = actualDec.sub(expectedCash);

    const till = await this.prisma.$transaction(async (tx) => {
      const created = await tx.till.create({
        data: {
          tenantId,
          shiftId,
          expectedCash,
          actualCash: actualDec,
          difference,
          closedByStaffId: staffId,
          closedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          branchId: shift.branchId,
          actorStaffId: staffId,
          actionCode: "TILL_CLOSED",
          entityType: "Till",
          entityId: created.id,
          afterJson: {
            tillId: created.id,
            shiftId,
            expectedCash: expectedCash.toString(),
            actualCash: actualDec.toString(),
            difference: difference.toString(),
          },
        },
      });

      return created;
    });

    return till;
  }

  async getTill(shiftId: string, tenantId: string) {
    const till = await this.prisma.till.findFirst({
      where: {
        shiftId,
        tenantId,
      },
    });
    if (!till) throw new NotFoundException("No till found for this shift");
    return till;
  }
}
