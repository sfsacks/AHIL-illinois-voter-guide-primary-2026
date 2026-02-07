# Abundant Housing Illinois — Endorsement Guide

Pro-housing voter guide for the **March 17, 2026 Illinois Primary**.

Look up your address to see which candidates Abundant Housing Illinois endorses on your ballot.

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Endorsed Slate

18 candidates across federal, state, and county races — all supporting building more homes in Illinois.

## Environment Variables

Set one geocoding provider key:

- `GEOCODE_EARTH_API_KEY`
- `MAPBOX_ACCESS_TOKEN`
- `GOOGLE_MAPS_API_KEY`
- `GEOAPIFY_API_KEY`

## Tests

```bash
cd frontend
npm run lint
npm run test:fast
```

## Deployment

`railway.toml` and `Dockerfile` are configured for Railway-compatible Docker deploys.

Healthcheck path: `/api/health`

## License

MIT. See `LICENSE`.
