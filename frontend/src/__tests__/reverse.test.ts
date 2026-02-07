import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/reverse/route";
import { createRequest } from "./test-utils";

describe("Reverse Geocode Endpoint", () => {
  it("returns 400 for invalid coordinates", async () => {
    const request = createRequest("/api/reverse", { lat: "abc", lng: "123" });
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.toLowerCase()).toContain("invalid latitude");
  });
});
