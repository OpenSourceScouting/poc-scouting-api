# 0007: Verify positions sign-in tokens (JWT) with a JWKS

**Status:** Accepted (2026-10-28)

## Context

The one-pager requires a bearer token on each positions check. The token is for the tool. Scouting America
issues it when a registered adult signs in (OAuth 2.0 authorization code flow with PKCE). This identity
provider does not exist yet.

## Decision

- The OpenAPI document declares the `oauth2` scheme `scoutingSignIn`, with placeholder URLs and one scope,
  `positions:read`.
- `platform/auth.ts` verifies JSON Web Tokens (JWTs) signed with `ES256` or `RS256`. It uses the `jose`
  library. It verifies the signature with the JSON Web Key Set (JWKS) of the provider (`OAUTH_JWKS_URL`). It also verifies the issuer, the audience, and the expiry time. Local development and the tests use a JWKS in the
  configuration (`OAUTH_JWKS`), made from a local key.
- If the token is missing or not valid, the API sends `401` with an RFC 6750 `WWW-Authenticate` challenge. If
  the token is valid but does not have `positions:read`, the API sends `403` with
  `error="insufficient_scope"`. The API verifies the sign-in before it validates the request.
- **Assumption:** the provider gives `positions:read` only to registered adults. This enforces the rule that
  "any signed-in registered adult may check". If the provider cannot do this, a claim check replaces the scope
  check.

## Consequences

To use the real provider, change the configuration (`OAUTH_ISSUER`, `OAUTH_AUDIENCE`, `OAUTH_JWKS_URL`). The
code does not change. If the provider cannot issue tokens to tools, the positions endpoint waits, as the
one-pager says.
