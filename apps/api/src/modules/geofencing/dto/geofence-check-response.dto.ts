import type {
  GeoFenceCheckResponse,
  GeoFenceResult,
} from "@smart-restaurant/shared-types";

export class GeoFenceCheckResponseDto implements GeoFenceCheckResponse {
  result!: GeoFenceResult;
  allowed!: boolean;
  branchId!: string;
  distanceMeters?: number;
  radiusMeters?: number;
  reason!: string;
}
