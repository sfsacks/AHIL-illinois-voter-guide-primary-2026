export interface Coordinates {
  lat: number;
  lng: number;
}

export type Districts = Record<string, number | null>;

export interface EndorsementDistrictRef {
  layer: string;
  number: number;
}

export interface Endorsement {
  race: string;
  candidate: string;
  party: string;
  district_layer?: string;
  district_type?: string;
}

export interface LookupResponse {
  address_used: string | null;
  coordinates: Coordinates;
  districts: Districts;
  endorsements: Endorsement[];
  district_shapes?: Record<string, GeoJSON.Geometry>;
}

export interface EndorsementConfig {
  race: string;
  candidate: string;
  party: string;
  district?: EndorsementDistrictRef;
  district_layer?: string;
  district_type?: string;
  district_number?: number;
}

export interface AutocompleteSuggestion {
  address: string;
  lat: number;
  lng: number;
}
