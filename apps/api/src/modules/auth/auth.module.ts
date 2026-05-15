import { Global, Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { env } from "../../config/env.js";
import { AuthController } from "./auth.controller.js";
import { CustomerAuthController } from "./customer-auth.controller.js";
import { AuthService } from "./auth.service.js";
import { CustomerAuthService } from "./customer-auth.service.js";
import { TokenService } from "./token.service.js";
import { BranchAccessService } from "./branch-access.service.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { PermissionsGuard } from "./guards/permissions.guard.js";
import { LogsModule } from "../logs/logs.module.js";

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: env.jwtSecret,
    }),
    LogsModule,
  ],
  controllers: [AuthController, CustomerAuthController],
  providers: [
    AuthService,
    CustomerAuthService,
    TokenService,
    BranchAccessService,
    {
      provide: APP_GUARD,
      useFactory: (
        reflector: Reflector,
        tokenService: TokenService,
        authService: AuthService,
        customerAuthService: CustomerAuthService,
      ) =>
        new JwtAuthGuard(
          reflector,
          tokenService,
          authService,
          customerAuthService,
        ),
      inject: [Reflector, TokenService, AuthService, CustomerAuthService],
    },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector) => new PermissionsGuard(reflector),
      inject: [Reflector],
    },
  ],
  exports: [AuthService, CustomerAuthService, TokenService, BranchAccessService],
})
export class AuthModule {}
