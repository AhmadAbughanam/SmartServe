import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { DeviceType, Prisma } from "@prisma/client";
import crypto from "node:crypto";

@Injectable()
export class DevicesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listByBranch(tenantId: string, branchId: string) {
    return this.prisma.branchDevice.findMany({
      where: { tenantId, branchId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, deviceType: true, capabilitiesJson: true,
        isActive: true, lastSeenAt: true, createdAt: true, branchId: true,
      },
    });
  }

  async create(data: {
    tenantId: string;
    branchId: string;
    name: string;
    deviceType: DeviceType;
    capabilitiesJson?: Prisma.InputJsonValue;
  }) {
    const rawKey = crypto.randomBytes(32).toString("hex");
    const apiKeyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const device = await this.prisma.branchDevice.create({
      data: { ...data, apiKeyHash },
    });

    return {
      id: device.id, name: device.name, deviceType: device.deviceType,
      isActive: device.isActive, apiKey: rawKey, createdAt: device.createdAt,
    };
  }

  async update(id: string, tenantId: string, data: { name?: string; deviceType?: DeviceType; capabilitiesJson?: Prisma.InputJsonValue; isActive?: boolean }) {
    const device = await this.prisma.branchDevice.findUnique({ where: { id } });
    if (!device || device.tenantId !== tenantId) throw new NotFoundException("Device not found");

    return this.prisma.branchDevice.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.deviceType !== undefined ? { deviceType: data.deviceType } : {}),
        ...(data.capabilitiesJson !== undefined ? { capabilitiesJson: data.capabilitiesJson } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      select: {
        id: true, name: true, deviceType: true, capabilitiesJson: true,
        isActive: true, lastSeenAt: true, createdAt: true, branchId: true,
      },
    });
  }

  async resetKey(id: string, tenantId: string) {
    const device = await this.prisma.branchDevice.findUnique({ where: { id } });
    if (!device || device.tenantId !== tenantId) throw new NotFoundException("Device not found");

    const rawKey = crypto.randomBytes(32).toString("hex");
    const apiKeyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    await this.prisma.branchDevice.update({ where: { id }, data: { apiKeyHash } });
    return { id, apiKey: rawKey };
  }

  async updateLastSeen(id: string, tenantId: string) {
    return this.prisma.branchDevice.updateMany({
      where: { id, tenantId },
      data: { lastSeenAt: new Date() },
    });
  }
}
