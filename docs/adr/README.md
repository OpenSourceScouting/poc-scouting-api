# Architecture decision records

An architecture decision record (ADR) records one important decision: the context, the decision, and the
results. These records use the [Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

Write an ADR for each decision that is expensive to change. Give each ADR the next number. Do not change the
decision in an accepted ADR. To change a decision, write a new ADR that supersedes it.

The table gives each ADR and its decision:

| ADR                                                     | Decision                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| [0001](0001-hosting-cloudflare-workers-d1.md)           | Host on Cloudflare Workers and D1                                           |
| [0002](0002-iac-split-opentofu-and-wrangler.md)         | Use OpenTofu for resources and Wrangler for code                            |
| [0003](0003-code-first-openapi-additive-contracts.md)   | Generate OpenAPI from the code, and only add to contracts                   |
| [0004](0004-feature-modules.md)                         | Put features in modules that use only the platform                          |
| [0005](0005-typescript-5-9.md)                          | Pin TypeScript 5.9 (superseded by 0011)                                     |
| [0006](0006-adult-check-contract.md)                    | Use one contract for all adult checks                                       |
| [0007](0007-sign-in-jwt-jwks.md)                        | Verify positions sign-in tokens (JWT) with a JWKS                           |
| [0008](0008-opentelemetry.md)                           | Support OpenTelemetry with W3C Trace Context and OTLP logs                  |
| [0009](0009-rate-limiting-at-the-cdn.md)                | Limit the rate at the CDN and for each member ID                            |
| [0010](0010-post-for-checks-no-caching.md)              | Use `POST` with the last name in the body, and do not cache answers         |
| [0011](0011-typescript-7-with-typescript6-for-tools.md) | Use TypeScript 7 for the compiler and TypeScript 6 for the tools (proposed) |
| [0012](0012-swagger-ui-for-interactive-docs.md)         | Host a pinned copy of Swagger UI for the interactive docs                   |
| [0013](0013-r2-content-behind-the-cdn.md)               | Host the step 1 content in R2 behind the Cloudflare CDN                     |
