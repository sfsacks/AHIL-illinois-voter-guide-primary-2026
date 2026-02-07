/**
 * Unit tests for core service functions in services.ts.
 * These test pure logic directly without going through the API route.
 */

import { describe, it, expect } from "vitest";
import {
  checkJurisdiction,
  getEndorsements,
  lookupDistricts,
  getDistrictShapes,
  loadDistricts,
  loadEndorsements,
} from "@/lib/services";
import type { Districts } from "@/lib/types";

// Load real data once — these are fast disk reads cached in memory
const districtsData = loadDistricts();
const endorsementsData = loadEndorsements();

describe("checkJurisdiction", () => {
  it("returns true for coordinates inside the sample jurisdiction", () => {
    expect(checkJurisdiction(41.88, -87.63)).toBe(true);
  });

  it("returns true for another in-bounds location", () => {
    expect(checkJurisdiction(39.78, -89.65)).toBe(true);
  });

  it("returns false for out-of-jurisdiction coordinates", () => {
    expect(checkJurisdiction(38.89, -77.03)).toBe(false);
  });

  it("returns false for coordinates north of jurisdiction bounds", () => {
    expect(checkJurisdiction(43.0, -89.0)).toBe(false);
  });

  it("returns false for coordinates south of jurisdiction bounds", () => {
    expect(checkJurisdiction(36.5, -89.0)).toBe(false);
  });

  it("returns false for coordinates east of jurisdiction bounds", () => {
    expect(checkJurisdiction(40.0, -86.0)).toBe(false);
  });

  it("returns false for coordinates west of jurisdiction bounds", () => {
    expect(checkJurisdiction(40.0, -92.0)).toBe(false);
  });
});

describe("getEndorsements", () => {
  const sampleDistricts: Districts = {
    congressional: 7,
    state_senate: 3,
    state_house: 6,
    city_ward: 42,
    cook_county: 10,
  };

  it("returns statewide endorsements for any districts", () => {
    const results = getEndorsements(sampleDistricts, endorsementsData);
    const races = results.map((e) => e.race);
    expect(races).toContain("US Senate");
    expect(races).toContain("Governor");
    expect(races).toContain("Attorney General");
    expect(races).toContain("Secretary of State");
    expect(races).toContain("Comptroller");
    expect(races).toContain("Treasurer");
  });

  it("returns matching district-specific endorsements", () => {
    const results = getEndorsements(sampleDistricts, endorsementsData);
    const races = results.map((e) => e.race);
    expect(races).toContain("US House IL-7");
    expect(races).toContain("State Senate District 3");
    expect(races).toContain("State House District 6");
  });

  it("does NOT return endorsements for non-matching districts", () => {
    const results = getEndorsements(sampleDistricts, endorsementsData);
    const races = results.map((e) => e.race);
    expect(races).not.toContain("US House IL-1");
    expect(races).not.toContain("State Senate District 10");
  });

  it("returns empty array when no endorsements match", () => {
    const emptyDistricts: Districts = {
      congressional: null,
      state_senate: null,
      state_house: null,
      city_ward: null,
      cook_county: null,
    };
    const results = getEndorsements(emptyDistricts, [
      { race: "Fake Race", candidate: "Nobody", party: "X", district_type: "congressional", district_number: 99 },
    ]);
    expect(results).toEqual([]);
  });

  it("handles empty endorsements list", () => {
    const results = getEndorsements(sampleDistricts, []);
    expect(results).toEqual([]);
  });

  it("returns Cook County Commissioner endorsement for matching district", () => {
    const results = getEndorsements(sampleDistricts, endorsementsData);
    const races = results.map((e) => e.race);
    expect(races).toContain("Cook County Commissioner District 10");
  });

  it("matches endorsement using modern district.layer schema", () => {
    const results = getEndorsements(sampleDistricts, [
      {
        race: "Modern Schema Race",
        candidate: "Modern Candidate",
        party: "D",
        district: { layer: "congressional", number: 7 },
      },
    ]);

    expect(results).toEqual([
      {
        race: "Modern Schema Race",
        candidate: "Modern Candidate",
        party: "D",
        district_layer: "congressional",
        district_type: "congressional",
      },
    ]);
  });

  it("supports district_layer + district_number compatibility fields", () => {
    const results = getEndorsements(sampleDistricts, [
      {
        race: "Compat Schema Race",
        candidate: "Compat Candidate",
        party: "D",
        district_layer: "state_senate",
        district_number: 3,
      },
    ]);

    expect(results).toEqual([
      {
        race: "Compat Schema Race",
        candidate: "Compat Candidate",
        party: "D",
        district_layer: "state_senate",
        district_type: "state_senate",
      },
    ]);
  });

  it("prefers modern district field when modern and legacy fields conflict", () => {
    const results = getEndorsements(sampleDistricts, [
      {
        race: "Conflict Race",
        candidate: "Conflict Candidate",
        party: "D",
        district: { layer: "state_house", number: 6 },
        district_type: "congressional",
        district_number: 1,
      },
    ]);

    expect(results.map((entry) => entry.race)).toContain("Conflict Race");
    expect(results[0].district_layer).toBe("state_house");
  });

  it("skips invalid district refs instead of treating them as statewide", () => {
    const results = getEndorsements(sampleDistricts, [
      {
        race: "Invalid District Ref",
        candidate: "Nobody",
        party: "D",
        district: { layer: "", number: 7 },
      },
    ]);

    expect(results).toEqual([]);
  });
});

describe("lookupDistricts", () => {
  it("returns correct districts for downtown sample fixture", () => {
    const districts = lookupDistricts(41.8781, -87.6298, districtsData);
    expect(districts.congressional).not.toBeNull();
    expect(districts.state_senate).not.toBeNull();
    expect(districts.state_house).not.toBeNull();
    expect(districts.city_ward).not.toBeNull();
    expect(districts.cook_county).not.toBeNull();
  });

  it("returns null for city_ward outside the core city fixture (Evanston)", () => {
    const districts = lookupDistricts(42.046292, -87.679702, districtsData);
    expect(districts.city_ward).toBeNull();
    // But should still have legislative districts
    expect(districts.congressional).not.toBeNull();
    expect(districts.state_senate).not.toBeNull();
    expect(districts.state_house).not.toBeNull();
  });

  it("returns all nulls for coordinates outside the configured jurisdiction", () => {
    const districts = lookupDistricts(38.89, -77.03, districtsData);
    expect(districts.congressional).toBeNull();
    expect(districts.state_senate).toBeNull();
    expect(districts.state_house).toBeNull();
    expect(districts.city_ward).toBeNull();
    expect(districts.cook_county).toBeNull();
  });

  it("finds county commissioner district for downtown sample fixture", () => {
    const districts = lookupDistricts(41.8781, -87.6298, districtsData);
    expect(districts.cook_county).not.toBeNull();
    expect(typeof districts.cook_county).toBe("number");
  });

  it("finds Cook County Commissioner district for suburban Cook County", () => {
    // Bridgeview, IL — suburb in Cook County but outside the core city.
    const districts = lookupDistricts(41.7500, -87.8042, districtsData);
    expect(districts.cook_county).not.toBeNull();
    expect(districts.city_ward).toBeNull();
  });
});

describe("getDistrictShapes", () => {
  it("returns simplified geometries for matched districts", () => {
    const districts: Districts = {
      congressional: 7,
      state_senate: 3,
      state_house: 6,
      city_ward: 42,
      cook_county: 10,
    };
    const shapes = getDistrictShapes(districts, districtsData);
    expect(shapes).toHaveProperty("congressional");
    expect(shapes).toHaveProperty("state_senate");
    expect(shapes).toHaveProperty("state_house");
    expect(shapes).toHaveProperty("city_ward");
    expect(shapes).toHaveProperty("cook_county");
  });

  it("includes statewide boundary shape", () => {
    const districts: Districts = {
      congressional: null,
      state_senate: null,
      state_house: null,
      city_ward: null,
      cook_county: null,
    };
    const shapes = getDistrictShapes(districts, districtsData);
    expect(shapes).toHaveProperty("statewide");
    expect(shapes.statewide.type).toMatch(/Polygon|MultiPolygon/);
  });

  it("skips districts with null values", () => {
    const districts: Districts = {
      congressional: 7,
      state_senate: null,
      state_house: null,
      city_ward: null,
      cook_county: null,
    };
    const shapes = getDistrictShapes(districts, districtsData);
    expect(shapes).toHaveProperty("congressional");
    expect(shapes).not.toHaveProperty("state_senate");
    expect(shapes).not.toHaveProperty("city_ward");
    // statewide is always included
    expect(shapes).toHaveProperty("statewide");
  });
});
