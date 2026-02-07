/**
 * Tests for endorsement matching logic.
 */

import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/lookup/route";
import { createRequest } from "./test-utils";
import { DOWNTOWN_CHICAGO, EVANSTON } from "./fixtures";

describe("Endorsements", () => {
  it("always returns statewide endorsements", async () => {
    const request = createRequest("/api/lookup", {
      lat: String(DOWNTOWN_CHICAGO.lat),
      lng: String(DOWNTOWN_CHICAGO.lng),
    });
    const response = await GET(request);
    const data = await response.json();

    // US Senate is a statewide race (no district_type in config)
    const races = data.endorsements.map(
      (e: { race: string }) => e.race
    );
    expect(races).toContain("US Senate");
  });

  it("returns endorsements with required fields", async () => {
    const request = createRequest("/api/lookup", {
      lat: String(DOWNTOWN_CHICAGO.lat),
      lng: String(DOWNTOWN_CHICAGO.lng),
    });
    const response = await GET(request);
    const data = await response.json();

    for (const endorsement of data.endorsements) {
      expect(endorsement).toHaveProperty("race");
      expect(endorsement).toHaveProperty("candidate");
      expect(endorsement).toHaveProperty("party");
    }
  });

  it("returns at least one endorsement", async () => {
    const request = createRequest("/api/lookup", {
      lat: String(DOWNTOWN_CHICAGO.lat),
      lng: String(DOWNTOWN_CHICAGO.lng),
    });
    const response = await GET(request);
    const data = await response.json();

    expect(data.endorsements.length).toBeGreaterThanOrEqual(1);
  });

  it("returns district-specific endorsement only for matching district", async () => {
    // Downtown sample fixture is in Congressional District 7
    const downtownRequest = createRequest("/api/lookup", {
      lat: String(DOWNTOWN_CHICAGO.lat),
      lng: String(DOWNTOWN_CHICAGO.lng),
    });
    const downtownResponse = await GET(downtownRequest);
    const downtownData = await downtownResponse.json();

    const downtownRaces = downtownData.endorsements.map(
      (e: { race: string }) => e.race
    );
    expect(downtownRaces).toContain("US House IL-7");

    // Evanston is in a different congressional district
    const evanstonRequest = createRequest("/api/lookup", {
      lat: String(EVANSTON.lat),
      lng: String(EVANSTON.lng),
    });
    const evanstonResponse = await GET(evanstonRequest);
    const evanstonData = await evanstonResponse.json();

    const evanstonRaces = evanstonData.endorsements.map(
      (e: { race: string }) => e.race
    );
    expect(evanstonRaces).not.toContain("US House IL-7");
  });
});
