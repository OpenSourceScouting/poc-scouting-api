# API guidelines

These rules apply to every API in this repository, so that all the APIs are consistent. Use this page when you
design or review an API change. Each rule names the tool or test that enforces it. To change a rule, write an
architecture decision record (ADR).

## Personal data

These rules keep personal data out of URLs and logs:

| Rule                                                                                                                                                                                                                                                       | Enforced by                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Do not put personal data in a URL.** A path can contain opaque identifiers, for example a member ID or an organization ID. A path or query string never contains a name, contact details, or a date of birth.                                            | Review; contract test                                                 |
| **Do not use query parameters** in any operation. CDNs, proxies, and access logs record URLs by default.                                                                                                                                                   | Redocly `rule/no-query-parameters`; contract test                     |
| **Use `POST` with a JSON body for each API operation,** also for operations that only read. Document these operations as safe and idempotent: repeating one changes nothing.                                                                               | Redocly `rule/api-operations-are-post`; platform `405`; contract test |
| **Send request bodies as `application/json`**, with a maximum size of 1 KiB. The API ignores unknown fields.                                                                                                                                               | Redocly `rule/json-request-bodies-only`; platform `415` and `413`     |
| **Do not log personally identifiable information (PII).** A log can contain identifiers from the path. It can also contain keyed hashes that have a specific purpose, for example `check.last_name_hash`. A keyed hash cannot be reversed without the key. | `platform/telemetry.ts`; log tests                                    |
| **Do not return a name, contact details, or history in a response.**                                                                                                                                                                                       | Contract test                                                         |

## Shape

These rules keep the contracts consistent:

| Rule                                                                                                      | Enforced by                 |
| --------------------------------------------------------------------------------------------------------- | --------------------------- |
| Put the major version in the path (`/v1`). In one version, only add to the contract.                      | Contract test; CI `oasdiff` |
| Write JSON field names in camelCase. Send identifiers as strings.                                         | Review                      |
| Write timestamps in RFC 3339 format, in UTC, with whole seconds, ending in `Z`. An end time is exclusive. | Contract test               |
| Make enums open: the schema is `anyOf` the known values or any string.                                    | Contract test               |
| Send errors as RFC 9457 `application/problem+json`, with problem types in camelCase.                      | Contract test               |
| Give each operation an `operationId` and a tag.                                                           | Redocly; contract test      |

## Behavior

These rules control how the APIs behave:

| Rule                                                                                                                                                                | Enforced by              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Send `Cache-Control: no-store` on each answer that contains personal data.                                                                                          | Contract and HTTP tests  |
| Send `X-Request-Id` on each response. Continue a valid W3C `traceparent`.                                                                                           | Platform tests           |
| Limit the rate for each client IP address at the CDN, and for each subject (for example, a member ID) in the platform. Both limits answer `429` with `Retry-After`. | Platform tests; ADR 0009 |
| Allow Cross-Origin Resource Sharing (CORS) from any origin, without credentials.                                                                                    | Platform tests           |
