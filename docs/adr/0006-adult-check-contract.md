# 0006: Use one contract for all adult checks

**Status:** Accepted (2026-10-28). ADR 0010 supersedes the methods and the caching. Source: "Open Source
Position - API One Pager" (draft for National IT).

## Decision

Version 1 has three checks about one adult (all `POST`, see ADR 0010). Each check identifies the adult by the
member ID and the last name together:

- YPT (module `ypt`)
- Membership (module `membership`)
- Positions in one named organization (module `positions`)

Each check has its own feature module and its own table. The team added them in this order, which agrees with
steps 2 to 4 of the one-pager.

The shared contract is in `src/platform/`. Tests enforce it, as the table shows:

| Rule                                                                                                                                         | Location                                | Test                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------- |
| One response shape. The API calculates `status`. `expiresAt` is null unless the answer is current.                                           | `adult-check.ts`                        | `test/open-adult-check.ts`              |
| The uniform answer rule: an unknown ID, a youth ID, a wrong name, an expired record, and a wrong organization all give the same `notCurrent` | `evaluate()`                            | The same suite, and the positions tests |
| Last name normalization and keyed HMAC storage. The API never returns or logs the last name.                                                 | `normalizeLastName()`, `hashLastName()` | The same suite, and the log tests       |
| No cache (`no-store`). The access log records abuse signals.                                                                                 | `respond()`                             | The same suite, and the log tests       |
| Open enums (`anyOf` the known values or any string)                                                                                          | `openapi.ts`                            | `test/contract.test.ts`                 |
| The status code table, the problem types, and the headers                                                                                    | `checkResponses()`, `problem.ts`        | `test/contract.test.ts`                 |
| `POST` and `OPTIONS` on `/v1`, JSON bodies only, and CORS `*` without credentials                                                            | `app.ts`                                | `test/platform.test.ts`                 |

`test/open-adult-check.ts` is a test suite that each open check uses again. A new open check shows that it
follows the contract when it calls this suite with its path and its fixture.

## Differences from the one-pager

- **This ADR removes the list envelope from ADR 0003,** because no list in version 1 has pages.
- **The step 1 reference files** (`/reference/v1/*.json`) are not in this repository. They are static files in
  R2, behind the CDN.

## Consequences

The assumptions for the open questions of the one-pager are in `docs/assumptions.md`.
