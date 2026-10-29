# 0003: Generate OpenAPI from the code, and only add to contracts

**Status:** Accepted (2026-10-28)

## Decision

- The routes use `@hono/zod-openapi`. One Zod schema gives the request validation, the TypeScript types, and
  the OpenAPI 3.1 document. Thus the docs always agree with the code.
- The repository contains the generated document as `openapi/openapi.json`. A test fails if the document is
  different from the code. CI runs `oasdiff breaking` against the base branch.
- Each path contains the major version (`/v1`). In one major version, a change can only add to the contract
  (see [CONTRIBUTING](../../CONTRIBUTING.md)).
- Enums are open: they accept the known values and any string. Thus a new value does not break generated
  clients. (This ADR first planned an envelope for lists. ADR 0006 removes it, because no list in v1 has
  pages.)
- All errors use RFC 9457 `application/problem+json`.
- Consumers use `@scouting/api-client`, which is generated from the committed contract.

## Consequences

Each pull request (PR) shows contract changes as a diff of `openapi/openapi.json`. Reviewers must look at this
diff first.
