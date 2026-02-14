export interface Coordinates {
  lat: number;
  lng: number;
}

export type Districts = Record<string, number | null>;

export interface EndorsementDistrictRef {
  layer: string;
  number: number;
}

// Type for normalizeDistrictRef return value
export type DistrictRef = EndorsementDistrictRef | "invalid" | "county-wide" | null;

export interface Endorsement {
  race: string;
  candidate: string;
  party: string;
  district_layer?: string;
  district_type?: string;
  endorsed?: boolean;  // NEW: Flag for whether this candidate is endorsed
  website?: string;    // NEW: Candidate website
  incumbent?: boolean; // NEW: Whether candidate is incumbent
}

export interface Candidate {
  race: string;
  candidate: string;
  party: string;
  district_layer?: string;
  district_type?: string;
  endorsed: boolean;   // NEW: Whether AHIL endorses this candidate
  website?: string;    // NEW: Candidate website
  incumbent?: boolean; // NEW: Whether candidate is incumbent
}

export interface LookupResponse {
  address_used: string | null;
  coordinates: Coordinates;
  districts: Districts;
  endorsements: Endorsement[];  // DEPRECATED: Use candidates instead
  candidates: Candidate[];      // NEW: All candidates for user's districts
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
  county?: string; // NEW: County identifier for county-wide races
}

export interface CandidateConfig {
  race: string;
  candidate: string;
  party: string;
  website?: string;
  incumbent?: boolean; // NEW: Whether candidate is incumbent
  district?: EndorsementDistrictRef;
  district_layer?: string;
  district_type?: string;
  district_number?: number;
  county?: string; // NEW: County identifier for county-wide races
}

export interface AutocompleteSuggestion {
  address: string;
  lat: number;
  lng: number;
}
