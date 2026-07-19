import type {
  MapPlace,
  PlaceSearchRequest,
  PlaceSearchResult,
  PlannedRoute,
  ReverseGeocodeRequest,
  RoutePlanningRequest,
} from "@pollycar/contracts";
import type { MapProvider, MapQuotaUsage } from "../ports/map-location.js";
import { validateGeoPoint } from "../adapters/synthetic-map-provider.js";

type CacheEntry<T> = Readonly<{ value: T; expiresAt: number }>;

export class MemoryMapQuotaUsage implements MapQuotaUsage {
  private readonly usage = new Map<string, number>();
  public read(service: "search" | "reverse_geocode" | "route"): number {
    return this.usage.get(service) ?? 0;
  }
  public increment(service: "search" | "reverse_geocode" | "route"): void {
    this.usage.set(service, this.read(service) + 1);
  }
}

export class MapLocationService {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly searchWindows = new Map<string, number[]>();

  public constructor(
    private readonly provider: MapProvider,
    private readonly quota: MapQuotaUsage,
    private readonly now: () => Date = () => new Date(),
    private readonly timeoutMilliseconds = 1_500,
    private readonly monthlyLimits = { search: 50_000, reverse_geocode: 3_000_000, route: 3_000_000 },
  ) {}

  public async search(accountId: string, request: PlaceSearchRequest): Promise<PlaceSearchResult> {
    const query = request.query.trim();
    if (query.length < 2 || request.limit < 1 || request.limit > 10) throw new Error("MAP_SEARCH_INVALID");
    if (request.biasLocation) validateGeoPoint(request.biasLocation);
    this.enforceRateLimit(accountId);
    this.enforceQuota("search");
    const key = `search:${request.cityCode ?? ""}:${query.toLocaleLowerCase()}:${request.limit}`;
    const cached = this.readCache<PlaceSearchResult>(key);
    if (cached) return { ...cached, cache: { ...cached.cache, hit: true } };
    const result = await this.singleFlight(key, () =>
      this.callProvider("search", () => this.provider.searchPlaces({ ...request, query })),
    );
    const value = {
      ...result,
      cache: { ...result.cache, hit: false, expiresAt: new Date(this.now().getTime() + 300_000).toISOString() },
    };
    this.writeCache(key, value, 300_000);
    return value;
  }

  public async reverseGeocode(request: ReverseGeocodeRequest): Promise<MapPlace> {
    validateGeoPoint(request.location);
    if (request.radiusMeters < 1 || request.radiusMeters > 1_000) throw new Error("MAP_REVERSE_GEOCODE_INVALID");
    this.enforceQuota("reverse_geocode");
    const key = `reverse:${grid(request.location.latitude)}:${grid(request.location.longitude)}`;
    const cached = this.readCache<MapPlace>(key);
    if (cached) return cached;
    const place = await this.singleFlight(key, () =>
      this.callProvider("reverse_geocode", () => this.provider.reverseGeocode(request)),
    );
    this.writeCache(key, place, 600_000);
    return place;
  }

  public async planRoute(request: RoutePlanningRequest): Promise<PlannedRoute> {
    validateGeoPoint(request.origin);
    validateGeoPoint(request.destination);
    this.enforceQuota("route");
    const key = `route:${pointKey(request.origin)}:${pointKey(request.destination)}:${request.strategy}:${request.includeTraffic}`;
    const cached = this.readCache<PlannedRoute>(key);
    if (cached) return cached;
    const route = await this.singleFlight(key, () =>
      this.callProvider("route", () => this.provider.planDrivingRoute(request)),
    );
    this.writeCache(key, route, 60_000);
    return route;
  }

  public quotaState(service: keyof typeof this.monthlyLimits): "normal" | "warning" | "restricted" | "degraded" {
    const ratio = this.quota.read(service) / this.monthlyLimits[service];
    if (ratio >= 0.95) return "degraded";
    if (ratio >= 0.85) return "restricted";
    if (ratio >= 0.7) return "warning";
    return "normal";
  }

  private async callProvider<T>(
    service: keyof typeof this.monthlyLimits,
    operation: () => Promise<T>,
  ): Promise<T> {
    this.quota.increment(service);
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("MAP_PROVIDER_TIMEOUT")), this.timeoutMilliseconds),
        ),
      ]);
    } catch (error) {
      if (error instanceof Error && (error.message.startsWith("MAP_") || error.message.startsWith("AMAP_"))) {
        throw error;
      }
      throw new Error("MAP_PROVIDER_UNAVAILABLE");
    }
  }

  private enforceRateLimit(accountId: string): void {
    const now = this.now().getTime();
    const active = (this.searchWindows.get(accountId) ?? []).filter((value) => now - value < 60_000);
    if (active.length >= 10) throw new Error("MAP_SEARCH_RATE_LIMITED");
    active.push(now);
    this.searchWindows.set(accountId, active);
  }

  private enforceQuota(service: keyof typeof this.monthlyLimits): void {
    if (this.quotaState(service) === "degraded") throw new Error("MAP_QUOTA_DEGRADED");
  }

  private readCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now().getTime()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private writeCache<T>(key: string, value: T, ttl: number): void {
    this.cache.set(key, { value, expiresAt: this.now().getTime() + ttl });
  }

  private async singleFlight<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const pending = operation().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, pending);
    return pending;
  }
}

function grid(value: number): string {
  return (Math.round(value * 1_000) / 1_000).toFixed(3);
}

function pointKey(point: { latitude: number; longitude: number; coordinateSystem: string }): string {
  return `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)},${point.coordinateSystem}`;
}
