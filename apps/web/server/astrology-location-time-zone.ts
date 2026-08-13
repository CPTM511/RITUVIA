import "server-only";

import { createHmac } from "node:crypto";

import {
  AstrologyLocationTimeZoneError,
  canonicalizeAstrologyLocationSearchRequestV1,
  parseAstrologyLocationSearchRequestV1,
  type AstrologyLocalTimeResolutionResultV1,
  type AstrologyLocationSelectionResultV1,
  type AstrologyLocationSearchResultV1,
  type AstrologyLocationTimeZoneAdapterV1,
  type AstrologyTimeZoneLocalPartsV1,
  type AstrologyTimeZoneRuntimeV1,
} from "@rituvia/divination";

export const webAstrologyLocationCacheSchemaVersion = "web-astrology-location-cache.v1" as const;
export const webAstrologyLocationMaximumCacheEntries = 64;
export const webAstrologyLocationMaximumTimeoutMilliseconds = 10_000;
export const webAstrologyLocationMinimumCacheSecretLength = 32;
export const webAstrologyTimeZoneRuntimePin = Object.freeze({
  icuVersion: "78.3",
  runtimeVersion: "26.5.1",
  timeZoneDataVersion: "2026b",
});

type CacheEntry = Readonly<{
  expiresAt: number;
  result: Promise<AstrologyLocationSearchResultV1>;
}>;

export type WebAstrologyLocationTimeZoneService = Readonly<{
  cacheSize(): number;
  readLocation(locationId: string): Promise<AstrologyLocationSelectionResultV1>;
  resolve(value: unknown): Promise<AstrologyLocalTimeResolutionResultV1>;
  search(value: unknown): Promise<AstrologyLocationSearchResultV1>;
}>;

export type WebAstrologyLocationTimeZoneServiceDependencies = Readonly<{
  adapter: AstrologyLocationTimeZoneAdapterV1;
  cacheSecret: string;
  clock(): number;
  maximumCacheEntries?: number;
  timeoutMilliseconds?: number;
}>;

const parseIntegerPart = (value: string | undefined): number => {
  if (value === undefined || !/^\d{1,4}$/u.test(value)) {
    throw new AstrologyLocationTimeZoneError("ASTROLOGY_TIME_ZONE_RUNTIME_INVALID");
  }
  return Number.parseInt(value, 10);
};

const formatLocalParts = (
  timeZoneId: string,
  utcEpochMilliseconds: number,
): AstrologyTimeZoneLocalPartsV1 => {
  if (!Number.isSafeInteger(utcEpochMilliseconds)) {
    throw new AstrologyLocationTimeZoneError("ASTROLOGY_TIME_ZONE_RUNTIME_INVALID");
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timeZoneId,
    year: "numeric",
  });
  let year: string | undefined;
  let month: string | undefined;
  let day: string | undefined;
  let hour: string | undefined;
  let minute: string | undefined;
  let second: string | undefined;
  for (const part of formatter.formatToParts(new Date(utcEpochMilliseconds))) {
    switch (part.type) {
      case "year":
        year = part.value;
        break;
      case "month":
        month = part.value;
        break;
      case "day":
        day = part.value;
        break;
      case "hour":
        hour = part.value;
        break;
      case "minute":
        minute = part.value;
        break;
      case "second":
        second = part.value;
        break;
    }
  }
  return Object.freeze({
    day: parseIntegerPart(day),
    hour: parseIntegerPart(hour),
    minute: parseIntegerPart(minute),
    month: parseIntegerPart(month),
    second: parseIntegerPart(second),
    year: parseIntegerPart(year),
  });
};

export const loadWebNodeIntlTimeZoneRuntimeV1 = (): AstrologyTimeZoneRuntimeV1 => {
  const runtimeVersion = process.versions.node;
  const icuVersion = process.versions.icu;
  const timeZoneDataVersion = process.versions.tz;
  if (
    runtimeVersion === undefined ||
    icuVersion === undefined ||
    timeZoneDataVersion === undefined ||
    runtimeVersion !== webAstrologyTimeZoneRuntimePin.runtimeVersion ||
    icuVersion !== webAstrologyTimeZoneRuntimePin.icuVersion ||
    timeZoneDataVersion !== webAstrologyTimeZoneRuntimePin.timeZoneDataVersion
  ) {
    throw new AstrologyLocationTimeZoneError("ASTROLOGY_TIME_ZONE_RUNTIME_UNAVAILABLE");
  }
  return Object.freeze({
    canonicalizeTimeZone(timeZoneId: string): string {
      return new Intl.DateTimeFormat("en", { timeZone: timeZoneId }).resolvedOptions().timeZone;
    },
    formatLocalParts,
    metadata: Object.freeze({
      icuVersion,
      runtimeId: "node_intl",
      runtimeVersion,
      timeZoneDataVersion,
    }),
  });
};

export const createWebAstrologyLocationSearchCacheKey = (
  cacheSecret: string,
  adapter: AstrologyLocationTimeZoneAdapterV1,
  value: unknown,
): string => {
  if (
    typeof cacheSecret !== "string" ||
    cacheSecret.length < webAstrologyLocationMinimumCacheSecretLength
  ) {
    throw new AstrologyLocationTimeZoneError("ASTROLOGY_LOCATION_INPUT_INVALID");
  }
  const request = parseAstrologyLocationSearchRequestV1(value);
  const canonical = JSON.stringify({
    adapterVersion: adapter.provider.adapterVersion,
    dataSha256: adapter.provider.dataSha256,
    dataVersion: adapter.provider.dataVersion,
    providerId: adapter.provider.providerId,
    providerVersion: adapter.provider.providerVersion,
    request: canonicalizeAstrologyLocationSearchRequestV1(request),
    schemaVersion: webAstrologyLocationCacheSchemaVersion,
  });
  return `hmac-sha256:${createHmac("sha256", cacheSecret).update(canonical).digest("hex")}`;
};

const boundedInteger = (
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  const candidate = value ?? fallback;
  if (!Number.isSafeInteger(candidate) || candidate < minimum || candidate > maximum) {
    throw new AstrologyLocationTimeZoneError("ASTROLOGY_LOCATION_INPUT_INVALID");
  }
  return candidate;
};

export const createWebAstrologyLocationTimeZoneService = (
  dependencies: WebAstrologyLocationTimeZoneServiceDependencies,
): WebAstrologyLocationTimeZoneService => {
  const maximumCacheEntries = boundedInteger(
    dependencies.maximumCacheEntries,
    webAstrologyLocationMaximumCacheEntries,
    1,
    webAstrologyLocationMaximumCacheEntries,
  );
  const timeoutMilliseconds = boundedInteger(
    dependencies.timeoutMilliseconds,
    webAstrologyLocationMaximumTimeoutMilliseconds,
    100,
    webAstrologyLocationMaximumTimeoutMilliseconds,
  );
  if (
    typeof dependencies.cacheSecret !== "string" ||
    dependencies.cacheSecret.length < webAstrologyLocationMinimumCacheSecretLength
  ) {
    throw new AstrologyLocationTimeZoneError("ASTROLOGY_LOCATION_INPUT_INVALID");
  }
  const cache = new Map<string, CacheEntry>();

  const evictExpired = (now: number): void => {
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(key);
    }
  };

  const evictOldest = (): void => {
    while (cache.size >= maximumCacheEntries) {
      const oldestKey = cache.keys().next().value;
      if (typeof oldestKey !== "string") return;
      cache.delete(oldestKey);
    }
  };

  const withTimeout = async <Value>(
    operation: (cancellation: AbortSignal) => Promise<Value>,
  ): Promise<Value> => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutResult = new Promise<Value>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new AstrologyLocationTimeZoneError("ASTROLOGY_LOCATION_PROVIDER_UNAVAILABLE"));
      }, timeoutMilliseconds);
    });
    try {
      return await Promise.race([operation(controller.signal), timeoutResult]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  };

  return Object.freeze({
    cacheSize: () => cache.size,
    readLocation: (locationId: string) =>
      withTimeout((cancellation) =>
        dependencies.adapter.readLocation(locationId, { cancellation }),
      ),
    resolve: (value: unknown) =>
      withTimeout((cancellation) => dependencies.adapter.resolve(value, { cancellation })),
    async search(value: unknown) {
      const request = parseAstrologyLocationSearchRequestV1(value);
      const key = createWebAstrologyLocationSearchCacheKey(
        dependencies.cacheSecret,
        dependencies.adapter,
        request,
      );
      const now = dependencies.clock();
      if (!Number.isSafeInteger(now) || now < 0) {
        throw new AstrologyLocationTimeZoneError("ASTROLOGY_LOCATION_INPUT_INVALID");
      }
      evictExpired(now);
      const existing = cache.get(key);
      if (existing !== undefined) return existing.result;

      evictOldest();
      const result = withTimeout((cancellation) =>
        dependencies.adapter.search(request, { cancellation }),
      );
      cache.set(
        key,
        Object.freeze({
          expiresAt: now + dependencies.adapter.provider.privateSearchCacheTtlSeconds * 1_000,
          result,
        }),
      );
      try {
        return await result;
      } catch (error) {
        cache.delete(key);
        throw error;
      }
    },
  });
};
