# 0012: Host a pinned copy of Swagger UI for the interactive docs

**Status:** Accepted (2026-10-28). Replaces Scalar at `/docs`.

## Context

`/docs` used Scalar. It loaded Scalar from `cdn.jsdelivr.net`, without a pinned version. Scalar shows features
that need a Scalar account (dashboard links and a hosted agent chat). Also, a script from a CDN without a pinned version can change the page without a change in this repository. For example, it can add new upsells. The
team wanted an open source tool that is maintained, needs no account, and runs no code from a third party.

The team examined these options on 2026-10-28:

| Tool                           | License    | Latest version     | Try it out | Code samples                                                                                                  |
| ------------------------------ | ---------- | ------------------ | ---------- | ------------------------------------------------------------------------------------------------------------- |
| Swagger UI (`swagger-ui-dist`) | Apache-2.0 | 5.34.0, 2026-10-19 | Yes        | curl only (bash, PowerShell, cmd)                                                                             |
| Stoplight Elements             | Apache-2.0 | 9.0.29, 2026-10-19 | Yes        | Many languages, but in a fixed order. You cannot show some first and put the others in a menu.                |
| Redoc                          | MIT        | 3.0.1, 2026-10-14  | No         | Only samples that are written in the contract                                                                 |
| Scalar                         | MIT        | 1.76.2, 2026-10-28 | Yes        | You can select the featured clients, but it has features that need an account, and an unpinned CDN by default |

The team wanted C#, Java, Python, Node.js, and curl to show first. Only Scalar supports this. Elements can do
it only if you change its bundle. The team selected a simple solution, and did not change code from a third
party.

## Decision

- Use Swagger UI, pinned to an exact version (`swagger-ui-dist`, `--save-exact`). The script
  `scripts/vendor-docs.ts` copies it, with its LICENSE and NOTICE files, into the Workers static assets. The
  API serves it from its own origin. Requests for static assets are free on Workers.
- The start file is a static file. Thus `/docs` can send a strict Content Security Policy: `script-src 'self'`,
  `connect-src` only for this host and production, and no framing. The public validator badge is off.
- `/docs/openapi.json` is the canonical contract with the serving host first, so "Try it out" works on your
  computer. `/openapi.json` stays canonical.
- `swagger-ui-dist` depends on `@scarf/scarf`, which sends install analytics. Its install script is denied in
  `allowScripts`. The browser bundle contains no Scarf code.

## Consequences

- The code samples are curl only. The docs page does not show the languages in the order that the team wanted.
  Consumers that use other languages can generate a client from the OpenAPI document. TypeScript consumers can
  use `@scouting/api-client`.
- "Try it out" cannot get a token for positions. The OAuth 2.0 authorization code flow of Swagger UI needs a
  real identity provider, and there is no field to paste a token. Use curl with `npm run dev:token`.
- To upgrade Swagger UI, change one version number. Dependabot proposes the change, and the team reviews it as
  for all dependencies.
