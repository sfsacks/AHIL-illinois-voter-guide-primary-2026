import type { AutocompleteSuggestion } from "../types";

export type GeocodingProviderName =
  | "geocode-earth"
  | "mapbox"
  | "google-maps"
  | "geoapify";

export interface GeocodeResult {
  lat: number;
  lng: number;
  matchedAddress: string;
}

export interface GeocodingScope {
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  focusPoint: {
    lat: number;
    lng: number;
  };
  countryCode: string;
  stateCode: string;
  autocompleteLimit: number;
}

export interface GeocodingClient {
  provider: GeocodingProviderName;
  geocodeAddress(address: string): Promise<GeocodeResult>;
  autocompleteAddress(query: string): Promise<AutocompleteSuggestion[]>;
  reverseGeocode(lat: number, lng: number): Promise<string | null>;
}
