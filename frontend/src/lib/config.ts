import { APP_CONFIG } from "./app-config";

export const DISTRICT_LAYER_CONFIGS = APP_CONFIG.geography.districtMapPack.layers;
export const DISTRICT_LAYER_IDS = Object.keys(DISTRICT_LAYER_CONFIGS);

export const JURISDICTION_DISPLAY_NAME = APP_CONFIG.geography.jurisdictionName;
export const JURISDICTION_COUNTRY_CODE = APP_CONFIG.geography.countryCode;
export const JURISDICTION_STATE_CODE = APP_CONFIG.geography.state.code;
export const JURISDICTION_STATE_NAME = APP_CONFIG.geography.state.name;
export const JURISDICTION_STATE_SLUG = APP_CONFIG.geography.state.slug;
export const JURISDICTION_BOUNDS = APP_CONFIG.geography.bounds;
export const JURISDICTION_FOCUS_POINT = APP_CONFIG.geography.focusPoint;
export const JURISDICTION_MAP_ROOT = APP_CONFIG.geography.districtMapPack.root;
export const JURISDICTION_BOUNDARY_FILE = APP_CONFIG.geography.districtMapPack.boundaryPath;

export const SELECTED_GEOCODING_PROVIDER = APP_CONFIG.geocoding.provider;
