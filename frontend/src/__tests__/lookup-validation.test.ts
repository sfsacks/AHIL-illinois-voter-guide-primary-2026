/**
 * Tests for input validation on the /api/lookup endpoint.
 */

import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/lookup/route";
import { createRequest } from "./test-utils";
import { WASHINGTON_DC } from "./fixtures";

describe("Lookup Validation", () => {
  it("requires address or coordinates", async () => {
    const request = createRequest("/api/lookup");
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.toLowerCase()).toContain("must be provided");
  });

  it("requires both lat and lng when using coordinates", async () => {
    const request = createRequest("/api/lookup", { lat: "41.8781" });
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it("requires lat when lng is provided", async () => {
    const request = createRequest("/api/lookup", { lng: "-87.6298" });
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it("rejects coordinates outside configured jurisdiction", async () => {
    const request = createRequest("/api/lookup", {
      lat: String(WASHINGTON_DC.lat),
      lng: String(WASHINGTON_DC.lng),
    });
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.toLowerCase()).toContain("outside");
  });

  it("rejects invalid address", async () => {
    const request = createRequest("/api/lookup", {
      address: "xyznonexistent123",
    });
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeTruthy();
  }, 15000);
});
