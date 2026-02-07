import { APP_CONFIG } from "../app-config";
import { createGeocodingClient } from "./providers";
import type { GeocodingClient } from "./types";

let cachedClient: GeocodingClient | null = null;
let cachedProvider: string | null = null;

export function getGeocodingClient(): GeocodingClient {
  const provider = APP_CONFIG.geocoding.provider;

  if (cachedClient && cachedProvider === provider) {
    return cachedClient;
  }

  cachedClient = createGeocodingClient(provider, {
    bounds: APP_CONFIG.geography.bounds,
    focusPoint: APP_CONFIG.geography.focusPoint,
    countryCode: APP_CONFIG.geography.countryCode,
    stateCode: APP_CONFIG.geography.state.code,
    autocompleteLimit: APP_CONFIG.geocoding.autocompleteLimit,
  });
  cachedProvider = provider;
  return cachedClient;
}

export type { GeocodingProviderName, GeocodingClient, GeocodeResult } from "./types";
