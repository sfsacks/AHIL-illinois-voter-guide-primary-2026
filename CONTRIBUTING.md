# Contributing

Thanks for contributing to Ballot Endorsement Guide.

## Development

1. Install dependencies:
   - `cd frontend`
   - `npm ci`
2. Run locally: `npm run dev`
3. Run checks before opening a PR:
   - `npm run lint`
   - `npm test`

## Pull Requests

- Keep PRs focused and small where possible.
- Include tests for behavior changes.
- Update docs/config examples if behavior changes.

## Data Contributions

- District map files should be valid GeoJSON.
- Keep large data changes isolated from code refactors.
- Do not commit secrets or API credentials.
