import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { MenuService } from "./menu.service.js";
import { CreateCategoryDto } from "./dto/create-category.dto.js";
import { CreateMenuItemDto } from "./dto/create-menu-item.dto.js";
import { UpdateMenuItemDto } from "./dto/update-menu-item.dto.js";
import { UpdateAvailabilityDto } from "./dto/update-availability.dto.js";
import { SetFavoriteDto } from "./dto/favorite.dto.js";
import { Public } from "../auth/decorators/public.decorator.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedCustomer, AuthenticatedStaff } from "../auth/types/auth.types.js";

@Controller("menu")
export class MenuController {
  constructor(
    @Inject(MenuService) private readonly menuService: MenuService,
  ) {}

  /** Public customer menu browse — active items only, with optional filters. */
  @Public()
  @Get()
  getMenu(
    @Query("branchId") branchId: string,
    @Query("vegetarian") vegetarian?: string,
    @Query("spicy") spicy?: string,
    @Query("inStockOnly") inStockOnly?: string,
  ) {
    return this.menuService.getMenuForBranch(branchId, {
      vegetarian: vegetarian === "true",
      spicy: spicy === "true",
      inStockOnly: inStockOnly === "true",
    });
  }

  /** Public item detail. */
  @Public()
  @Get("items/:itemId")
  getItem(@Param("itemId") itemId: string) {
    return this.menuService.getItemById(itemId);
  }

  @Public()
  @Get("images/:imageKey")
  async getManagedImage(
    @Param("imageKey") imageKey: string,
    @Res({ passthrough: true }) res: any,
  ) {
    const image = await this.menuService.getManagedMenuImage(imageKey);
    res.setHeader("Content-Type", image.contentType ?? "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return new StreamableFile(image.body);
  }

  @Get("favorites")
  listFavorites(
    @Query("branchId") branchId: string,
    @CurrentUser() user: AuthenticatedCustomer,
  ) {
    return this.menuService.listFavorites(user.userId, branchId);
  }

  @Post("items/:itemId/favorite")
  setFavorite(
    @Param("itemId") itemId: string,
    @Body() body: SetFavoriteDto,
    @CurrentUser() user: AuthenticatedCustomer,
  ) {
    return this.menuService.setFavorite(user.userId, itemId, body);
  }

  @Post("categories")
  @RequirePermissions("menu:write")
  createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.menuService.createCategory(staff.tenantId, dto);
  }

  @Post("items")
  @RequirePermissions("menu:write")
  createItem(
    @Body() dto: CreateMenuItemDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.menuService.createMenuItem(staff.tenantId, dto);
  }

  @Patch("items/:itemId")
  @RequirePermissions("menu:write")
  updateItem(
    @Param("itemId") itemId: string,
    @Body() dto: UpdateMenuItemDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.menuService.updateMenuItem(itemId, staff.tenantId, dto);
  }

  @Patch("items/:itemId/availability")
  @RequirePermissions("menu:write")
  updateAvailability(
    @Param("itemId") itemId: string,
    @Body() dto: UpdateAvailabilityDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.menuService.updateAvailability(
      itemId,
      staff.tenantId,
      dto.isUnavailable,
    );
  }

  @Post("items/:itemId/image")
  @RequirePermissions("menu:write")
  @UseInterceptors(
    FileInterceptor("image", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
          cb(new BadRequestException("Only image files are allowed"), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async uploadImage(
    @Param("itemId") itemId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    if (!file) throw new BadRequestException("No image file provided");
    return this.menuService.storeMenuItemImage(itemId, staff.tenantId, file);
  }
}
