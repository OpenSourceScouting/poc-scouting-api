# 0013: Host the step 1 content in R2 behind the Cloudflare CDN

**Status:** Accepted (2026-10-28)

## Context

Step 1 of the one-pager publishes public content as static files. The files include:

- Program content: ranks, adventures, merit badge requirements, and the Guide to Safe Scouting.
- The reference files that the API uses, for example the `positionCode` enum file.

The one-pager asks for these properties:

- Object storage behind a CDN, with no servers to operate.
- Long caching at the edge, and ETags, so a client with the current version gets a small "not modified"
  answer.
- Rate limiting rules at the CDN.

A batch job publishes the files. The job is not in this repository.

## Decision

OpenTofu creates these resources in `infra/tofu/content.tf`, for each environment:

- **An R2 bucket,** `scouting-content-ENVIRONMENT`. R2 has no egress charges.
- **An R2 custom domain** on a Cloudflare zone. The custom domain puts the bucket behind the Cloudflare CDN.
  It requires TLS 1.2 or later.
- **The `r2.dev` public URL, disabled.** Thus the CDN is the only way to read the files. Cloudflare documents
  that caching and WAF rules apply only through a custom domain, not through `r2.dev`.

OpenTofu also creates one zone cache rule (phase `http_request_cache_settings`) for all content hostnames:

- It makes all files cacheable. By default, Cloudflare caches only some file types.
- It keeps each file at the edge for one day (`content_edge_ttl_seconds`). The publish job purges the cache
  when it publishes a new edition.
- It keeps strong ETags, so a client with the current version gets `304 Not Modified`.
- It uses the cache headers of each file for browsers.

`infra/tofu/tests/content.tftest.hcl` tests these resources offline with a mocked provider. CI runs
`tofu test`.

## Consequences

- The zone must be in the same Cloudflare account as the bucket.
- A zone has only one ruleset for the cache settings phase. Put all other cache rules for the zone in the
  same `cloudflare_ruleset` resource.
- The hostnames are placeholders (`content.example.scouting.org` and `content-staging.example.scouting.org`)
  until the domain is known.
- This ADR does not add the CDN rate limiting rule. The Free plan has one rate limiting rule, and the API also
  needs one (see ADR 0009). Add one `http_ratelimit` ruleset for the zone that covers the API and the content
  hostnames.
- Each file is a public object. Do not put personal data in the bucket.
