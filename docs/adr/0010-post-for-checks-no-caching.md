# 0010: Use POST with the last name in the body, and do not cache answers

**Status:** Accepted (2026-10-28). Supersedes these parts of the one-pager and ADR 0006: the `GET` with
`?lastName=` design, the cache, ETag and `304`, and the `RateLimit` headers.

## Context

The one-pager put `lastName` in the query string. This kept `GET` requests cacheable, and the CDN had to remove
the name from logs. But almost all systems log query strings by default: CDN logs, proxies, gateways, Workers
invocation logs, and browser history. The team does not want personal data in logs, unless someone logs it on
purpose.

The team examined these other options:

- **GET with a body.** Rejected. Caches key a GET by its URL and ignore the body, so a cache can send the answer
  for one adult to a request about a different adult. The browser Fetch API cannot send a GET body. RFC 9110
  does not define the meaning of a GET body.
- **GET with the last name in a header.** This works, but the API design is unusual. A correct cache needs
  `Vary` handling, and the Cloudflare CDN does not use `Vary` for most responses.
- **The HTTP `QUERY` method.** This method is safe and cacheable, and it has a body. But it is an IETF draft,
  and CDNs and client generators do not support it. It is possible for a later version.

## Decision

- Checks use `POST` with the JSON body `{ "lastName": "..." }`. Opaque identifiers (member ID, organization
  ID) stay in the path. No operation has query parameters. The contract documents the checks as safe and
  idempotent.
- No cache. Answers have `Cache-Control: no-store`. The contract does not use ETag or `304`.
- The contract does not include the `RateLimit` and `RateLimit-Policy` headers. Neither the Cloudflare WAF rate
  limiting rules nor the Workers rate limiting binding sends them, so documentation of them is false.
- The rules apply to all APIs, in `docs/api-guidelines.md`. Redocly rules, platform middleware, and contract
  tests enforce them.

## Consequences

- Each check goes to the Worker and to D1. At list prices (ADR 0001), this costs about $0.30 for each 1M Worker
  requests, and a small number of D1 rows for each check. This cost is small, and the rate limits control it.
  WAF rules stop requests before they get to the Worker. TODO(verify): the Cloudflare docs confirm the order of
  the WAF phases, but they do not state clearly that Workers run after them.
- The rate limit for each member ID (ADR 0009) replaces the cache as the protection against repeated and
  guessing traffic.
- Each browser call sends a CORS preflight, because the body is JSON. Browsers keep the preflight result
  for one day (`Access-Control-Max-Age`).
