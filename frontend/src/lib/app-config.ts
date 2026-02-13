import type { GeocodingProviderName } from "./geocoding/types";

interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface FocusPoint {
  lat: number;
  lng: number;
}

interface DistrictLayerConfig {
  label: string;
  path: string;
  numberProperty: string;
  numberPropertyAliases?: string[];
}

interface AppConfig {
  branding: {
    orgName: string;
    headerSubtitle: string;
    electionLabel: string;
    footerBlurb: string;
    attributionName: string;
    attributionUrl: string;
  };
  geography: {
    jurisdictionName: string;
    countryCode: string;
    state: {
      code: string;
      name: string;
      slug: string;
    };
    bounds: Bounds;
    focusPoint: FocusPoint;
    districtMapPack: {
      root: string;
      boundaryPath: string;
      layers: Record<string, DistrictLayerConfig>;
    };
  };
  geocoding: {
    provider: GeocodingProviderName;
    autocompleteLimit: number;
  };
  ui: {
    showDistrictShapes: boolean;
  };
}

// Headless configuration:
// 1) Set the target state metadata and bounds below.
// 2) Add district maps under frontend/data/district-maps/<state-slug>/...
// 3) Map district layers here so endorsements can reference layer IDs.
const STATE_SLUG = "illinois";
const DISTRICT_MAP_ROOT = `district-maps/${STATE_SLUG}`;

export const APP_CONFIG: AppConfig = {
  branding: {
    orgName: "Abundant Housing Illinois",
    headerSubtitle: "Your pro-housing voter guide for the 2026 Illinois primary",
    electionLabel: "March 17, 2026 Illinois Primary",
    footerBlurb: "Endorsing candidates who support building more homes across Illinois",
    attributionName: "Abundant Housing Illinois",
    attributionUrl: "https://abundanthousingillinois.org",
  },
  geography: {
    jurisdictionName: "Illinois",
    countryCode: "US",
    state: {
      code: "IL",
      name: "Illinois",
      slug: STATE_SLUG,
    },
    bounds: {
      minLat: 36.97,
      maxLat: 42.51,
      minLng: -91.51,
      maxLng: -87.02,
    },
    focusPoint: { lat: 41.8781, lng: -87.6298 },
    districtMapPack: {
      root: DISTRICT_MAP_ROOT,
      boundaryPath: `${DISTRICT_MAP_ROOT}/boundary/boundary.geojson`,
      layers: {
        congressional: {
          label: "Congressional",
          path: `${DISTRICT_MAP_ROOT}/congressional/districts.geojson`,
          numberProperty: "CD119FP",
          numberPropertyAliases: ["cd119fp"],
        },
        state_senate: {
          label: "State Senate",
          path: `${DISTRICT_MAP_ROOT}/state_senate/districts.geojson`,
          numberProperty: "SLDUST",
          numberPropertyAliases: ["sldust"],
        },
        state_house: {
          label: "State House",
          path: `${DISTRICT_MAP_ROOT}/state_house/districts.geojson`,
          numberProperty: "SLDLST",
          numberPropertyAliases: ["sldlst"],
        },
        city_ward: {
          label: "City Ward",
          path: `${DISTRICT_MAP_ROOT}/chicago_ward/districts.geojson`,
          numberProperty: "ward",
          numberPropertyAliases: ["ward", "ward_id", "WARD"],
        },
        cook_county: {
          label: "Cook County",
          path: `${DISTRICT_MAP_ROOT}/cook_county/districts.geojson`,
          numberProperty: "DISTRICT_INT",
          numberPropertyAliases: ["district_int"],
        },
        cook_county_circuit_court_subcircuits: {
          label: "Cook County Circuit Court Subcircuits",
          path: `${DISTRICT_MAP_ROOT}/cook_county_circuit_court_subcircuits/districts.geojson`,
          numberProperty: "SUBCIRCUIT",
          numberPropertyAliases: ["subcircuit", "Subcircuit", "SUBCIRCUIT_NUM"],
        },
      },
    },
  },
  geocoding: {
    provider: "geocode-earth",
    autocompleteLimit: 8,
  },
  ui: {
    // Defaults to false for a cleaner, more headless endorsement slate.
    showDistrictShapes: false,
  },
};
