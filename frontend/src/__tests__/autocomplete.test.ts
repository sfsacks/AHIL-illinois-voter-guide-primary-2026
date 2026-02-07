import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/autocomplete/route";
import { createRequest } from "./test-utils";

describe("Autocomplete Endpoint", () => {
  it("returns empty suggestions when query is too short", async () => {
    const request = createRequest("/api/autocomplete", { q: "ab" });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.suggestions).toEqual([]);
  });
});
