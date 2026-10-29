# 0004: Put features in modules that use only the platform

**Status:** Accepted (2026-10-28)

## Decision

Each feature is a folder in `apps/api/src/modules/`. The folder exports a `FeatureModule` (tag, base path,
router). A module owns its schemas, repository, migration, seed data, and tests. It imports only from
`src/platform/`. `src/modules/index.ts` is the list of registered modules. The ESLint rule
`no-restricted-imports` enforces this boundary.

## Why

A contributor from a different team can add a feature without reading or changing unrelated code. If you
remove a module, no other module breaks. The team moves shared code into `platform/` only on purpose, after a
review.
