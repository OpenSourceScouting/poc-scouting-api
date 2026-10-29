## Why

<!-- What problem does this solve? Link the issue. -->

## What changed

## Contract checklist

- [ ] Tests written first and seen failing (TDD)
- [ ] `npm run generate` run and `openapi/openapi.json` committed
- [ ] Contract change is additive (new optional fields/operations only), or a new major version is introduced
- [ ] D1 migrations are additive (no dropped/renamed columns in use by the deployed version)
- [ ] Feature code lives in its own `src/modules/<feature>/` and imports only `platform/`
