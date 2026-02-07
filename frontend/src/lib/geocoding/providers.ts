import type { AutocompleteSuggestion } from "../types";
import type {
  GeocodeResult,
  GeocodingClient,
  GeocodingProviderName,
  GeocodingScope,
} from "./types";

const GEOCODE_EARTH_BASE_URL = "https://api.geocode.earth/v1";
const MAPBOX_BASE_URL = "https://api.mapbox.com/search/geocode/v6";
const GEOAPIFY_BASE_URL = "https://api.geoapify.com/v1/geocode";
const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";
const GOOGLE_GEOCODING_V4_BASE_URL = "https://geocode.googleapis.com/v4beta/geocode";
const REQUEST_TIMEOUT_MS = 10000;

interface FetchJsonOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
}

function getEnvOrThrow(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return normalized;
}

function getJsonValue(source: Record<string, unknown> | undefined, keys: string[]): string {
  if (!source) return "";

  for (const key of keys) {
    const val = source[key];
    if (typeof val === "string" && val.trim().length > 0) {
      return val;
    }
  }

  return "";
}

function getPrimaryItemOrThrow<T>(items: T[] | undefined): T {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Address not found");
  }
  return items[0];
}

function inBounds(
  lat: number,
  lng: number,
  bounds: GeocodingScope["bounds"]
): boolean {
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  );
}

function coerceCoordinates(value: unknown): { lat: number; lng: number } | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lng = Number(value[0]);
  const lat = Number(value[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

async function fetchJson(url: string, options: FetchJsonOptions = {}): Promise<unknown> {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: options.headers,
    body: options.body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!response.ok) {
    const details = getJsonValue(payload || undefined, ["message", "error_message"]);
    const suffix = details ? `: ${details}` : "";
    throw new Error(`Geocoding request failed (${response.status})${suffix}`);
  }

  return payload;
}

function normalizeAutocompleteResults(
  features: unknown[],
  addressGetter: (feature: Record<string, unknown>) => string,
  scope: GeocodingScope
): AutocompleteSuggestion[] {
  const results: AutocompleteSuggestion[] = [];

  for (const feature of features) {
    if (!feature || typeof feature !== "object") continue;
    const featureObj = feature as Record<string, unknown>;
    const geometry = featureObj.geometry as Record<string, unknown> | undefined;
    const coords = coerceCoordinates(geometry?.coordinates);
    const address = addressGetter(featureObj);

    if (!coords || !address) continue;
    if (!inBounds(coords.lat, coords.lng, scope.bounds)) continue;
    results.push({ address, lat: coords.lat, lng: coords.lng });
  }

  return results.slice(0, scope.autocompleteLimit);
}

function createGeocodeEarthClient(scope: GeocodingScope): GeocodingClient {
  const apiKey = getEnvOrThrow(
    "GEOCODE_EARTH_API_KEY",
    process.env.GEOCODE_EARTH_API_KEY || process.env.NEXT_PUBLIC_GEOCODE_EARTH_API_KEY
  );

  return {
    provider: "geocode-earth",
    async geocodeAddress(address: string): Promise<GeocodeResult> {
      const params = new URLSearchParams({
        api_key: apiKey,
        text: address,
        "boundary.country": scope.countryCode,
        "focus.point.lat": String(scope.focusPoint.lat),
        "focus.point.lon": String(scope.focusPoint.lng),
        layers: "address",
        size: "1",
      });

      const data = (await fetchJson(`${GEOCODE_EARTH_BASE_URL}/search?${params}`)) as {
        features?: unknown[];
      };
      const feature = getPrimaryItemOrThrow(data.features);
      const featureObj = feature as Record<string, unknown>;
      const geometry = featureObj.geometry as Record<string, unknown> | undefined;
      const props = featureObj.properties as Record<string, unknown> | undefined;
      const coords = coerceCoordinates(geometry?.coordinates);
      const matchedAddress = getJsonValue(props, ["label"]);

      if (!coords || !matchedAddress) {
        throw new Error("Address not found");
      }

      return { lat: coords.lat, lng: coords.lng, matchedAddress };
    },

    async autocompleteAddress(query: string): Promise<AutocompleteSuggestion[]> {
      const params = new URLSearchParams({
        api_key: apiKey,
        text: query,
        "boundary.rect.min_lat": String(scope.bounds.minLat),
        "boundary.rect.max_lat": String(scope.bounds.maxLat),
        "boundary.rect.min_lon": String(scope.bounds.minLng),
        "boundary.rect.max_lon": String(scope.bounds.maxLng),
        "focus.point.lat": String(scope.focusPoint.lat),
        "focus.point.lon": String(scope.focusPoint.lng),
        layers: "address",
        size: String(scope.autocompleteLimit),
      });

      const data = (await fetchJson(`${GEOCODE_EARTH_BASE_URL}/autocomplete?${params}`)) as {
        features?: unknown[];
      };

      return normalizeAutocompleteResults(
        data.features || [],
        (feature) => {
          const props = feature.properties as Record<string, unknown> | undefined;
          return getJsonValue(props, ["label"]);
        },
        scope
      );
    },

    async reverseGeocode(lat: number, lng: number): Promise<string | null> {
      const params = new URLSearchParams({
        api_key: apiKey,
        "point.lat": String(lat),
        "point.lon": String(lng),
        size: "1",
      });

      const data = (await fetchJson(`${GEOCODE_EARTH_BASE_URL}/reverse?${params}`)) as {
        features?: unknown[];
      };
      const feature = (data.features || [])[0];
      if (!feature || typeof feature !== "object") return null;

      const props = (feature as Record<string, unknown>).properties as
        | Record<string, unknown>
        | undefined;
      const address = getJsonValue(props, ["label"]);
      return address || null;
    },
  };
}

function createMapboxClient(scope: GeocodingScope): GeocodingClient {
  const apiKey = getEnvOrThrow("MAPBOX_ACCESS_TOKEN", process.env.MAPBOX_ACCESS_TOKEN);
  const bbox = `${scope.bounds.minLng},${scope.bounds.minLat},${scope.bounds.maxLng},${scope.bounds.maxLat}`;
  const proximity = `${scope.focusPoint.lng},${scope.focusPoint.lat}`;

  function mapboxAddress(feature: Record<string, unknown>): string {
    const props = feature.properties as Record<string, unknown> | undefined;
    return (
      getJsonValue(props, ["full_address", "name"]) ||
      getJsonValue(feature, ["place_name", "text"])
    );
  }

  return {
    provider: "mapbox",
    async geocodeAddress(address: string): Promise<GeocodeResult> {
      const params = new URLSearchParams({
        q: address,
        country: scope.countryCode.toLowerCase(),
        types: "address,street",
        proximity,
        bbox,
        limit: "1",
        autocomplete: "false",
        access_token: apiKey,
      });

      const data = (await fetchJson(`${MAPBOX_BASE_URL}/forward?${params}`)) as {
        features?: unknown[];
      };
      const feature = getPrimaryItemOrThrow(data.features) as Record<string, unknown>;
      const geometry = feature.geometry as Record<string, unknown> | undefined;
      const coords = coerceCoordinates(geometry?.coordinates);
      const matchedAddress = mapboxAddress(feature);

      if (!coords || !matchedAddress) {
        throw new Error("Address not found");
      }

      return { lat: coords.lat, lng: coords.lng, matchedAddress };
    },

    async autocompleteAddress(query: string): Promise<AutocompleteSuggestion[]> {
      const params = new URLSearchParams({
        q: query,
        country: scope.countryCode.toLowerCase(),
        types: "address,street",
        proximity,
        bbox,
        limit: String(scope.autocompleteLimit),
        autocomplete: "true",
        access_token: apiKey,
      });

      const data = (await fetchJson(`${MAPBOX_BASE_URL}/forward?${params}`)) as {
        features?: unknown[];
      };

      return normalizeAutocompleteResults(data.features || [], mapboxAddress, scope);
    },

    async reverseGeocode(lat: number, lng: number): Promise<string | null> {
      const params = new URLSearchParams({
        longitude: String(lng),
        latitude: String(lat),
        limit: "1",
        access_token: apiKey,
      });

      const data = (await fetchJson(`${MAPBOX_BASE_URL}/reverse?${params}`)) as {
        features?: unknown[];
      };
      const feature = (data.features || [])[0];
      if (!feature || typeof feature !== "object") return null;
      const matchedAddress = mapboxAddress(feature as Record<string, unknown>);
      return matchedAddress || null;
    },
  };
}

function buildGeoapifyFilter(scope: GeocodingScope): string {
  const rect = `rect:${scope.bounds.minLng},${scope.bounds.minLat},${scope.bounds.maxLng},${scope.bounds.maxLat}`;
  const country = `countrycode:${scope.countryCode.toLowerCase()}`;
  const state = `statecode:${scope.countryCode.toLowerCase()}-${scope.stateCode.toLowerCase()}`;
  return `${rect}|${state}|${country}`;
}

function createGeoapifyClient(scope: GeocodingScope): GeocodingClient {
  const apiKey = getEnvOrThrow("GEOAPIFY_API_KEY", process.env.GEOAPIFY_API_KEY);
  const filter = buildGeoapifyFilter(scope);
  const bias = `proximity:${scope.focusPoint.lng},${scope.focusPoint.lat}`;

  function toSuggestion(result: Record<string, unknown>): AutocompleteSuggestion | null {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    const address = getJsonValue(result, ["formatted", "address_line1", "address_line2"]);

    if (Number.isNaN(lat) || Number.isNaN(lng) || !address) {
      return null;
    }
    if (!inBounds(lat, lng, scope.bounds)) {
      return null;
    }

    return { address, lat, lng };
  }

  return {
    provider: "geoapify",
    async geocodeAddress(address: string): Promise<GeocodeResult> {
      const params = new URLSearchParams({
        text: address,
        filter,
        bias,
        limit: "1",
        apiKey,
      });

      const data = (await fetchJson(`${GEOAPIFY_BASE_URL}/search?${params}`)) as {
        results?: unknown[];
      };
      const first = getPrimaryItemOrThrow(data.results) as Record<string, unknown>;
      const suggestion = toSuggestion(first);
      if (!suggestion) {
        throw new Error("Address not found");
      }

      return {
        lat: suggestion.lat,
        lng: suggestion.lng,
        matchedAddress: suggestion.address,
      };
    },

    async autocompleteAddress(query: string): Promise<AutocompleteSuggestion[]> {
      const params = new URLSearchParams({
        text: query,
        filter,
        bias,
        limit: String(scope.autocompleteLimit),
        apiKey,
      });

      const data = (await fetchJson(`${GEOAPIFY_BASE_URL}/autocomplete?${params}`)) as {
        results?: unknown[];
      };
      const results = Array.isArray(data.results) ? data.results : [];

      return results
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          return toSuggestion(item as Record<string, unknown>);
        })
        .filter((item): item is AutocompleteSuggestion => item !== null)
        .slice(0, scope.autocompleteLimit);
    },

    async reverseGeocode(lat: number, lng: number): Promise<string | null> {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        apiKey,
      });

      const data = (await fetchJson(`${GEOAPIFY_BASE_URL}/reverse?${params}`)) as {
        results?: unknown[];
      };
      const first = (data.results || [])[0];
      if (!first || typeof first !== "object") return null;
      const address = getJsonValue(first as Record<string, unknown>, [
        "formatted",
        "address_line1",
      ]);
      return address || null;
    },
  };
}

function googleHeaders(
  apiKey: string,
  fieldMask: string,
  includeJsonContentType = false
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Goog-Api-Key": apiKey,
    "X-Goog-FieldMask": fieldMask,
  };
  if (includeJsonContentType) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

function toGooglePlaceResource(placePrediction: Record<string, unknown>): string | null {
  const placeResource = getJsonValue(placePrediction, ["place"]);
  if (placeResource.startsWith("places/")) {
    return placeResource;
  }

  const placeId = getJsonValue(placePrediction, ["placeId"]);
  if (placeId) {
    return `places/${placeId}`;
  }

  return null;
}

function buildGoogleLocationBiasParams(scope: GeocodingScope): URLSearchParams {
  const params = new URLSearchParams();
  params.set("regionCode", scope.countryCode.toLowerCase());
  params.set("locationBias.rectangle.low.latitude", String(scope.bounds.minLat));
  params.set("locationBias.rectangle.low.longitude", String(scope.bounds.minLng));
  params.set("locationBias.rectangle.high.latitude", String(scope.bounds.maxLat));
  params.set("locationBias.rectangle.high.longitude", String(scope.bounds.maxLng));
  return params;
}

function createGoogleMapsClient(scope: GeocodingScope): GeocodingClient {
  const apiKey = getEnvOrThrow("GOOGLE_MAPS_API_KEY", process.env.GOOGLE_MAPS_API_KEY);

  async function getPlaceSuggestion(placeResource: string): Promise<AutocompleteSuggestion | null> {
    const data = (await fetchJson(`${GOOGLE_PLACES_BASE_URL}/${placeResource}`, {
      headers: googleHeaders(apiKey, "formattedAddress,location"),
    })) as Record<string, unknown>;

    const location = data.location as Record<string, unknown> | undefined;
    const lat = Number(location?.latitude);
    const lng = Number(location?.longitude);
    const address = typeof data.formattedAddress === "string" ? data.formattedAddress : "";

    if (Number.isNaN(lat) || Number.isNaN(lng) || !address) {
      return null;
    }
    if (!inBounds(lat, lng, scope.bounds)) {
      return null;
    }
    return { address, lat, lng };
  }

  return {
    provider: "google-maps",
    async geocodeAddress(address: string): Promise<GeocodeResult> {
      const params = buildGoogleLocationBiasParams(scope);
      params.set("addressQuery", address);

      const data = (await fetchJson(
        `${GOOGLE_GEOCODING_V4_BASE_URL}/address?${params}`,
        {
          headers: googleHeaders(apiKey, "results.formattedAddress,results.location"),
        }
      )) as Record<string, unknown>;
      const results = Array.isArray(data.results) ? data.results : [];
      const first = getPrimaryItemOrThrow(results) as Record<string, unknown>;
      const location = first.location as Record<string, unknown> | undefined;
      const lat = Number(location?.latitude);
      const lng = Number(location?.longitude);
      const matchedAddress =
        typeof first.formattedAddress === "string" ? first.formattedAddress : "";

      if (Number.isNaN(lat) || Number.isNaN(lng) || !matchedAddress) {
        throw new Error("Address not found");
      }

      return { lat, lng, matchedAddress };
    },

    async autocompleteAddress(query: string): Promise<AutocompleteSuggestion[]> {
      const requestBody = {
        input: query,
        includedRegionCodes: [scope.countryCode.toLowerCase()],
        locationRestriction: {
          rectangle: {
            low: {
              latitude: scope.bounds.minLat,
              longitude: scope.bounds.minLng,
            },
            high: {
              latitude: scope.bounds.maxLat,
              longitude: scope.bounds.maxLng,
            },
          },
        },
      };

      const data = (await fetchJson(`${GOOGLE_PLACES_BASE_URL}/places:autocomplete`, {
        method: "POST",
        headers: googleHeaders(
          apiKey,
          "suggestions.placePrediction.place,suggestions.placePrediction.placeId",
          true
        ),
        body: JSON.stringify(requestBody),
      })) as Record<string, unknown>;
      const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
      const placeResources = suggestions
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const prediction = (item as Record<string, unknown>).placePrediction;
          if (!prediction || typeof prediction !== "object") return null;
          return toGooglePlaceResource(prediction as Record<string, unknown>);
        })
        .filter((item): item is string => item !== null)
        .slice(0, scope.autocompleteLimit);

      const details = await Promise.all(
        placeResources.map(async (resource) => {
          try {
            return await getPlaceSuggestion(resource);
          } catch {
            return null;
          }
        })
      );

      return details.filter((item): item is AutocompleteSuggestion => item !== null);
    },

    async reverseGeocode(lat: number, lng: number): Promise<string | null> {
      const params = new URLSearchParams({
        locationQuery: `${lat},${lng}`,
        regionCode: scope.countryCode.toLowerCase(),
      });

      const data = (await fetchJson(
        `${GOOGLE_GEOCODING_V4_BASE_URL}/location?${params}`,
        {
          headers: googleHeaders(apiKey, "results.formattedAddress"),
        }
      )) as Record<string, unknown>;

      const results = Array.isArray(data.results) ? data.results : [];
      const first = results[0] as Record<string, unknown> | undefined;
      const address =
        first && typeof first.formattedAddress === "string"
          ? first.formattedAddress
          : "";
      return address || null;
    },
  };
}

export function createGeocodingClient(
  provider: GeocodingProviderName,
  scope: GeocodingScope
): GeocodingClient {
  switch (provider) {
    case "geocode-earth":
      return createGeocodeEarthClient(scope);
    case "mapbox":
      return createMapboxClient(scope);
    case "google-maps":
      return createGoogleMapsClient(scope);
    case "geoapify":
      return createGeoapifyClient(scope);
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unsupported geocoding provider: ${exhaustive}`);
    }
  }
}
