# CLAUDE.md

Scouting API proof of concept: three adult checks (SYT, membership, positions) on Cloudflare Workers + D1.
Architecture: `docs/architecture.md`. API rules: `docs/api-guidelines.md`. Decisions: `docs/adr/`.

## Commands (run from repo root)

- `npm run setup` - install, create local secrets, migrate + seed local D1, generate contract and client
- `npm run dev` / `npm run dev:web` - API on :8787 (Swagger UI at /docs), sample frontend on :5173
- `npm test` - API tests in workerd with real D1, plus client type tests
- `npm run generate` - re-export `openapi/openapi.json` and client types; run after ANY route, schema, or description change, and commit both outputs
- `npm run ci` - everything CI runs; must pass before you report work done
- `npm run db:reset -w @scouting/api` then `npm run db:verify-seed -w @scouting/api` (with `npm run dev` running) - reseed and check all sample cases
- `npm run dev:token -w @scouting/api` - local sign-in token for the positions check
- `cd infra/tofu && tofu init -backend=false && tofu validate && tofu test` - offline infra checks (mocked provider)

## Rules that are easy to break

- Commits: Conventional Commits with a required body explaining why. PRs are squash merged: the PR title is the header and the PR body is the body, so write both that way (commitlint in `.githooks/commit-msg` and the `commit-messages` workflow)

- Modules (`apps/api/src/modules/*`) import only `src/platform/`, never each other (ESLint enforces)
- `/v1` is POST-only with JSON bodies; no query parameters anywhere (Redocly rules + contract tests enforce)
- The last name is PII: body only, never in URLs, responses, or logs; log only through `log()` in `platform/telemetry.ts`
- Uniform answer rule: every well formed check answers 200; never add a status code, field, or timing difference that reveals why an answer is `notCurrent`
- Contracts are additive within `/v1`; CI `oasdiff` blocks breaking changes
- Migrations are additive (code and schema deploy separately)
- Never edit generated files by hand: `openapi/openapi.json`, `packages/api-client/src/schema.d.ts`, `apps/api/seed/seed.sql`, `docs/sample-data.md`

## Testing

- TDD: write the failing test first and see it fail; tests live only at three seams (HTTP via `test/http.ts`, OpenAPI contract, generated client)
- Fixtures may insert D1 rows to arrange; assert only through HTTP; tables are wiped before each test
- New open checks reuse the shared suite `test/open-adult-check.ts`
- Contract tests pin some description phrases (`spelling`, `my.scouting`, `does not say which`, `open enum`, `000000001`); keep them or update the test
- Rate limiter counters persist across tests (test limit is 50/min in `vitest.config.ts`, prod is 10); use a unique member ID in rate limit tests
- Hono joins header lists without spaces; compare header values as lists

## Gotchas

- Seed data: edit `apps/api/scripts/sample-adults.ts`, never hand-write SQL (last names are HMACs with the local `NAME_HASH_KEY`)
- npm 11 `allowScripts` in root `package.json`: a new dependency with an install script must be approved or denied explicitly (`@scarf/scarf` is denied)
- TypeScript is pinned `~5.9`; ADR 0011 proposes TS 7 + `@typescript/typescript6` alias; verify tool compatibility by running it, not by reading peer ranges
- `apps/api/scripts/` has its own tsconfig (Node + Workers types conflict on `URL`); use `node:path`, not `new URL(...)`, there
- Swagger UI is vendored into `apps/api/public/docs/vendor/` (gitignored) by npm pre-hooks; deploy through `npm run deploy:<env>`, not raw `wrangler deploy`
- Workers native tracing and invocation logs are off on purpose (they record full URLs and SQL); see ADR 0008
- Cloudflare Terraform provider is v5: check schemas at the pinned tag (`docs/resources/*.md` at v5.28.1); one ruleset per zone per phase
- Docker and oasdiff are not available locally; `oasdiff` runs only in CI
- Nothing is deployed, and the deploy workflow is disabled (manual only, gated by the `DEPLOY_ENABLED` repository variable); never run `tofu apply`, `wrangler deploy`, or `wrangler secret put` without explicit approval

## Docs style

- Simplified Technical English (ASD-STE100) on top of the Google developer style: short sentences (20 procedural, 25 descriptive), active voice, no contractions, numbered one-action steps
- No em or en dashes anywhere
- Verify every command, flag, and price before writing it; mark unconfirmed facts `TODO(verify)` with the source
- Do not edit decisions in accepted ADRs; supersede them with a new ADR
