// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import Home from "@/app/page";

function mockLookupResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    address_used: "141 W Randolph St, Sample City, IL 60602",
    coordinates: { lat: 41.8844, lng: -87.6330 },
    districts: {
      congressional: 7,
      state_senate: 3,
      state_house: 6,
      city_ward: 42,
      cook_county: 10,
    },
    endorsements: [],
    ...overrides,
  };
}

describe("Shareable URL Behavior", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
  });

  it("does not auto-run lookup when URL has no lat/lng params", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<Home />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hydrates lookup from lat/lng query params on load", async () => {
    window.history.replaceState({}, "", "/?lat=41.8844&lng=-87.633");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockLookupResponse(),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<Home />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/lookup?lat=41.8844&lng=-87.633")
    );
    expect(await screen.findByText("141 W Randolph St, Sample City, IL 60602")).toBeTruthy();
  });

  it("clears url and resets shown location details when Clear Location is clicked", async () => {
    window.history.replaceState({}, "", "/?lat=41.8844&lng=-87.633");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockLookupResponse(),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<Home />);

    await screen.findByText("141 W Randolph St, Sample City, IL 60602");

    const clearButton = screen.getByRole("button", { name: "Clear Location" });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(window.location.search).toBe("");
    });
    expect(screen.queryByText("141 W Randolph St, Sample City, IL 60602")).toBeNull();
    expect(
      (screen.getByPlaceholderText("Start typing your address...") as HTMLInputElement).value
    ).toBe("");
  });
});
