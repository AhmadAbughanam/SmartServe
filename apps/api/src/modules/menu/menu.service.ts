import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import type { CreateCategoryDto } from "./dto/create-category.dto.js";
import type { CreateMenuItemDto } from "./dto/create-menu-item.dto.js";
import type { UpdateMenuItemDto } from "./dto/update-menu-item.dto.js";

@Injectable()
export class MenuService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
  ) {}

  /**
   * Public menu browse: returns active categories with active, available items
   * scoped to a branch (including tenant-wide items where branchId is null).
   */
  async getMenuForBranch(
    branchId: string,
    filters?: { vegetarian?: boolean; spicy?: boolean; inStockOnly?: boolean },
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) throw new NotFoundException("Branch not found");

    // Build item-level where clause with optional filters
    const itemWhere: Record<string, unknown> = {
      isActive: true,
      OR: [{ branchId }, { branchId: null }],
    };
    if (filters?.vegetarian) itemWhere.isVegetarian = true;
    if (filters?.spicy) itemWhere.isSpicy = true;
    if (filters?.inStockOnly) itemWhere.isUnavailable = false;

    const categories = await this.prisma.category.findMany({
      where: {
        tenantId: branch.tenantId,
        isActive: true,
        OR: [{ branchId }, { branchId: null }],
      },
      orderBy: { displayOrder: "asc" },
      include: {
        menuItems: {
          where: itemWhere,
          orderBy: { name: "asc" },
          include: {
            additions: {
              where: { isActive: true },
              orderBy: { name: "asc" },
            },
          },
        },
      },
    });

    return categories;
  }

  async getItemById(itemId: string) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      include: {
        category: { select: { id: true, name: true } },
        additions: {
          where: { isActive: true },
          orderBy: { name: "asc" },
        },
      },
    });
    if (!item) throw new NotFoundException("Menu item not found");
    return item;
  }

  async listFavorites(userId: string, branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException("Branch not found");

    const favorites = await this.prisma.menuItemFavorite.findMany({
      where: { userId, branchId },
      orderBy: { createdAt: "desc" },
      select: {
        menuItemId: true,
        createdAt: true,
      },
    });

    return {
      branchId,
      favoriteMenuItemIds: favorites.map((favorite) => favorite.menuItemId),
      favorites: favorites.map((favorite) => ({
        menuItemId: favorite.menuItemId,
        createdAt: favorite.createdAt.toISOString(),
      })),
    };
  }

  async setFavorite(
    userId: string,
    itemId: string,
    input: { branchId: string; favorite: boolean },
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: input.branchId },
      select: { id: true, tenantId: true },
    });
    if (!branch) throw new NotFoundException("Branch not found");

    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        tenantId: true,
        branchId: true,
        isActive: true,
      },
    });
    if (
      !item ||
      !item.isActive ||
      item.tenantId !== branch.tenantId ||
      (item.branchId && item.branchId !== input.branchId)
    ) {
      throw new NotFoundException("Menu item not found");
    }

    if (!input.favorite) {
      await this.prisma.menuItemFavorite.deleteMany({
        where: {
          userId,
          menuItemId: itemId,
          branchId: input.branchId,
        },
      });
      return { menuItemId: itemId, branchId: input.branchId, favorite: false };
    }

    await this.prisma.menuItemFavorite.upsert({
      where: {
        userId_menuItemId_branchId: {
          userId,
          menuItemId: itemId,
          branchId: input.branchId,
        },
      },
      update: {},
      create: {
        userId,
        menuItemId: itemId,
        tenantId: branch.tenantId,
        branchId: input.branchId,
      },
    });

    return { menuItemId: itemId, branchId: input.branchId, favorite: true };
  }

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        branchId: dto.branchId,
        parentCategoryId: dto.parentCategoryId,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  async createMenuItem(tenantId: string, dto: CreateMenuItemDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category || category.tenantId !== tenantId) {
      throw new BadRequestException("Category not found in tenant");
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, tenantId },
      });
      if (!branch) throw new BadRequestException("Branch not found in tenant");
      if (category.branchId && category.branchId !== dto.branchId) {
        throw new BadRequestException("Category does not belong to selected branch");
      }
    }

    return this.prisma.menuItem.create({
      data: {
        tenantId,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        ingredients: dto.ingredients,
        price: dto.price,
        dietaryInfo: dto.dietaryInfo,
        isVegetarian: dto.isVegetarian ?? false,
        isSpicy: dto.isSpicy ?? false,
        prepTimeMinutes: dto.prepTimeMinutes,
        imageUrl: dto.imageUrl,
        taxClass: dto.taxClass,
        branchId: dto.branchId,
        additions: dto.additions?.length
          ? {
              create: dto.additions.map((a) => ({
                name: a.name,
                priceImpact: a.priceImpact,
                isRequired: a.isRequired ?? false,
                maxSelectable: a.maxSelectable,
              })),
            }
          : undefined,
      },
      include: { additions: true },
    });
  }

  async updateMenuItem(
    itemId: string,
    tenantId: string,
    dto: UpdateMenuItemDto,
  ) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.tenantId !== tenantId) {
      throw new NotFoundException("Menu item not found");
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category || category.tenantId !== tenantId) {
        throw new BadRequestException("Category not found in tenant");
      }
      if (category.branchId && item.branchId && category.branchId !== item.branchId) {
        throw new BadRequestException("Category does not belong to item branch");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.menuItem.update({
        where: { id: itemId },
        data: {
          categoryId: dto.categoryId,
          name: dto.name,
          description: dto.description,
          ingredients: dto.ingredients,
          price: dto.price,
          dietaryInfo: dto.dietaryInfo,
          isVegetarian: dto.isVegetarian,
          isSpicy: dto.isSpicy,
          prepTimeMinutes: dto.prepTimeMinutes,
          imageUrl: dto.imageUrl,
          taxClass: dto.taxClass,
          isActive: dto.isActive,
        },
        include: { additions: true },
      });

      if (dto.additions !== undefined) {
        await tx.menuItemAddition.deleteMany({ where: { menuItemId: itemId } });
        if (dto.additions.length > 0) {
          await tx.menuItemAddition.createMany({
            data: dto.additions.map((a) => ({
              menuItemId: itemId,
              name: a.name,
              priceImpact: a.priceImpact,
              isRequired: a.isRequired ?? false,
              maxSelectable: a.maxSelectable,
            })),
          });
        }
        return tx.menuItem.findUniqueOrThrow({
          where: { id: itemId },
          include: { additions: true },
        });
      }

      return updated;
    });
  }

  async updateAvailability(
    itemId: string,
    tenantId: string,
    isUnavailable: boolean,
  ) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.tenantId !== tenantId) {
      throw new NotFoundException("Menu item not found");
    }

    const updated = await this.prisma.menuItem.update({
      where: { id: itemId },
      data: { isUnavailable },
    });

    if (isUnavailable) {
      // Emit to all branches (branchId may be null for tenant-wide items)
      this.realtime.emit(
        "ITEM_86ED",
        tenantId,
        item.branchId ?? "",
        { menuItemId: itemId, name: item.name, isUnavailable: true },
      );
    }

    return updated;
  }
}
