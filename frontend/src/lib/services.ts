import * as turf from "@turf/turf";
import { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { readFileSync } from "fs";
import { join } from "path";
import type { Geometry } from "geojson";
import yaml from "yaml";
import {
  DISTRICT_LAYER_CONFIGS,
  DISTRICT_LAYER_IDS,
  JURISDICTION_BOUNDS,
  JURISDICTION_BOUNDARY_FILE,
} from "./config";
import { getGeocodingClient } from "./geocoding";
import type {
  Districts,
  Endorsement,
  EndorsementConfig,
  EndorsementDistrictRef,
} from "./types";

type DistrictGeoJSON = FeatureCollection<Polygon | MultiPolygon>;

// Cache for loaded data (server-side only)
let districtsCache: Map<string, DistrictGeoJSON> | null = null;
let endorsementsCache: EndorsementConfig[] | null = null;
let jurisdictionBoundaryCache: Feature<Polygon | MultiPolygon> | null = null;

function getDataPath(pathFromDataDir: string): string {
  return join(process.cwd(), "data", pathFromDataDir);
}

function getDistrictColumnCandidates(layerId: string): string[] {
  const config = DISTRICT_LAYER_CONFIGS[layerId];
  const base = [
    config.numberProperty,
    config.numberProperty.toLowerCase(),
    config.numberProperty.toUpperCase(),
    ...(config.numberPropertyAliases || []),
    "ward",
    "ward_id",
    "WARD",
  ];
  return Array.from(new Set(base));
}

function getDistrictNumberFromFeatureProperties(
  props: Record<string, unknown>,
  layerId: string
): number | null {
  const columns = getDistrictColumnCandidates(layerId);

  for (const col of columns) {
    if (col in props) {
      const val = props[col];
      const parsed = parseInt(String(val), 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

export function loadDistricts(): Map<string, DistrictGeoJSON> {
  if (districtsCache) return districtsCache;

  districtsCache = new Map();

  for (const [layerId, layerConfig] of Object.entries(DISTRICT_LAYER_CONFIGS)) {
    try {
      const filepath = getDataPath(layerConfig.path);
      const content = readFileSync(filepath, "utf-8");
      const geojson = JSON.parse(content) as DistrictGeoJSON;
      districtsCache.set(layerId, geojson);
      console.log(`Loaded ${layerId}: ${geojson.features.length} districts`);
    } catch (error) {
      console.warn(`Warning: Could not load layer '${layerId}' from ${layerConfig.path}:`, error);
    }
  }

  return districtsCache;
}

export function loadEndorsements(): EndorsementConfig[] {
  if (endorsementsCache) return endorsementsCache;

  try {
    const filepath = getDataPath("endorsements.yaml");
    const content = readFileSync(filepath, "utf-8");
    const data = yaml.parse(content) as { endorsements?: EndorsementConfig[] } | null;
    endorsementsCache = data?.endorsements || [];
    console.log(`Loaded ${endorsementsCache.length} endorsements`);
    return endorsementsCache;
  } catch (error) {
    console.warn("Warning: Could not load endorsements.yaml:", error);
    return [];
  }
}

function loadJurisdictionBoundary(): Feature<Polygon | MultiPolygon> {
  if (jurisdictionBoundaryCache) return jurisdictionBoundaryCache;

  const filepath = getDataPath(JURISDICTION_BOUNDARY_FILE);
  const content = readFileSync(filepath, "utf-8");
  const geojson = JSON.parse(content) as FeatureCollection<Polygon | MultiPolygon>;
  jurisdictionBoundaryCache = geojson.features[0];
  return jurisdictionBoundaryCache;
}

interface GeocodeResult {
  lat: number;
  lng: number;
  matchedAddress: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const geocoder = getGeocodingClient();
  return geocoder.geocodeAddress(address);
}

export function checkJurisdiction(lat: number, lng: number): boolean {
  return (
    lat >= JURISDICTION_BOUNDS.minLat &&
    lat <= JURISDICTION_BOUNDS.maxLat &&
    lng >= JURISDICTION_BOUNDS.minLng &&
    lng <= JURISDICTION_BOUNDS.maxLng
  );
}

function buildEmptyDistrictResult(): Districts {
  return Object.fromEntries(
    DISTRICT_LAYER_IDS.map((layerId) => [layerId, null])
  ) as Districts;
}

export function lookupDistricts(
  lat: number,
  lng: number,
  districtsData: Map<string, DistrictGeoJSON>
): Districts {
  const point = turf.point([lng, lat]); // GeoJSON uses [lng, lat]
  const result = buildEmptyDistrictResult();

  for (const [layerId, geojson] of districtsData.entries()) {
    for (const feature of geojson.features) {
      if (!turf.booleanPointInPolygon(point, feature)) {
        continue;
      }

      const props = (feature.properties || {}) as Record<string, unknown>;
      const districtNumber = getDistrictNumberFromFeatureProperties(props, layerId);
      if (districtNumber !== null) {
        result[layerId] = districtNumber;
      }
      break; // Found the containing district for this layer.
    }
  }

  return result;
}

function normalizeDistrictRef(
  config: EndorsementConfig
): EndorsementDistrictRef | "invalid" | null {
  if (config.district !== undefined) {
    const layer = config.district?.layer;
    const number = Number(config.district?.number);
    if (typeof layer === "string" && layer.length > 0 && Number.isFinite(number)) {
      return { layer, number };
    }
    return "invalid";
  }

  const hasLegacyRefFields =
    config.district_layer !== undefined ||
    config.district_type !== undefined ||
    config.district_number !== undefined;
  if (hasLegacyRefFields) {
    const legacyLayer = config.district_layer || config.district_type;
    const legacyNumber = Number(config.district_number);
    if (legacyLayer && Number.isFinite(legacyNumber)) {
      return { layer: legacyLayer, number: legacyNumber };
    }
    return "invalid";
  }

  return null;
}

export function getEndorsements(
  districts: Districts,
  endorsementsData: EndorsementConfig[]
): Endorsement[] {
  const result: Endorsement[] = [];

  for (const endorsement of endorsementsData) {
    const districtRef = normalizeDistrictRef(endorsement);
    const { race, candidate, party } = endorsement;

    // Statewide endorsement (no district reference)
    if (districtRef === null) {
      result.push({ race, candidate, party });
      continue;
    }

    // Invalid district config should not silently become statewide.
    if (districtRef === "invalid") {
      continue;
    }

    // District-specific endorsement
    const userDistrict = districts[districtRef.layer];
    if (userDistrict !== null && userDistrict === districtRef.number) {
      result.push({
        race,
        candidate,
        party,
        district_layer: districtRef.layer,
        district_type: districtRef.layer,
      });
    }
  }

  return result;
}

export function getDistrictShapes(
  districts: Districts,
  districtsData: Map<string, DistrictGeoJSON>
): Record<string, Geometry> {
  const shapes: Record<string, Geometry> = {};

  for (const [layerId, geojson] of districtsData.entries()) {
    const districtNumber = districts[layerId];
    if (districtNumber === null) continue;

    for (const feature of geojson.features) {
      const props = (feature.properties || {}) as Record<string, unknown>;
      const candidateNumber = getDistrictNumberFromFeatureProperties(props, layerId);
      if (candidateNumber !== districtNumber) {
        continue;
      }

      const simplified = turf.simplify(feature, { tolerance: 0.002, highQuality: false });
      shapes[layerId] = simplified.geometry;
      break;
    }
  }

  const boundary = loadJurisdictionBoundary();
  const simplified = turf.simplify(boundary, { tolerance: 0.002, highQuality: false });
  shapes.statewide = simplified.geometry;

  return shapes;
}
