/**
 * Tests for the health check endpoint.
 */

import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

describe("Health Endpoint", () => {
  it("returns 200 status", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it("returns healthy status in body", async () => {
    const response = await GET();
    const data = await response.json();
    expect(data.status).toBe("healthy");
  });
});
