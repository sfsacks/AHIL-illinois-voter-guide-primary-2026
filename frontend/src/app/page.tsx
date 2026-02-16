"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { LookupResponse, Candidate } from "@/lib/types";
import { APP_CONFIG } from "@/lib/app-config";

interface Suggestion {
  address: string;
  lat: number;
  lng: number;
}

type Party = 'D' | 'R' | 'L' | 'all';

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
  const [selectedParty, setSelectedParty] = useState<Party>('all');
  const [expandedRaces, setExpandedRaces] = useState<Set<string>>(new Set());
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, string>>({});
  const [expandedCandidates, setExpandedCandidates] = useState<Set<string>>(new Set());
  const [showEndorsedOnly, setShowEndorsedOnly] = useState(false);

  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [userPrimaryChoice, setUserPrimaryChoice] = useState<'D' | 'R' | 'L' | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const skipAutocomplete = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hydratedFromUrl = useRef(false);
  const ballotBoxRef = useRef<HTMLDivElement>(null);
  const [showStickyProgress, setShowStickyProgress] = useState(false);

  // Categorize races into Federal, State, and Local
  function categorizeRace(raceName: string): 'federal' | 'state' | 'local' {
    const lowerRace = raceName.toLowerCase();
    
    // Federal races
    if (lowerRace.includes('us senate') || lowerRace.includes('u.s. senate') ||
        lowerRace.includes('us house') || lowerRace.includes('u.s. house')) {
      return 'federal';
    }
    
    // State races
    if (lowerRace.includes('governor') || lowerRace.includes('lieutenant governor') ||
        lowerRace.includes('secretary of state') || lowerRace.includes('attorney general') ||
        lowerRace.includes('comptroller') || lowerRace.includes('treasurer') ||
        lowerRace.includes('state senate') || lowerRace.includes('state house') ||
        lowerRace.includes('appellate court')) {
      return 'state';
    }
    
    // Everything else is local
    return 'local';
  }

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
    setSelectedParty('all');
    clearShareCoordinates();
  }

  // Complete onboarding and set party filter
  function completeOnboarding() {
    if (userPrimaryChoice) {
      setSelectedParty(userPrimaryChoice);
    }
    setOnboardingStep(4); // Skip to ballot view
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
        setOnboardingStep(4); // Jump straight to ballot view
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

  function handleKeyDown(e: React.KeyboardEvent, shouldAdvance = false) {
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
          selectSuggestion(suggestions[selectedIndex], shouldAdvance);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        break;
    }
  }

  function selectSuggestion(suggestion: Suggestion, shouldAdvance = false) {
    skipAutocomplete.current = true;
    setAddress(suggestion.address);
    setShowSuggestions(false);
    setSuggestions([]);
    submitWithCoordinates(suggestion.lat, suggestion.lng, suggestion.address, shouldAdvance);
  }

  async function submitWithCoordinates(
    lat: number,
    lng: number,
    addressLabel: string,
    shouldAdvance = false
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

      setResult(data);
      skipAutocomplete.current = true;
      setAddress(addressLabel);
      setShareCoordinates(lat, lng);
      if (shouldAdvance) {
        completeOnboarding();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGeolocate() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setShowSuggestions(false);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

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
          setShareCoordinates(lat, lng);
          completeOnboarding();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        setError("Unable to retrieve your location");
      },
      {
        timeout: 10000,
        enableHighAccuracy: false,
      }
    );
  }

  async function handleAddressSubmit(e: React.FormEvent, shouldAdvance = false) {
    e.preventDefault();

    if (!address.trim() || loading) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setShowSuggestions(false);

    try {
      const response = await fetch(
        `/api/lookup?address=${encodeURIComponent(address)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Lookup failed");
      }

      setResult(data);
      if (typeof data.address_used === "string") {
        skipAutocomplete.current = true;
        setAddress(data.address_used);
      }
      if (data.lat != null && data.lng != null) {
        setShareCoordinates(data.lat, data.lng);
      }
      if (shouldAdvance) {
        completeOnboarding();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Filter candidates by selected party - use candidates if available, fallback to endorsements
  const candidatesData: Candidate[] = result?.candidates || result?.endorsements?.map(e => ({ ...e, endorsed: e.endorsed ?? true })) || [];
  const filteredCandidates = candidatesData.filter((candidate) => {
    if (selectedParty !== 'all' && candidate.party !== selectedParty) return false;
    if (showEndorsedOnly && !candidate.endorsed) return false;
    return true;
  });

  // Group candidates by race
  const candidatesByRace = filteredCandidates.reduce((acc, candidate) => {
    if (!acc[candidate.race]) {
      acc[candidate.race] = [];
    }
    acc[candidate.race].push(candidate);
    return acc;
  }, {} as Record<string, typeof filteredCandidates>);

  // Group races by category
  const racesByCategory = Object.keys(candidatesByRace).reduce((acc, race) => {
    const category = categorizeRace(race);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(race);
    return acc;
  }, {} as Record<'federal' | 'state' | 'local', string[]>);

  const categoryOrder: ('federal' | 'state' | 'local')[] = ['federal', 'state', 'local'];
  const categoryLabels = {
    federal: 'FEDERAL',
    state: 'STATE OF ILLINOIS',
    local: 'LOCAL'
  };

  // Ballot page configuration for multi-page flow
  const stepToCategory: Record<number, 'federal' | 'state' | 'local'> = {
    4: 'federal', 5: 'state', 6: 'local'
  };
  const ballotPageConfig: Record<number, {
    backStep: number; backLabel: string;
    nextStep: number | null; nextLabel: string | null;
    showSavePdfShare: boolean;
  }> = {
    4: { backStep: 2, backLabel: '← Back', nextStep: 5, nextLabel: 'Go to State of Illinois', showSavePdfShare: false },
    5: { backStep: 4, backLabel: '← Back to Federal', nextStep: 6, nextLabel: 'Go to Local', showSavePdfShare: false },
    6: { backStep: 5, backLabel: '← Back to State of Illinois', nextStep: null, nextLabel: null, showSavePdfShare: true },
  };
  const activeCategory = stepToCategory[onboardingStep] ?? null;
  const isBallotStep = onboardingStep >= 4 && onboardingStep <= 6;
  const activePageRaces = activeCategory ? (racesByCategory[activeCategory] || []) : [];

  // Auto-select endorsed candidates when results change
  useEffect(() => {
    if (result?.candidates) {
      const endorsedSelections: Record<string, string> = {};
      result.candidates.forEach(candidate => {
        if (candidate.endorsed) {
          // Only auto-select if user hasn't made a selection for this race yet
          if (!selectedCandidates[candidate.race]) {
            endorsedSelections[candidate.race] = candidate.candidate;
          }
        }
      });
      if (Object.keys(endorsedSelections).length > 0) {
        setSelectedCandidates(prev => ({
          ...endorsedSelections,
          ...prev // Keep any user selections
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // Show sticky progress bar when "Your Ballot" box scrolls out of view
  useEffect(() => {
    const el = ballotBoxRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyProgress(!entry.isIntersecting);
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onboardingStep, result]);

  // Toggle race expansion
  const toggleRace = (race: string) => {
    setExpandedRaces(prev => {
      const newSet = new Set(prev);
      if (newSet.has(race)) {
        newSet.delete(race);
      } else {
        newSet.add(race);
      }
      return newSet;
    });
  };

  // Select a candidate for a race
  const selectCandidate = (race: string, candidateName: string) => {
    setSelectedCandidates(prev => {
      // If clicking the already selected candidate, deselect it
      if (prev[race] === candidateName) {
        const { [race]: _, ...rest } = prev;
        return rest;
      }
      // Otherwise, select the new candidate
      return {
        ...prev,
        [race]: candidateName
      };
    });
  };

  // Toggle candidate details expansion
  const toggleCandidateDetails = (candidateKey: string) => {
    setExpandedCandidates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(candidateKey)) {
        newSet.delete(candidateKey);
      } else {
        newSet.add(candidateKey);
      }
      return newSet;
    });
  };

  // Expand all races on current page
  const expandAll = () => {
    setExpandedRaces(prev => {
      const newSet = new Set(prev);
      activePageRaces.forEach(race => newSet.add(race));
      return newSet;
    });
  };

  // Collapse all races on current page
  const collapseAll = () => {
    const racesOnPage = new Set(activePageRaces);
    setExpandedRaces(prev => {
      const newSet = new Set(prev);
      racesOnPage.forEach(race => newSet.delete(race));
      return newSet;
    });
  };

  // Calculate progress
  const totalRaces = Object.keys(candidatesByRace).length;
  const completedRaces = Object.keys(selectedCandidates).filter(race => 
    candidatesByRace[race] // Only count if race exists in current filtered view
  ).length;
  const progressPercentage = totalRaces > 0 ? Math.round((completedRaces / totalRaces) * 100) : 0;

  // Get party button styling
  const getPartyButtonClass = (party: Party) => {
    const isSelected = selectedParty === party;
    const baseClasses = "px-3 py-1.5 text-xs font-medium transition-all duration-150 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2";
    
    if (isSelected) {
      return `${baseClasses} bg-ink text-white shadow-sm`;
    }
    return `${baseClasses} bg-white border border-border text-ink hover:bg-warm`;
  };

  // Generate PDF content as HTML
  const generateBallotPDF = () => {
    const partyName = userPrimaryChoice === 'D' ? 'Democratic' : userPrimaryChoice === 'R' ? 'Republican' : 'Libertarian';
    const now = new Date();
    const date = now.toLocaleDateString();
    
    // Format time as 12-hour with AM/PM
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert 0 to 12 for midnight
    const displayMinutes = minutes.toString().padStart(2, '0');
    const timestamp = `${displayHours}:${displayMinutes} ${ampm}`;
    
    // TODO: Replace this placeholder with actual base64 of ahil-logo.png
    // You can get this by running: cat ahil-logo.png | base64
    const logoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAE5SURBVDiNpZO9SgNBFIW/2U0MmBTBQrAQsbGwsBULwUKwsRDs7K3Ey1jZWthY+ABWPoGVhY2FjY2FjY2NjZWNhY1gI5hNzO7OeCEQE7Mmu3Dh3pk558ydmSuqSl00AAtYBhaAJtAAPgEX6AHdKIoi1dQfABfYBJaBJWAeaAA94Bx4Ah6BGFWlDmwBe0ALmAVc4Ah4BB6ACFVNYBvYBxaBeWAGeAfugQfgFYhRVQe2gUNgEZgDpoE34A64A56BCFWdBHaBY2AJmAOmgFfgFrgBXoAYVXWBPeAEWAbmgEngGbgGboFnIEJVHeAQOAVWgAYwDjwC18AV8AxEqKoNHACnwCowBowBD8AlcAm8ABGqagEHwDmwBowCw8A9cAFcAC9AhKpawCFwAawDI8AQ0AYugHPgFYhQ1X/5AYTCeXxqv4UaAAAAAElFTkSuQmCC';
    
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Ballot - ${partyName} Primary</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');
    
    body {
      font-family: 'Poppins', sans-serif;
      margin: 0;
      padding: 20px;
      background: #F5F5F4;
      color: #1a1a1a;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      overflow: hidden;
    }
    .header {
      background: #1A3885;
      color: white;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 8px 0;
      font-size: 24px;
      font-weight: 600;
    }
    .header p {
      margin: 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 24px;
    }
    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 16px;
      margin-top: 0;
    }
    .meta {
      background: #F5F5F4;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 24px;
      font-size: 14px;
      color: #6B7280;
    }
    .category-header {
      background: #E5E7EB;
      padding: 8px 12px;
      margin: 20px 0 12px 0;
      font-size: 13px;
      font-weight: 600;
      color: #1a1a1a;
      letter-spacing: 0.5px;
    }
    .category-header:first-of-type {
      margin-top: 0;
    }
    .race {
      margin-bottom: 12px;
    }
    .candidate-card {
      background: white;
      border: 1px solid #E5E7EB;
      border-radius: 6px;
      padding: 14px 16px;
      margin-bottom: 8px;
    }
    .race-title {
      font-size: 13px;
      font-weight: 400;
      color: #6B7280;
      margin-bottom: 8px;
      text-transform: capitalize;
    }
    .candidate-info {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
    }
    .candidate-name {
      font-weight: 500;
      font-size: 15px;
      color: #1a1a1a;
    }
    .incumbent-indicator {
      font-size: 12px;
      color: #6B7280;
    }
    .ahil-logo {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      display: inline-block;
      vertical-align: middle;
    }
    .party-badge {
      font-size: 12px;
      color: #6B7280;
      background: #F5F5F4;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid rgba(209, 213, 219, 0.5);
      flex-shrink: 0;
    }
    .footer {
      text-align: center;
      padding: 16px;
      font-size: 12px;
      color: #6B7280;
      border-top: 1px solid #E5E7EB;
    }
    .footnote {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #E5E7EB;
      font-size: 12px;
      color: #6B7280;
    }
    @media print {
      body { background: white; }
      .container { border: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>My ${partyName} Primary Ballot</h1>
      <p>March 17, 2026 • Illinois</p>
    </div>
    <div class="content">
      <div class="meta">
        <strong>Saved:</strong> ${date} at ${timestamp}
      </div>
      <h2 class="section-title">Your Selections</h2>
`;

    // Group selections by category
    const selectionsByCategory: Record<string, Array<{race: string, candidates: Candidate[]}>> = {
      federal: [],
      state: [],
      local: []
    };

    Object.entries(candidatesByRace).forEach(([race, candidates]) => {
      const selectedCandidate = selectedCandidates[race];
      if (selectedCandidate) {
        const category = categorizeRace(race);
        selectionsByCategory[category].push({ race, candidates });
      }
    });

    // Add each category with its races
    categoryOrder.forEach(category => {
      const races = selectionsByCategory[category];
      if (races.length === 0) return; // Skip empty categories
      
      html += `<div class="category-header">${categoryLabels[category]}</div>`;
      
      races.forEach(({ race, candidates }) => {
        const selectedCandidate = selectedCandidates[race];
        html += `<div class="race">`;
        
        candidates.forEach(candidate => {
          const isSelected = selectedCandidate === candidate.candidate;
          if (!isSelected) return;
          
          html += `
          <div class="candidate-card">
            <div class="race-title">${race}</div>
            <div class="candidate-info">
              <span class="candidate-name">${candidate.candidate}</span>
              ${candidate.incumbent ? '<span class="incumbent-indicator">(i)</span>' : ''}
              ${candidate.endorsed ? `<img src="${logoBase64}" alt="AHIL Endorsed" class="ahil-logo" />` : ''}
              <span class="party-badge">${candidate.party}</span>
            </div>
          </div>
          `;
        });
        
        html += `</div>`;
      });
    });

    html += `
      <div class="footnote">
        (i) = Incumbent
      </div>
      <div class="footer">
        Generated by Abundant Housing Illinois Voter Guide<br>
        abundanthousingillinois.org
      </div>
    </div>
  </div>
</body>
</html>
    `;
    
    return html;
  };

  return (
    <div className="min-h-screen flex flex-col bg-warm">
      {/* Step 1: Welcome Screen */}
      {onboardingStep === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="max-w-md w-full text-center">
            <h1 className="text-3xl md:text-4xl font-medium italic text-ink mb-6">
              The Rent is Too Damn High!
              <Image
                src="/jimmy-mcmillan-too-damn-high.gif"
                alt="The rent is too damn high"
                width={360}
                height={280}
                className="mx-auto mt-4 mb-6 rounded-sm"
              />
            </h1>
            <p className="text-base md:text-lg text-steel mb-8 leading-relaxed">
              And you can change that! This voter guide, powered by Abundant Housing Illinois, makes it easy to pick candidates in the March 17, 2026 primary election who want to help you afford your rent.
            </p>
            <button
              onClick={() => setOnboardingStep(1)}
              className="w-full bg-brand text-white py-4 px-6 font-medium text-base rounded-sm
                         hover:brightness-110 active:brightness-95 transition-all duration-150
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Primary Selection */}
      {onboardingStep === 1 && (
        <>
        <header className="bg-ink text-white">
          <div className="w-full px-4 md:px-6 py-3">
            <div className="max-w-6xl mx-auto text-center">
              <h1 className="font-display text-xl font-medium">
                <span className="italic">The Rent is Too Damn High!</span> Voter Guide
              </h1>
              <p className="text-xs text-white/80 mt-0.5">
                {APP_CONFIG.branding.headerSubtitle}
              </p>
            </div>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="max-w-md w-full bg-surface border border-border rounded-sm p-8 shadow-sm">
            <h2 className="font-display text-xl font-medium text-ink mb-3">
              Which primary are you voting in?
            </h2>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setUserPrimaryChoice('D');
                  setOnboardingStep(2);
                }}
                className="w-full bg-white border-2 border-border hover:border-brand text-ink py-4 px-6 rounded-sm
                           transition-all duration-150 text-left flex items-center justify-between group"
              >
                <div>
                  <div className="font-medium text-base">Democratic Primary</div>
                  <div className="text-xs text-steel mt-0.5">Vote for Democratic candidates</div>
                </div>
                <div className="text-2xl group-hover:text-brand transition-colors">→</div>
              </button>

              <button
                onClick={() => {
                  setUserPrimaryChoice('R');
                  setOnboardingStep(2);
                }}
                className="w-full bg-white border-2 border-border hover:border-brand text-ink py-4 px-6 rounded-sm
                           transition-all duration-150 text-left flex items-center justify-between group"
              >
                <div>
                  <div className="font-medium text-base">Republican Primary</div>
                  <div className="text-xs text-steel mt-0.5">Vote for Republican candidates</div>
                </div>
                <div className="text-2xl group-hover:text-brand transition-colors">→</div>
              </button>

              <button
                onClick={() => {
                  setUserPrimaryChoice('L');
                  setOnboardingStep(2);
                }}
                className="w-full bg-white border-2 border-border hover:border-brand text-ink py-4 px-6 rounded-sm
                           transition-all duration-150 text-left flex items-center justify-between group"
              >
                <div>
                  <div className="font-medium text-base">Libertarian Primary</div>
                  <div className="text-xs text-steel mt-0.5">Vote for Libertarian candidates</div>
                </div>
                <div className="text-2xl group-hover:text-brand transition-colors">→</div>
              </button>
            </div>

            <button
              onClick={() => setOnboardingStep(0)}
              className="w-full mt-6 text-steel hover:text-ink text-sm transition-colors flex items-center justify-center gap-1"
            >
              ← Back
            </button>
          </div>
        </div>
        <footer className="bg-ink text-white/40 py-6">
          <div className="max-w-xl mx-auto px-4 text-center">
            <p className="text-xs font-body">
              {APP_CONFIG.branding.orgName} &mdash; {APP_CONFIG.branding.footerBlurb}
            </p>
            <p className="text-xs font-body mt-1.5">
              Maintained by{" "}
              <a
                href={APP_CONFIG.branding.attributionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 hover:text-white transition-colors duration-150 underline underline-offset-2"
              >
                {APP_CONFIG.branding.attributionName}
              </a>
            </p>
          </div>
        </footer>
        </>
      )}

      {/* Step 3: Address Entry */}
      {onboardingStep === 2 && (
        <>
        <header className="bg-ink text-white">
          <div className="w-full px-4 md:px-6 py-3">
            <div className="max-w-6xl mx-auto text-center">
              <h1 className="font-display text-xl font-medium">
                <span className="italic">The Rent is Too Damn High!</span> Voter Guide
              </h1>
              <p className="text-xs text-white/80 mt-0.5">
                {APP_CONFIG.branding.headerSubtitle}
              </p>
            </div>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="max-w-md w-full bg-surface border border-border rounded-sm p-8 shadow-sm">
            <h2 className="font-display text-2xl font-medium text-ink mb-3">
              Enter your address
            </h2>
            <p className="text-steel text-sm mb-6">
              We'll show you the candidates on your specific ballot based on where you live.
            </p>

            <button
              type="button"
              onClick={handleGeolocate}
              disabled={loading}
              className="w-full bg-brand text-white py-3 px-4 font-medium text-sm rounded-sm mb-4
                         hover:brightness-110 active:brightness-95 transition-all duration-150
                         disabled:opacity-50 disabled:cursor-not-allowed
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand
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
                    className="w-4 h-4"
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
                  Use my current location
                </>
              )}
            </button>

            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-steel-light">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={(e) => handleAddressSubmit(e, true)}>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, true)}
                  onFocus={() =>
                    suggestions.length > 0 && setShowSuggestions(true)
                  }
                  placeholder="Start typing your address..."
                  className="w-full border border-border rounded-sm px-3 py-2.5
                             focus:border-ink focus:outline-none
                             text-ink placeholder:text-steel-light text-sm
                             transition-colors duration-150"
                  disabled={loading}
                  autoComplete="off"
                />

                {showSuggestions && suggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-20 w-full bg-surface border border-border rounded-sm shadow-md mt-0.5 max-h-64 overflow-y-auto"
                    style={{ animation: "slideDown 0.15s ease-out" }}
                  >
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={`${suggestion.address}-${index}`}
                        type="button"
                        onClick={() => selectSuggestion(suggestion, true)}
                        className={`w-full text-left px-3 py-2.5 border-b border-border/60 last:border-b-0
                                    transition-colors duration-75
                                    ${
                                      index === selectedIndex
                                        ? "bg-ink text-white"
                                        : "hover:bg-warm text-ink"
                                    }`}
                      >
                        <div className="text-sm">{suggestion.address}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !address.trim()}
                className="w-full bg-ink text-white py-3 px-4 font-medium text-sm mt-3 rounded-sm
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
                  "Continue"
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 bg-brand-light border border-brand/20 rounded-sm p-3">
                <p className="text-brand text-xs">{error}</p>
              </div>
            )}

            <button
              onClick={() => setOnboardingStep(1)}
              className="w-full mt-4 text-steel hover:text-ink text-sm transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>
        <footer className="bg-ink text-white/40 py-6">
          <div className="max-w-xl mx-auto px-4 text-center">
            <p className="text-xs font-body">
              {APP_CONFIG.branding.orgName} &mdash; {APP_CONFIG.branding.footerBlurb}
            </p>
            <p className="text-xs font-body mt-1.5">
              Maintained by{" "}
              <a
                href={APP_CONFIG.branding.attributionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 hover:text-white transition-colors duration-150 underline underline-offset-2"
              >
                {APP_CONFIG.branding.attributionName}
              </a>
            </p>
          </div>
        </footer>
        </>
      )}

      {/* Step 4: Main Ballot View */}
      {isBallotStep && result && (
        <>
          <header className="bg-ink text-white">
            <div className="w-full px-4 md:px-6 py-3">
              <div className="max-w-6xl mx-auto text-center">
                <h1 className="font-display text-xl font-medium">
                  <span className="italic">The Rent is Too Damn High!</span> Voter Guide
                </h1>
                <p className="text-xs text-white/80 mt-0.5">
                  {APP_CONFIG.branding.headerSubtitle}
                </p>
              </div>
            </div>
          </header>

          {/* Sticky progress bar - appears when Your Ballot box scrolls out of view */}
          {showStickyProgress && totalRaces > 0 && (
            <div className="sticky top-0 z-30 bg-surface border-b border-border shadow-sm px-4 md:px-6 py-3">
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-steel">
                    {completedRaces} of {totalRaces} completed
                  </span>
                  <span className="text-xs font-medium text-ink bg-surface border border-border rounded px-2 py-0.5">
                    {progressPercentage}%
                  </span>
                </div>
                <div className="w-full bg-border/30 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-brand h-full transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <main className="flex-1 w-full px-4 md:px-6 py-6">
            <div className="max-w-6xl mx-auto">
              {/* Address display and change button */}
              {result.address_used && (
                <div className="bg-surface border border-border rounded-sm p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-xs text-steel mb-1">Your address:</p>
                    <p className="text-sm text-ink font-medium">{result.address_used}</p>
                  </div>
                  <button
                    onClick={() => {
                      setOnboardingStep(2); // Go back to address entry
                      setResult(null);
                      skipAutocomplete.current = true;
                      setAddress("");
                      clearShareCoordinates();
                    }}
                    className="text-sm text-brand hover:underline flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Change Address
                  </button>
                </div>
              )}

              <div ref={ballotBoxRef} className="bg-surface border border-border rounded-sm p-4 md:p-5">
                <div className="mb-4">
                  <div className="mb-4">
                    <h3 className="font-display text-base font-medium text-ink mb-1">
                      Your Ballot
                    </h3>
                    {activeCategory && (
                      <p className="text-sm font-semibold text-ink uppercase tracking-wide mb-1">
                        {categoryLabels[activeCategory]}
                      </p>
                    )}
                    <p className="text-xs text-steel mb-4">
                      Tap to select candidates. Your choices are automatically saved.
                    </p>

                </div>

                {/* Progress Bar */}
                {totalRaces > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-steel">
                        {completedRaces} of {totalRaces} completed
                      </span>
                      <span className="text-xs font-medium text-ink bg-surface border border-border rounded px-2 py-0.5">
                        {progressPercentage}%
                      </span>
                    </div>
                    <div className="w-full bg-border/30 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-brand h-full transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>
                )}
                </div>
              </div>

              {Object.keys(candidatesByRace).length > 0 ? (
                <>
                  {selectedParty !== 'all' && (
                    <p className="text-xs text-steel mb-3">
                      Showing {selectedParty === 'D' ? 'Democratic' : selectedParty === 'R' ? 'Republican' : 'Libertarian'} primary candidates only
                    </p>
                  )}

                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={expandAll}
                      className="inline-flex items-center text-xs px-2.5 py-1 rounded-full border bg-white text-steel border-border hover:border-brand hover:text-brand transition-colors duration-150"
                    >
                      Expand All
                    </button>
                    <button
                      onClick={collapseAll}
                      className="inline-flex items-center text-xs px-2.5 py-1 rounded-full border bg-white text-steel border-border hover:border-brand hover:text-brand transition-colors duration-150"
                    >
                      Collapse All
                    </button>
                    <button
                      onClick={() => setShowEndorsedOnly(!showEndorsedOnly)}
                      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors duration-150 ${
                        showEndorsedOnly
                          ? 'bg-brand text-white border-brand'
                          : 'bg-white text-steel border-border hover:border-brand hover:text-brand'
                      }`}
                      title={showEndorsedOnly ? "Show all candidates" : "Show endorsed candidates only"}
                    >
                      {/* Hamburger/filter icon */}
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                        <line x1="4" y1="6" x2="20" y2="6" />
                        <line x1="4" y1="12" x2="20" y2="12" />
                        <line x1="4" y1="18" x2="20" y2="18" />
                      </svg>
                      AHIL Endorsed
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to clear all your selections?')) {
                          setSelectedCandidates({});
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-white text-steel border-border hover:border-brand hover:text-brand transition-colors duration-150"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Clear All
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {activePageRaces.length > 0 ? (
                      activePageRaces.map(race => {
                              const candidates = candidatesByRace[race];
                              const isExpanded = expandedRaces.has(race);
                              const endorsedCount = candidates.filter(c => c.endorsed).length;
                              
                              return (
                                <div key={race} className="border border-border rounded-sm overflow-hidden">
                                  {/* Race Header - Clickable */}
                                  <button
                                    onClick={() => toggleRace(race)}
                                    className="w-full px-4 py-3 bg-warm hover:bg-warm/70 transition-colors flex items-center justify-between text-left"
                                  >
                                    <div className="flex-1">
                                      <h4 className="font-medium text-ink text-sm">{race}</h4>
                                      <p className="text-xs text-steel mt-0.5">
                                        {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
                                        {endorsedCount > 0 && (
                                          <span className="ml-2">
                                            • {endorsedCount} endorsed
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      {/* Checkmark if user has selected a candidate */}
                                      {selectedCandidates[race] && (
                                        <span 
                                          className="inline-block w-5 h-5 rounded-full bg-brand text-white text-xs leading-5 text-center"
                                          title="You've made a selection"
                                        >
                                          ✓
                                        </span>
                                      )}
                                      
                                      {/* Chevron */}
                                      <svg
                                        className={`w-5 h-5 text-steel transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </button>

                                  {/* Candidates List - Shown when expanded */}
                                  {isExpanded && (
                                    <div className="border-t border-border bg-surface">
                                      <div className="divide-y divide-border/50">
                                        {candidates.map((candidate, index) => {
                                          const candidateKey = `${race}-${candidate.candidate}`;
                                          const isSelected = selectedCandidates[race] === candidate.candidate;
                                          const isDetailsExpanded = expandedCandidates.has(candidateKey);
                                          
                                          return (
                                            <div key={candidateKey} className="hover:bg-warm/30 transition-colors">
                                              {/* Candidate Row */}
                                              <div
                                                onClick={() => selectCandidate(race, candidate.candidate)}
                                                className="w-full px-4 py-3 flex items-center gap-3 cursor-pointer"
                                              >
                                                {/* Candidate Info */}
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-medium text-ink text-sm">
                                                      {candidate.candidate}
                                                    </span>
                                                    {/* Incumbent Indicator */}
                                                    {candidate.incumbent && (
                                                      <span className="text-xs text-steel">(i)</span>
                                                    )}
                                                    {/* AHIL Logo (if endorsed) - overflow-visible wrapper so 32px logo doesn't affect row height */}
                                                    {candidate.endorsed && (
                                                      <div className="flex-shrink-0 h-[1.25rem] flex items-center overflow-visible" title="Endorsed by Abundant Housing IL">
                                                        <Image
                                                          src="/ahil-logo.png"
                                                          alt="AHIL Endorsed"
                                                          width={32}
                                                          height={32}
                                                          className="object-contain"
                                                        />
                                                      </div>
                                                    )}
                                                  </div>
                                                  <div className="flex items-center gap-2 mt-0.5">
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleCandidateDetails(candidateKey);
                                                      }}
                                                      className="text-xs text-steel hover:text-brand flex items-center gap-1"
                                                    >
                                                      View details
                                                      <svg
                                                        className={`w-3 h-3 transition-transform ${isDetailsExpanded ? 'rotate-180' : ''}`}
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                      >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                      </svg>
                                                    </button>
                                                  </div>
                                                </div>

                                                {/* Party Badge */}
                                                <div className="flex-shrink-0">
                                                  <span className="text-xs text-steel px-2 py-1 bg-warm rounded border border-border/50">
                                                    {candidate.party}
                                                  </span>
                                                </div>

                                                {/* Radio Button */}
                                                <div className="flex-shrink-0">
                                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                                    isSelected
                                                      ? 'border-brand bg-brand'
                                                      : 'border-steel/40 bg-white'
                                                  }`}>
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Expanded Details Section */}
                                              {isDetailsExpanded && (
                                                <div className="px-4 pb-4 pl-12 space-y-3 bg-warm/20 border-t border-border/30">
                                                  {/* Campaign Website */}
                                                  {candidate.website && (
                                                    <div className="pt-3">
                                                      <a
                                                        href={candidate.website}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-brand hover:underline inline-flex items-center gap-1"
                                                        onClick={(e) => e.stopPropagation()}
                                                      >
                                                        🔗 Campaign Website
                                                      </a>
                                                    </div>
                                                  )}

                                                  {/* Issue Positions */}
                                                  <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                      <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                      </svg>
                                                      <h6 className="font-medium text-ink text-xs uppercase tracking-wide">Issue Positions</h6>
                                                    </div>
                                                    <div className="space-y-2 pl-6">
                                                      {/* Placeholder for future issue data */}
                                                      <div className="bg-surface rounded px-3 py-2 border border-border/30">
                                                        <p className="text-xs text-steel italic">
                                                          Issue position data coming soon
                                                        </p>
                                                      </div>
                                                    </div>
                                                  </div>

                                                  {/* Other Endorsements */}
                                                  <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                      <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                      </svg>
                                                      <h6 className="font-medium text-ink text-xs uppercase tracking-wide">Endorsed By</h6>
                                                    </div>
                                                    <div className="pl-6">
                                                      {/* Placeholder for future endorsement data */}
                                                      {candidate.endorsed ? (
                                                        <div className="flex flex-wrap gap-1.5">
                                                          <span className="inline-block text-xs bg-brand/10 text-brand px-2 py-1 rounded border border-brand/20">
                                                            Abundant Housing IL
                                                          </span>
                                                          <span className="text-xs text-steel italic px-2 py-1">
                                                            Additional endorsements coming soon
                                                          </span>
                                                        </div>
                                                      ) : (
                                                        <p className="text-xs text-steel italic">
                                                          Endorsement data coming soon
                                                        </p>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                    })
                    ) : (
                      <p className="text-steel text-sm py-4">
                        No {activeCategory ? categoryLabels[activeCategory] : ''} races found for your districts.
                      </p>
                    )}
                  </div>

                  {/* Footnote for incumbent indicator */}
                  <div className="mt-6 pt-4 border-t border-border">
                    <p className="text-xs text-steel">
                      (i) = Incumbent
                    </p>
                  </div>

                  {/* Go to Next Section button */}
                  {ballotPageConfig[onboardingStep]?.nextStep && (
                    <div className="mt-4">
                      <button
                        onClick={() => {
                          setOnboardingStep(ballotPageConfig[onboardingStep].nextStep!);
                          window.scrollTo({ top: 0 });
                        }}
                        className="w-full bg-brand text-white py-3 px-4 rounded-sm font-medium text-sm
                                   hover:brightness-110 active:brightness-95 transition-all duration-150
                                   flex items-center justify-center gap-2"
                      >
                        {ballotPageConfig[onboardingStep].nextLabel}
                        <span>→</span>
                      </button>
                    </div>
                  )}

                  {/* Action Buttons - only on Local page */}
                  {ballotPageConfig[onboardingStep]?.showSavePdfShare && (
                    <div className="bg-surface border border-border rounded-sm p-4 md:p-5 mt-6">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const pdfContent = generateBallotPDF();
                            const blob = new Blob([pdfContent], { type: 'text/html' });
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                          }}
                          className="flex-1 bg-ink text-white py-3 px-4 rounded-sm font-medium text-sm
                                     hover:bg-ink-soft transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Save PDF
                        </button>
                        <button
                          onClick={() => {
                            if (navigator.share) {
                              navigator.share({
                                title: 'My Ballot - Illinois Primary 2026',
                                text: `I've completed my ballot for the ${userPrimaryChoice === 'D' ? 'Democratic' : userPrimaryChoice === 'R' ? 'Republican' : 'Libertarian'} primary!`,
                                url: window.location.href
                              }).catch(() => {});
                            } else {
                              navigator.clipboard.writeText(window.location.href);
                              alert('Link copied to clipboard!');
                            }
                          }}
                          className="flex-1 bg-white border border-border text-ink py-3 px-4 rounded-sm font-medium text-sm
                                     hover:bg-warm transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          Share
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Back button */}
                  <div className="mt-6 text-center">
                    <button
                      onClick={() => {
                        const backStep = ballotPageConfig[onboardingStep]?.backStep ?? 2;
                        if (backStep === 2) {
                          setResult(null);
                        }
                        setOnboardingStep(backStep);
                        window.scrollTo({ top: 0 });
                      }}
                      className="text-steel hover:text-ink text-sm transition-colors"
                    >
                      {ballotPageConfig[onboardingStep]?.backLabel ?? '← Back'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-steel text-sm">
                  {selectedParty === 'all' 
                    ? "No candidates found for your districts."
                    : `No ${selectedParty === 'D' ? 'Democratic' : selectedParty === 'R' ? 'Republican' : 'Libertarian'} primary candidates found for your districts.`
                  }
                </p>
              )}
              </div>
      </main>

      <footer className="bg-ink text-white/40 py-6 mt-auto">
        <div className="max-w-xl mx-auto px-4 text-center">
          <p className="text-xs font-body">
            {APP_CONFIG.branding.orgName} &mdash; {APP_CONFIG.branding.footerBlurb}
          </p>
          <p className="text-xs font-body mt-1.5">
            Maintained by{" "}
            <a
              href={APP_CONFIG.branding.attributionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/70 hover:text-white transition-colors duration-150 underline underline-offset-2"
            >
              {APP_CONFIG.branding.attributionName}
            </a>
          </p>
        </div>
      </footer>
        </>
      )}
    </div>
  );
}