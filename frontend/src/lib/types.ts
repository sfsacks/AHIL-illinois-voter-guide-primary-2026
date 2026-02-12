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
  endorsed?: boolean;  // NEW: Flag for whether this candidate is endorsed
  website?: string;    // NEW: Candidate website
}

export interface Candidate {
  race: string;
  candidate: string;
  party: string;
  district_layer?: string;
  district_type?: string;
  endorsed: boolean;   // NEW: Whether AHIL endorses this candidate
  website?: string;    // NEW: Candidate website
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
}

export interface CandidateConfig {
  race: string;
  candidate: string;
  party: string;
  website?: string;
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
