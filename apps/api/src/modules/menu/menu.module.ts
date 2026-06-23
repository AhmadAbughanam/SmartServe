import { Module } from "@nestjs/common";
import { OBJECT_STORAGE } from "../../contracts/object-storage.js";
import { MenuController } from "./menu.controller.js";
import { MenuService } from "./menu.service.js";
import { S3ObjectStorageService } from "./s3-object-storage.service.js";

@Module({
  controllers: [MenuController],
  providers: [
    MenuService,
    S3ObjectStorageService,
    {
      provide: OBJECT_STORAGE,
      useExisting: S3ObjectStorageService,
    },
  ],
  exports: [MenuService],
})
export class MenuModule {}
