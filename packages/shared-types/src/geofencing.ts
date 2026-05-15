export const geoFenceResults = [
  "ALLOWED",
  "DENIED",
  "SKIPPED",
  "UNAVAILABLE",
] as const;

export type GeoFenceResult = (typeof geoFenceResults)[number];

export const geoFenceActions = [
  "START_TABLE_SESSION",
  "STAFF_CHECK_IN",
  "WAITER_ACTION",
] as const;

export type GeoFenceAction = (typeof geoFenceActions)[number];

export interface GeoFenceLocationInput {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

export interface GeoFenceCheckRequest {
  branchId: string;
  sessionId?: string;
  userId?: string;
  action: GeoFenceAction;
  location?: GeoFenceLocationInput;
}

export interface GeoFenceCheckResponse {
  result: GeoFenceResult;
  allowed: boolean;
  branchId: string;
  distanceMeters?: number;
  radiusMeters?: number;
  reason: string;
}
