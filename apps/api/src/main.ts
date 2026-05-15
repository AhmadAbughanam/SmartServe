import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import * as express from "express";
import { join } from "path";
import { AppModule } from "./app.module.js";
import { env } from "./config/env.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Serve uploaded files at /uploads/*
  app.use("/uploads", express.static(join(process.cwd(), "uploads")));

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: env.isDev
        ? false // Disable CSP in dev to avoid blocking Next.js HMR
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:", "blob:"],
              connectSrc: ["'self'", env.frontendOrigin],
            },
          },
      crossOriginEmbedderPolicy: false, // Allow SSE
    }),
  );

  // Cookie parsing
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: env.isDev ? true : env.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(env.port);
}

void bootstrap();
