# 0008: Support OpenTelemetry with W3C Trace Context and OTLP logs, without native tracing

**Status:** Accepted (2026-10-28)

## Context

The API must support OpenTelemetry. The automatic tracing of Cloudflare needs the least code. But its
[spans and attributes reference](https://developers.cloudflare.com/workers/observability/traces/spans-and-attributes/)
shows these problems:

- The fetch handler span records `url.full`. At the time of this decision, the query string contained
  `lastName`. (ADR 0010 later moved the last name to the body.)
- D1 spans record `db.query.text`.
- The documentation does not show a way to remove attributes.

Also, the automatic tracing does not continue a `traceparent` that the caller sends
([known limitations](https://developers.cloudflare.com/workers/observability/traces/known-limitations/)).
The library `@microlabs/otel-cf-workers` was a release candidate, last published in May 2025.

## Decision

- Native traces and invocation logs are **off** (`wrangler.jsonc`).
- `platform/telemetry.ts` implements W3C Trace Context. If the caller sends a valid `traceparent`, the API
  continues it: the trace ID stays the same, the span ID is new, and the API records the span of the caller as
  the parent. If the header is missing or not valid, the API starts a new trace.
- Each request writes one log record in the OpenTelemetry (OTel) log data model: `timestamp`,
  `severity_text`, `body`, `trace_id`, `span_id`, and `attributes`. The attributes use semantic convention names
  (`http.request.method`, `url.path`, `http.response.status_code`).
- Checks add two abuse signals: `check.last_name_hash` and `check.outcome`. `check.last_name_hash` is a keyed
  hash of the normalized name, for this purpose only, so you cannot compare it with the stored hashes. Errors
  have the same trace IDs. No record contains a last name. A test enforces this.
- To export the logs, create an OTLP destination in the Cloudflare dashboard. Then add it to
  `observability.logs.destinations` ([export docs](https://developers.cloudflare.com/workers/observability/opentelemetry-export/)).
  Cloudflare exports only OTLP/HTTP JSON, not protobuf.

## Consequences

- The JSON from the API arrives as the **body** of the OTLP log record. Thus, to connect the logs to traces, the log
  backend can need a JSON parsing rule that moves `trace_id` into the trace field of the record.
- The logs do not include spans for D1 calls. `log()` and `TraceContext` are the seam. When attribute
  removal is available, change to native custom spans or to an OTel SDK. The modules do not change.
- `url.path` contains member IDs. Keep raw logs for a short time (the one-pager suggests 30 days). Use keyed
  hashes in all data that you keep for a longer time.
