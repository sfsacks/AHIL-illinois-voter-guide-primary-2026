/**
 * Tests for coordinate-based lookups on the /api/lookup endpoint.
 */

import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/lookup/route";
import { createRequest } from "./test-utils";
import { DOWNTOWN_CHICAGO, EVANSTON, BRIDGEVIEW } from "./fixtures";

describe("Lookup by Coordinates", () => {
  it("returns 200 for valid in-jurisdiction location", async () => {
    const request = createRequest("/api/lookup", {
      lat: String(DOWNTOWN_CHICAGO.lat),
      lng: String(DOWNTOWN_CHICAGO.lng),
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it("returns response with all required fields", async () => {
    const request = createRequest("/api/lookup", {
      lat: String(DOWNTOWN_CHICAGO.lat),
      lng: String(DOWNTOWN_CHICAGO.lng),
    });
    const response = await GET(request);
    const data = await response.json();

    expect(data).toHaveProperty("address_used");
    expect(data).toHaveProperty("coordinates");
    expect(data).toHaveProperty("districts");
    expect(data).toHaveProperty("endorsements");

    // address_used should be null for coordinate lookups
    expect(data.address_used).toBeNull();

    // coordinates should match input
    expect(data.coordinates.lat).toBe(DOWNTOWN_CHICAGO.lat);
    expect(data.coordinates.lng).toBe(DOWNTOWN_CHICAGO.lng);
  });

  it("finds congressional district for downtown sample point", async () => {
    const request = createRequest("/api/lookup", {
      lat: String(DOWNTOWN_CHICAGO.lat),
      lng: String(DOWNTOWN_CHICAGO.lng),
    });
    const response = await GET(request);
    const data = await response.json();

    expect(data.districts.congressional).not.toBeNull();
  });

  it("finds state senate district for downtown sample point", async () => {
    const request = createRequest("/api/lookup", {
      lat: String(DOWNTOWN_CHICAGO.lat),
      lng: String(DOWNTOWN_CHICAGO.lng),
    });
    const response = await GET(request);
    const data = await response.json();

    expect(data.districts.state_senate).not.toBeNull();
  });

  it("finds state house district for downtown sample point", async () => {
    const request = createRequest("/api/lookup", {
      lat: String(DOWNTOWN_CHICAGO.lat),
      lng: String(DOWNTOWN_CHICAGO.lng),
    });
    const response = await GET(request);
    const data = await response.json();

    expect(data.districts.state_house).not.toBeNull();
  });

  it("finds local ward district for downtown sample point", async () => {
    const request = createRequest("/api/lookup", {
      lat: String(DOWNTOWN_CHICAGO.lat),
      lng: String(DOWNTOWN_CHICAGO.lng),
    });
    const response = await GET(request);
    const data = await response.json();

    expect(data.districts.city_ward).not.toBeNull();
  });

  it("returns no local ward for a nearby suburb point", async () => {
    const request = createRequest("/api/lookup", {
      lat: String(EVANSTON.lat),
      lng: String(EVANSTON.lng),
    });
    const response = await GET(request);
    const data = await response.json();

    expect(data.districts.city_ward).toBeNull();
  });

  it("finds legislative districts for Evanston", async () => {
    const request = createRequest("/api/lookup", {
      lat: String(EVANSTON.lat),
      lng: String(EVANSTON.lng),
    });
    const response = await GET(request);
    const data = await response.json();

    expect(data.districts.congressional).not.toBeNull();
    expect(data.districts.state_senate).not.toBeNull();
    expect(data.districts.state_house).not.toBeNull();
  });

  it("finds county district for downtown sample point", async () => {
    const request = createRequest("/api/lookup", {
      lat: String(DOWNTOWN_CHICAGO.lat),
      lng: String(DOWNTOWN_CHICAGO.lng),
    });
    const response = await GET(request);
    const data = await response.json();

    expect(data.districts.cook_county).not.toBeNull();
  });

  it("finds county district but no local ward for suburban sample point", async () => {
    const request = createRequest("/api/lookup", {
      lat: String(BRIDGEVIEW.lat),
      lng: String(BRIDGEVIEW.lng),
    });
    const response = await GET(request);
    const data = await response.json();

    expect(data.districts.cook_county).not.toBeNull();
    expect(data.districts.city_ward).toBeNull();
  });
});
