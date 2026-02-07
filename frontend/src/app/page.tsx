"use client";

import { useState, useEffect, useRef } from "react";
import { LookupResponse } from "@/lib/types";
import { APP_CONFIG } from "@/lib/app-config";

interface Suggestion {
  address: string;
  lat: number;
  lng: number;
}

function getRaceLevel(race: string): "federal" | "state" | "local" {
  if (race.startsWith("US ")) return "federal";
  if (race.startsWith("State ")) return "state";
  if (["Governor", "Attorney General", "Secretary of State", "Comptroller", "Treasurer"].includes(race)) {
    return "state";
  }
  return "local";
}

const LEVEL_COLORS: Record<string, string> = {
  federal: "bg-ink",
  state: "bg-accent-sky",
  local: "bg-accent-coral",
};

function Spinner() {
  return (
    <span
      className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
      style={{ animation: "spin 0.6s linear infinite" }}
    />
  );
}

export default function Home() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResponse | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const skipAutocomplete = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hydratedFromUrl = useRef(false);

  function setShareCoordinates(lat: number, lng: number) {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lng", lng.toString());
    window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}`);
  }

  function clearShareCoordinates() {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.delete("lat");
    url.searchParams.delete("lng");
    const search = url.searchParams.toString();
    window.history.replaceState({}, "", search ? `${url.pathname}?${search}` : url.pathname);
  }

  function handleClearLocation() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    skipAutocomplete.current = true;
    setAddress("");
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    setError(null);
    setResult(null);
    clearShareCoordinates();
  }

  useEffect(() => {
    if (skipAutocomplete.current) {
      skipAutocomplete.current = false;
      return;
    }

    if (address.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(
          `/api/autocomplete?q=${encodeURIComponent(address)}`,
          { signal: controller.signal }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Autocomplete failed");
        }

        setSuggestions((data.suggestions || []) as Suggestion[]);
        setShowSuggestions(true);
        setSelectedIndex(-1);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSuggestions([]);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [address]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (hydratedFromUrl.current || typeof window === "undefined") {
      return;
    }
    hydratedFromUrl.current = true;

    const url = new URL(window.location.href);
    const latParam = url.searchParams.get("lat");
    const lngParam = url.searchParams.get("lng");
    if (latParam === null || lngParam === null) {
      return;
    }

    const lat = Number(latParam);
    const lng = Number(lngParam);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      setResult(null);
      setShowSuggestions(false);

      try {
        const response = await fetch(`/api/lookup?lat=${lat}&lng=${lng}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Lookup failed");
        }

        setResult(data);
        if (typeof data.address_used === "string") {
          skipAutocomplete.current = true;
          setAddress(data.address_used);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        if (selectedIndex >= 0) {
          e.preventDefault();
          selectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        break;
    }
  }

  function selectSuggestion(suggestion: Suggestion) {
    skipAutocomplete.current = true;
    setAddress(suggestion.address);
    setShowSuggestions(false);
    setSuggestions([]);
    submitWithCoordinates(suggestion.lat, suggestion.lng, suggestion.address);
  }

  async function submitWithCoordinates(
    lat: number,
    lng: number,
    addressLabel: string
  ) {
    setLoading(true);
    setError(null);
    setResult(null);
    setShowSuggestions(false);

    try {
      const response = await fetch(`/api/lookup?lat=${lat}&lng=${lng}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Lookup failed");
      }

      data.address_used = addressLabel;
      setResult(data);
      setShareCoordinates(data.coordinates.lat, data.coordinates.lng);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function submitAddress(addressToSubmit: string) {
    if (!addressToSubmit.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setShowSuggestions(false);

    try {
      const response = await fetch(
        `/api/lookup?address=${encodeURIComponent(addressToSubmit)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Lookup failed");
      }

      setResult(data);
      setShareCoordinates(data.coordinates.lat, data.coordinates.lng);
      if (typeof data.address_used === "string") {
        skipAutocomplete.current = true;
        setAddress(data.address_used);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddressSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await submitAddress(address);
  }

  async function handleUseLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          let resolvedAddress: string | null = null;
          try {
            const reverseResponse = await fetch(
              `/api/reverse?lat=${latitude}&lng=${longitude}`
            );
            const reverseData = await reverseResponse.json();
            if (reverseResponse.ok && typeof reverseData.address === "string") {
              resolvedAddress = reverseData.address;
            }
          } catch {
            // Reverse geocoding failure should not block lookup.
          }

          const response = await fetch(
            `/api/lookup?lat=${latitude}&lng=${longitude}`
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Lookup failed");
          }

          if (resolvedAddress) {
            data.address_used = resolvedAddress;
          }
          setResult(data);
          setShareCoordinates(data.coordinates.lat, data.coordinates.lng);
          if (typeof data.address_used === "string") {
            skipAutocomplete.current = true;
            setAddress(data.address_used);
          }
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Something went wrong"
          );
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        setError(`Location error: ${err.message}`);
      }
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-ink text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative max-w-3xl mx-auto px-4 py-14 md:py-20 text-center">
          <div className="flex items-center justify-center gap-3 md:gap-4 mb-2">
            <span className="text-accent-sky text-xl md:text-2xl">✶</span>
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight uppercase leading-none">
              {APP_CONFIG.branding.orgName}
            </h1>
            <span className="text-accent-sky text-xl md:text-2xl">✶</span>
          </div>
          <p className="text-white/50 text-base md:text-lg font-body tracking-wide">
            {APP_CONFIG.branding.headerSubtitle}
          </p>
          <div
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-1.5 bg-white/10 border border-white/20 text-accent-sky font-display text-sm font-bold uppercase tracking-wider"
            style={{ animation: "fadeInUp 0.6s ease-out 0.2s both" }}
          >
            <span>◉</span> {APP_CONFIG.branding.electionLabel} <span>◉</span>
          </div>
        </div>
        <div className="h-1.5 bg-accent-coral" />
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-10 md:py-14">
        <div
          className="bg-surface border-l-4 border-accent-coral shadow-lg p-6 md:p-8"
          style={{ animation: "fadeInUp 0.5s ease-out" }}
        >
          <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-wide text-ink mb-6">
            Find Your Ballot
          </h2>

          <button
            onClick={handleUseLocation}
            disabled={loading}
            className="w-full bg-accent-sky text-white py-3.5 px-4 font-body font-semibold text-base
                       hover:brightness-110 active:brightness-95 transition-all duration-150
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-sky
                       flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Spinner />
                Locating...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z"
                  />
                </svg>
                Use My Current Location
              </>
            )}
          </button>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-concrete" />
            <span className="text-xs font-display uppercase tracking-[0.2em] text-steel-light font-semibold">
              or enter address
            </span>
            <div className="flex-1 h-px bg-concrete" />
          </div>

          <form onSubmit={handleAddressSubmit}>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() =>
                  suggestions.length > 0 && setShowSuggestions(true)
                }
                placeholder="Start typing your address..."
                className="w-full border-2 border-concrete px-4 py-3.5
                           focus:border-ink focus:outline-none
                           text-ink placeholder:text-steel-light font-body text-base
                           transition-colors duration-150"
                disabled={loading}
                autoComplete="off"
              />

              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-20 w-full bg-surface border-2 border-ink/10 shadow-xl mt-0.5 max-h-64 overflow-y-auto"
                  style={{ animation: "slideDown 0.15s ease-out" }}
                >
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.address}-${index}`}
                      type="button"
                      onClick={() => selectSuggestion(suggestion)}
                      className={`w-full text-left px-4 py-3 border-b border-concrete/60 last:border-b-0
                                  transition-colors duration-75
                                  ${
                                    index === selectedIndex
                                      ? "bg-ink text-white"
                                      : "hover:bg-warm text-ink"
                                  }`}
                    >
                      <div className="font-medium text-sm">{suggestion.address}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !address.trim()}
              className="w-full bg-ink text-white py-3.5 px-4 font-body font-semibold text-base mt-3
                         hover:bg-ink-soft active:brightness-95 transition-colors duration-150
                         disabled:opacity-30 disabled:cursor-not-allowed
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  Looking up...
                </span>
              ) : (
                "Look Up My Ballot"
              )}
            </button>

            <button
              type="button"
              onClick={handleClearLocation}
              disabled={loading}
              className="w-full border border-ink/20 text-ink py-3 px-4 font-body font-semibold text-sm mt-2
                         hover:bg-warm transition-colors duration-150
                         disabled:opacity-50 disabled:cursor-not-allowed
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Clear Location
            </button>
          </form>
        </div>

        {error && (
          <div
            className="mt-6 bg-accent-coral/10 border-l-4 border-accent-coral p-4"
            style={{ animation: "fadeInUp 0.3s ease-out" }}
          >
            <p className="text-accent-coral font-medium text-sm">{error}</p>
          </div>
        )}

        {result && (
          <div
            className="mt-8 space-y-6"
            style={{ animation: "fadeInUp 0.5s ease-out" }}
          >
            {result.address_used && (
              <div className="flex items-center gap-2 text-sm text-steel">
                <svg
                  className="w-4 h-4 text-accent-sky flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z"
                  />
                </svg>
                <span>{result.address_used}</span>
              </div>
            )}

            <div className="bg-surface p-5 md:p-6 shadow-lg">
              <h3 className="font-display text-sm uppercase tracking-[0.15em] text-steel mb-4 font-bold">
                Endorsed Slate
              </h3>

              {result.endorsements.length > 0 ? (
                <div className="border border-concrete overflow-hidden">
                  <table className="w-full table-fixed border-collapse">
                    <thead>
                      <tr className="bg-warm border-b border-concrete">
                        <th className="text-left px-3 py-2 font-display text-[11px] uppercase tracking-[0.12em] text-steel w-[42%]">
                          Candidate
                        </th>
                        <th className="text-left px-3 py-2 font-display text-[11px] uppercase tracking-[0.12em] text-steel w-[46%]">
                          Race
                        </th>
                        <th className="text-center px-2 py-2 font-display text-[11px] uppercase tracking-[0.12em] text-steel w-[12%]">
                          Party
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.endorsements.map((endorsement, index) => {
                        const level = getRaceLevel(endorsement.race);
                        return (
                          <tr
                            key={`${endorsement.race}-${endorsement.candidate}`}
                            className="border-b border-concrete/80 last:border-b-0"
                            style={{
                              animation: `fadeInUp 0.35s ease-out ${index * 0.05}s both`,
                            }}
                          >
                            <td className="px-3 py-2 align-top">
                              <div className="flex items-start gap-2">
                                <span
                                  className={`mt-1.5 h-2 w-2 flex-shrink-0 ${LEVEL_COLORS[level]}`}
                                  aria-hidden="true"
                                />
                                <span className="font-display text-[15px] md:text-base leading-tight text-ink uppercase tracking-wide">
                                  {endorsement.candidate}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <span className="text-xs md:text-sm text-steel leading-tight">
                                {endorsement.race}
                              </span>
                            </td>
                            <td className="px-2 py-2 align-top text-center">
                              <span className="inline-block text-[11px] font-display font-bold uppercase tracking-wider bg-warm text-steel px-2 py-0.5">
                                {endorsement.party}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-steel text-sm">
                  No endorsements found for your districts.
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="bg-ink text-white/40 py-8 mt-auto">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3 text-accent-sky/50 text-sm">
            <span>◆</span>
            <span>◆</span>
            <span>◆</span>
            <span>◆</span>
          </div>
          <p className="text-xs font-body tracking-wide">
            {APP_CONFIG.branding.orgName} &mdash; {APP_CONFIG.branding.footerBlurb}
          </p>
          <p className="text-xs font-body tracking-wide mt-2">
            Maintained by{" "}
            <a
              href={APP_CONFIG.branding.attributionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-sky/70 hover:text-accent-sky transition-colors duration-150 underline underline-offset-2"
            >
              {APP_CONFIG.branding.attributionName}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
