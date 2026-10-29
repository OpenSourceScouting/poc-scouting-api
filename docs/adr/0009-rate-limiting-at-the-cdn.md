# 0009: Limit the rate at the CDN and for each member ID

**Status:** Accepted (2026-10-28)

## Decision

The contract declares `429` with `Retry-After`. The rate limit has two layers:

1. **For each member ID, in the Worker** (`platform/app.ts`). The Workers rate limiting binding
   `MEMBER_RATE_LIMITER` allows 10 checks each minute for each member ID, from all checks and all callers. The
   key is an HMAC of the member ID, for this purpose only. This limit stops an attacker who tries to guess a last
   name from many IP addresses. A rule for each IP address cannot see this attack. The binding is approximate,
   and it counts in each Cloudflare location.
2. **For each client, at the CDN.** A Cloudflare WAF
   [rate limiting rule](https://developers.cloudflare.com/waf/rate-limiting-rules/) on the API hostname. The
   first value is about 60 requests each minute for each client IP address. This value is an estimate. Adjust
   it with real traffic.

## Plan limits (from the Cloudflare docs, 2026-10-28)

- All plans can count requests by IP address.
- To count requests for each tool (by API key header, token, or other values), you need **Advanced Rate
  Limiting**, an Enterprise add-on ([parameters](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/)).
  If you add API keys, pay for this add-on, or limit each key in the Worker with the Workers rate limiting
  binding.
- Many IDs from one source (enumeration) is a different signal from a high volume. Give it its own rule or
  analytics alert.

## Consequences

The contract does not include `RateLimit` headers (ADR 0010), because neither layer sends them. A caller can
use the member limit to stop checks about one person for one minute. The team accepts this risk, and the logs
show it. When the zone exists, add the CDN rule to `infra/tofu` (`cloudflare_ruleset`, phase `http_ratelimit`).
