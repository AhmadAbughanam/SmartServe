import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  GeoFenceAction,
  GeoFenceCheckResponse,
  GeoFenceLocationInput,
  GeoFenceResult,
} from "@smart-restaurant/shared-types";
import type { Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { LogsService } from "../logs/logs.service.js";

type CheckInput = {
  branchId: string;
  sessionId?: string;
  userId?: string;
  action: GeoFenceAction;
  location?: GeoFenceLocationInput;
};

const EARTH_RADIUS_M = 6_371_000;

@Injectable()
export class GeoFencingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogsService) private readonly logsService: LogsService,
  ) {}

  async check(input: CheckInput): Promise<GeoFenceCheckResponse> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: input.branchId },
      select: {
        id: true,
        tenantId: true,
        latitude: true,
        longitude: true,
        geofenceRadiusM: true,
        geofenceEnabled: true,
      },
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    let response: GeoFenceCheckResponse;

    if (!env.geofencingEnabled) {
      response = this.response("SKIPPED", true, branch.id, "GEOFENCING_DISABLED");
    } else if (env.geofencingDemoBypass && !env.isProd) {
      response = this.response("SKIPPED", true, branch.id, "DEMO_BYPASS");
    } else if (!branch.geofenceEnabled) {
      response = this.response("SKIPPED", true, branch.id, "BRANCH_GEOFENCING_DISABLED");
    } else if (branch.latitude === null || branch.longitude === null) {
      response = this.response("UNAVAILABLE", false, branch.id, "BRANCH_LOCATION_UNAVAILABLE", undefined, branch.geofenceRadiusM);
    } else {
      response = this.evaluateEnabledBranch({
        branchId: branch.id,
        branchLatitude: Number(branch.latitude),
        branchLongitude: Number(branch.longitude),
        radiusMeters: branch.geofenceRadiusM,
        location: input.location,
      });
    }

    await this.logDecision({
      tenantId: branch.tenantId,
      branchId: branch.id,
      sessionId: input.sessionId,
      userId: input.userId,
      action: input.action,
      response,
      accuracyMeters: input.location?.accuracyMeters,
    });

    return response;
  }

  async enforceStartTableSession(input: Omit<CheckInput, "action">) {
    const response = await this.check({ ...input, action: "START_TABLE_SESSION" });
    if (response.allowed) return response;

    const details = {
      code: this.errorCodeFor(response),
      details: {
        action: "START_TABLE_SESSION",
        result: response.result,
        distanceMeters: response.distanceMeters,
        radiusMeters: response.radiusMeters,
      },
    };

    if (response.result === "DENIED") {
      throw new ForbiddenException({
        message: response.reason,
        ...details,
      });
    }

    throw new BadRequestException({
      message: response.reason,
      ...details,
    });
  }

  private evaluateEnabledBranch(input: {
    branchId: string;
    branchLatitude: number;
    branchLongitude: number;
    radiusMeters: number;
    location?: GeoFenceLocationInput;
  }): GeoFenceCheckResponse {
    if (!input.location) {
      return this.response("DENIED", false, input.branchId, "LOCATION_REQUIRED", undefined, input.radiusMeters);
    }

    const { latitude, longitude, accuracyMeters } = input.location;
    if (!this.validCoordinate(latitude, -90, 90) || !this.validCoordinate(longitude, -180, 180)) {
      return this.response("DENIED", false, input.branchId, "INVALID_LOCATION", undefined, input.radiusMeters);
    }

    if (accuracyMeters !== undefined && (!Number.isFinite(accuracyMeters) || accuracyMeters < 0)) {
      return this.response("DENIED", false, input.branchId, "INVALID_LOCATION_ACCURACY", undefined, input.radiusMeters);
    }

    if (accuracyMeters !== undefined && accuracyMeters > env.geofencingMaxAccuracyM) {
      return this.response("UNAVAILABLE", false, input.branchId, "LOW_ACCURACY", undefined, input.radiusMeters);
    }

    const distanceMeters = Math.round(
      this.haversineDistanceMeters(
        input.branchLatitude,
        input.branchLongitude,
        latitude,
        longitude,
      ),
    );

    if (distanceMeters <= input.radiusMeters) {
      return this.response("ALLOWED", true, input.branchId, "INSIDE_RADIUS", distanceMeters, input.radiusMeters);
    }

    return this.response("DENIED", false, input.branchId, "OUTSIDE_RADIUS", distanceMeters, input.radiusMeters);
  }

  haversineDistanceMeters(
    fromLatitude: number,
    fromLongitude: number,
    toLatitude: number,
    toLongitude: number,
  ) {
    const lat1 = this.toRadians(fromLatitude);
    const lat2 = this.toRadians(toLatitude);
    const deltaLat = this.toRadians(toLatitude - fromLatitude);
    const deltaLon = this.toRadians(toLongitude - fromLongitude);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_M * c;
  }

  private toRadians(degrees: number) {
    return (degrees * Math.PI) / 180;
  }

  private validCoordinate(value: number, min: number, max: number) {
    return Number.isFinite(value) && value >= min && value <= max;
  }

  private response(
    result: GeoFenceResult,
    allowed: boolean,
    branchId: string,
    reason: string,
    distanceMeters?: number,
    radiusMeters?: number,
  ): GeoFenceCheckResponse {
    return {
      result,
      allowed,
      branchId,
      ...(distanceMeters !== undefined ? { distanceMeters } : {}),
      ...(radiusMeters !== undefined ? { radiusMeters } : {}),
      reason,
    };
  }

  private errorCodeFor(response: GeoFenceCheckResponse) {
    switch (response.reason) {
      case "LOCATION_REQUIRED":
        return "GEOFENCE_LOCATION_REQUIRED";
      case "INVALID_LOCATION":
      case "INVALID_LOCATION_ACCURACY":
        return "GEOFENCE_INVALID_LOCATION";
      case "LOW_ACCURACY":
        return "GEOFENCE_LOCATION_LOW_ACCURACY";
      case "OUTSIDE_RADIUS":
        return "GEOFENCE_OUTSIDE_RADIUS";
      default:
        return "GEOFENCE_UNAVAILABLE";
    }
  }

  private async logDecision(input: {
    tenantId: string;
    branchId: string;
    sessionId?: string;
    userId?: string;
    action: GeoFenceAction;
    response: GeoFenceCheckResponse;
    accuracyMeters?: number;
  }) {
    const suffix = input.response.allowed
      ? "ALLOWED"
      : input.response.result === "DENIED"
        ? "DENIED"
        : input.response.result;

    const metadata: Prisma.InputJsonObject = {
      action: input.action,
      result: input.response.result,
      allowed: input.response.allowed,
      reason: input.response.reason,
      ...(input.response.distanceMeters !== undefined
        ? { distanceMeters: input.response.distanceMeters }
        : {}),
      ...(input.response.radiusMeters !== undefined
        ? { radiusMeters: input.response.radiusMeters }
        : {}),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.accuracyMeters !== undefined
        ? { accuracyMeters: Math.round(input.accuracyMeters) }
        : {}),
    };

    await this.logsService.writeOperational({
      tenantId: input.tenantId,
      branchId: input.branchId,
      sessionId: input.sessionId,
      eventType: `GEOFENCE_CHECK_${suffix}`,
      severity: input.response.allowed ? "INFO" : "WARN",
      message: `Geofence ${input.action} ${input.response.reason}`,
      metadata,
    });
  }
}
