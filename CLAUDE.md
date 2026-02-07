# CLAUDE.md

Developer notes for working in this repository.

## Commands

```bash
cd frontend
npm run dev
npm run lint
npm test
npm run test:fast
npm run build
npm start
```

## Architecture

Next.js full-stack app for ballot endorsement lookup by address or coordinates.

Core flow:

1. Address autocomplete and reverse geocoding are provider-backed via `/api/autocomplete` and `/api/reverse`.
2. `/api/lookup` accepts address or `lat/lng`.
3. Coordinates are validated against configured jurisdiction bounds.
4. Turf.js point-in-polygon resolves district layers.
5. Endorsements are matched from `frontend/data/endorsements.yaml`.

## Important Files

- `frontend/src/lib/app-config.ts`: org branding + jurisdiction + map layer config
- `frontend/src/lib/services.ts`: district lookup and endorsement matching logic
- `frontend/src/lib/geocoding/`: geocoder provider implementations
- `frontend/src/app/api/lookup/route.ts`: main lookup endpoint
- `frontend/data/district-maps/`: district boundary GeoJSON packs
- `frontend/data/endorsements.yaml`: endorsement dataset

## Environment Variables

Set exactly one based on the selected provider:

- `GEOCODE_EARTH_API_KEY`
- `MAPBOX_ACCESS_TOKEN`
- `GOOGLE_MAPS_API_KEY`
- `GEOAPIFY_API_KEY`

## Deployment

`railway.toml` and `Dockerfile` are configured for Railway-compatible Docker deploys.
