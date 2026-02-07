---
date: 2026-02-04
topic: nextjs-migration
---

# Next.js Full-Stack Migration

## What We're Building

Migrating the district lookup tool from Python/FastAPI to a full JavaScript stack using Next.js. This includes rewriting the backend logic in TypeScript and building a new React frontend.

## Why This Approach

- **Next.js**: Combines React frontend with API routes in one project. Ideal for a first full-stack React project—no need to manage separate frontend/backend repos.
- **Turf.js**: JavaScript equivalent of GeoPandas for point-in-polygon operations. Handles the same GeoJSON files.
- **Tailwind CSS**: Fast utility-first styling without writing custom CSS files.

## Key Decisions

- **Unified JavaScript stack**: Chose to rewrite backend rather than keep Python, enabling a single-language codebase
- **Next.js over Express+CRA**: Simpler architecture for beginners, built-in API routes
- **Turf.js over PostGIS**: Keeps spatial logic in-app without database dependencies
- **Tailwind over plain CSS**: Modern React ecosystem standard, faster development

## Frontend Features

1. **Geolocation button**: "Use my current location" - uses browser Geolocation API
2. **Address form**: Text input for manual address entry

## API Design

- `POST /api/lookup`: Accepts `{ address: string }` OR `{ lat: number, lng: number }`
- Returns `{ coordinates, districts, endorsements }` matching current FastAPI response

## Migration Plan

1. Create `feature/nextjs-migration` branch
2. Initialize Next.js project with TypeScript + Tailwind
3. Port backend logic:
   - Geocoding (US Census API)
   - Point-in-polygon (Turf.js)
   - Endorsement matching
4. Build minimal frontend with both lookup methods
5. Test against existing test cases

## Next Steps

→ Begin implementation on new branch
