import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import type { NotificationType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listForStaff(tenantId: string, branchId: string, staffId: string, unreadOnly: boolean) {
    return this.prisma.notification.findMany({
      where: {
        tenantId,
        branchId,
        OR: [{ staffId }, { staffId: null }],
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async markRead(notificationId: string, tenantId: string, branchId: string, staffId: string) {
    const n = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!n || n.tenantId !== tenantId || n.branchId !== branchId || (n.staffId !== null && n.staffId !== staffId)) {
      throw new NotFoundException("Notification not found");
    }
    return this.prisma.notification.update({ where: { id: notificationId }, data: { isRead: true } });
  }

  async markAllRead(tenantId: string, branchId: string, staffId: string) {
    await this.prisma.notification.updateMany({
      where: { tenantId, branchId, OR: [{ staffId }, { staffId: null }], isRead: false },
      data: { isRead: true },
    });
    return { updated: true };
  }

  async create(data: {
    tenantId: string;
    branchId: string;
    staffId?: string;
    type: NotificationType;
    title: string;
    body: string;
  }) {
    return this.prisma.notification.create({ data });
  }

  async unreadCount(tenantId: string, branchId: string, staffId: string) {
    const count = await this.prisma.notification.count({
      where: { tenantId, branchId, OR: [{ staffId }, { staffId: null }], isRead: false },
    });
    return { unread: count };
  }
}
