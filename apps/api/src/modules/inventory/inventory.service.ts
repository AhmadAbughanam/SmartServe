import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { BranchAccessService } from "../auth/branch-access.service.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import type {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  MapMenuItemInventoryDto,
} from "./dto/inventory.dto.js";

@Injectable()
export class InventoryService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(BranchAccessService)
    private readonly branchAccess: BranchAccessService,
  ) {}

  // ── CRUD ─────────────────────────────────────────────

  async list(tenantId: string, branchId: string, lowStockOnly: boolean) {
    const where: Record<string, unknown> = { tenantId, branchId, isActive: true };
    if (lowStockOnly) {
      // Prisma doesn't support field-to-field comparison in where directly,
      // so we fetch all and filter in JS. For a branch inventory this is fine.
    }

    const items = await this.prisma.inventoryItem.findMany({
      where: { tenantId, branchId, isActive: true },
      orderBy: { name: "asc" },
      include: {
        menuItemLinks: {
          include: { menuItem: { select: { id: true, name: true } } },
        },
      },
    });

    if (lowStockOnly) {
      return items.filter((i) => i.currentStock.lte(i.reorderLevel));
    }
    return items;
  }

  async getById(itemId: string, staff: AuthenticatedStaff) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: {
        menuItemLinks: {
          include: { menuItem: { select: { id: true, name: true } } },
        },
      },
    });
    if (!item || item.tenantId !== staff.tenantId) {
      throw new NotFoundException("Inventory item not found");
    }
    await this.branchAccess.assertUserCanAccessBranch(staff, item.branchId);
    return item;
  }

  async create(tenantId: string, dto: CreateInventoryItemDto, staffId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, tenantId },
    });
    if (!branch) throw new BadRequestException("Branch not found in tenant");

    const item = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({
        data: {
          tenantId,
          branchId: dto.branchId,
          name: dto.name,
          category: this.normalizeCategory(dto.category),
          unit: dto.unit,
          currentStock: dto.currentStock,
          reorderLevel: dto.reorderLevel,
        },
      });
      await tx.stockAdjustment.create({
        data: {
          tenantId,
          branchId: dto.branchId,
          inventoryItemId: created.id,
          delta: dto.currentStock,
          reason: `Initial stock; before=0; after=${created.currentStock.toString()}`,
          createdByStaffId: staffId,
          sourceType: "MANUAL",
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          branchId: dto.branchId,
          actorStaffId: staffId,
          actionCode: "INVENTORY_CREATED",
          entityType: "InventoryItem",
          entityId: created.id,
          afterJson: {
            name: dto.name,
            category: created.category,
            unit: dto.unit,
            currentStock: dto.currentStock,
            reorderLevel: dto.reorderLevel,
          },
        },
      });
      return created;
    });

    return item;
  }

  async update(itemId: string, staff: AuthenticatedStaff, dto: UpdateInventoryItemDto) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item || item.tenantId !== staff.tenantId) {
      throw new NotFoundException("Inventory item not found");
    }
    await this.branchAccess.assertUserCanAccessBranch(staff, item.branchId);

    const updated = await this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        name: dto.name,
        category: dto.category ? this.normalizeCategory(dto.category) : undefined,
        unit: dto.unit,
        reorderLevel: dto.reorderLevel,
        isActive: dto.isActive,
      },
    });

    await this.audit(staff.tenantId, item.branchId, staff.staffId, "INVENTORY_UPDATED", "InventoryItem", itemId,
      { name: item.name, category: item.category, reorderLevel: item.reorderLevel.toString(), isActive: item.isActive },
      { name: updated.name, category: updated.category, reorderLevel: updated.reorderLevel.toString(), isActive: updated.isActive },
    );

    return updated;
  }

  // ── Stock Adjustment ─────────────────────────────────

  async adjust(itemId: string, delta: number, reason: string | undefined, staff: AuthenticatedStaff) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: { menuItemLinks: { include: { menuItem: { select: { id: true, name: true, tenantId: true } } } } },
    });
    if (!item || item.tenantId !== staff.tenantId) {
      throw new NotFoundException("Inventory item not found");
    }
    await this.branchAccess.assertUserCanAccessBranch(staff, item.branchId);

    const newStock = item.currentStock.add(new Decimal(delta));
    if (newStock.lt(0)) {
      throw new BadRequestException(
        `Adjustment would result in negative stock (current: ${item.currentStock}, delta: ${delta})`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (delta < 0) {
        const result = await tx.inventoryItem.updateMany({
          where: {
            id: itemId,
            tenantId: staff.tenantId,
            branchId: item.branchId,
            currentStock: { gte: new Decimal(Math.abs(delta)) },
          },
          data: { currentStock: { decrement: Math.abs(delta) } },
        });
        if (result.count !== 1) {
          throw new ConflictException("Insufficient stock for adjustment");
        }
      } else {
        await tx.inventoryItem.update({
          where: { id: itemId },
          data: { currentStock: { increment: delta } },
        });
      }

      await tx.stockAdjustment.create({
        data: {
          tenantId: staff.tenantId,
          branchId: item.branchId,
          inventoryItemId: itemId,
          delta,
          reason: `${reason ?? "Manual adjustment"}; before=${item.currentStock.toString()}; after=${newStock.toString()}`,
          createdByStaffId: staff.staffId,
          sourceType: "MANUAL",
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: staff.tenantId,
          branchId: item.branchId,
          actorStaffId: staff.staffId,
          actionCode: "INVENTORY_ADJUSTED",
          entityType: "InventoryItem",
          entityId: itemId,
          beforeJson: { currentStock: item.currentStock.toString(), delta, reason },
          afterJson: { currentStock: newStock.toString() },
        },
      });

      if (newStock.lte(item.reorderLevel) && item.currentStock.gt(item.reorderLevel)) {
        await tx.lowStockAlert.create({
          data: {
            tenantId: staff.tenantId,
            branchId: item.branchId,
            inventoryItemId: itemId,
            thresholdSnapshot: item.reorderLevel,
            stockSnapshot: newStock,
          },
        });
      }

      if (newStock.eq(0)) {
        await tx.menuItem.updateMany({
          where: {
            id: { in: item.menuItemLinks.map((link) => link.menuItem.id) },
            tenantId: staff.tenantId,
          },
          data: { isUnavailable: true },
        });
      }

      return tx.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    });

    if (newStock.eq(0)) {
      for (const link of item.menuItemLinks) {
        this.realtime.emit("ITEM_86ED", staff.tenantId, item.branchId, {
          menuItemId: link.menuItem.id,
          name: link.menuItem.name,
          isUnavailable: true,
          reason: "Stock depleted",
        });
      }
    }

    return {
      ...updated,
      previousStock: item.currentStock.toString(),
      delta,
      isLowStock: newStock.lte(item.reorderLevel),
    };
  }

  // ── Low Stock ────────────────────────────────────────

  async getLowStock(tenantId: string, branchId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { tenantId, branchId, isActive: true },
      include: {
        menuItemLinks: {
          include: { menuItem: { select: { id: true, name: true, isUnavailable: true } } },
        },
      },
    });

    return items
      .filter((i) => i.currentStock.lte(i.reorderLevel))
      .map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        currentStock: i.currentStock.toString(),
        reorderLevel: i.reorderLevel.toString(),
        deficit: i.reorderLevel.sub(i.currentStock).toString(),
        isZero: i.currentStock.eq(0),
        linkedMenuItems: i.menuItemLinks.map((l) => ({
          menuItemId: l.menuItem.id,
          name: l.menuItem.name,
          isUnavailable: l.menuItem.isUnavailable,
        })),
      }));
  }

  // ── Menu Item Mapping ────────────────────────────────

  async getMapping(menuItemId: string, staff: AuthenticatedStaff) {
    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem || menuItem.tenantId !== staff.tenantId) {
      throw new NotFoundException("Menu item not found");
    }
    if (menuItem.branchId) {
      await this.branchAccess.assertUserCanAccessBranch(staff, menuItem.branchId);
    }

    return this.prisma.menuItemInventoryMap.findMany({
      where: {
        menuItemId,
        inventoryItem: {
          is: this.branchAccess.canAccessAnyTenantBranch(staff)
            ? { tenantId: staff.tenantId }
            : { tenantId: staff.tenantId, branchId: staff.branchId },
        },
      },
      include: {
        inventoryItem: { select: { id: true, name: true, unit: true, currentStock: true, branchId: true } },
      },
    });
  }

  async createMapping(menuItemId: string, dto: MapMenuItemInventoryDto, staff: AuthenticatedStaff) {
    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem || menuItem.tenantId !== staff.tenantId) {
      throw new NotFoundException("Menu item not found");
    }
    if (menuItem.branchId) {
      await this.branchAccess.assertUserCanAccessBranch(staff, menuItem.branchId);
    }

    const invItem = await this.prisma.inventoryItem.findUnique({ where: { id: dto.inventoryItemId } });
    if (!invItem || invItem.tenantId !== staff.tenantId) {
      throw new NotFoundException("Inventory item not found");
    }
    await this.branchAccess.assertUserCanAccessBranch(staff, invItem.branchId);

    // Branch compatibility: inventory is branch-specific, menu item may be tenant-wide
    if (menuItem.branchId && menuItem.branchId !== invItem.branchId) {
      throw new BadRequestException("Menu item and inventory item belong to different branches");
    }

    const mapping = await this.prisma.menuItemInventoryMap.upsert({
      where: {
        menuItemId_inventoryItemId: { menuItemId, inventoryItemId: dto.inventoryItemId },
      },
      update: { qtyPerItem: dto.qtyPerItem },
      create: {
        menuItemId,
        inventoryItemId: dto.inventoryItemId,
        qtyPerItem: dto.qtyPerItem,
      },
    });

    await this.audit(staff.tenantId, invItem.branchId, staff.staffId, "INVENTORY_MAPPED", "MenuItemInventoryMap", `${menuItemId}:${dto.inventoryItemId}`, null, {
      menuItemId, inventoryItemId: dto.inventoryItemId, qtyPerItem: dto.qtyPerItem,
    });

    return mapping;
  }

  async removeMapping(menuItemId: string, inventoryItemId: string, staff: AuthenticatedStaff) {
    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem || menuItem.tenantId !== staff.tenantId) {
      throw new NotFoundException("Menu item not found");
    }
    if (menuItem.branchId) {
      await this.branchAccess.assertUserCanAccessBranch(staff, menuItem.branchId);
    }

    const invItem = await this.prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
    if (!invItem || invItem.tenantId !== staff.tenantId) {
      throw new NotFoundException("Inventory item not found");
    }
    await this.branchAccess.assertUserCanAccessBranch(staff, invItem.branchId);

    await this.prisma.menuItemInventoryMap.delete({
      where: { menuItemId_inventoryItemId: { menuItemId, inventoryItemId } },
    });

    await this.audit(staff.tenantId, invItem.branchId, staff.staffId, "INVENTORY_UNMAPPED", "MenuItemInventoryMap", `${menuItemId}:${inventoryItemId}`, { menuItemId, inventoryItemId }, null);

    return { deleted: true };
  }

  // ── Helpers ──────────────────────────────────────────

  private async audit(
    tenantId: string, branchId: string, actorStaffId: string,
    actionCode: string, entityType: string, entityId: string,
    beforeJson: unknown, afterJson: unknown,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId, branchId, actorStaffId, actionCode, entityType, entityId,
        beforeJson: beforeJson as any, afterJson: afterJson as any,
      },
    });
  }

  private normalizeCategory(category: string | undefined) {
    const allowed = new Set([
      "VEGETABLES",
      "FRUITS",
      "MEAT",
      "SEAFOOD",
      "DAIRY",
      "GRAINS",
      "SPICES",
      "BEVERAGES",
      "PACKAGING",
      "OTHER",
    ]);
    const normalized = (category ?? "OTHER").trim().toUpperCase().replace(/[\s-]+/g, "_");
    return allowed.has(normalized) ? normalized : "OTHER";
  }
}
