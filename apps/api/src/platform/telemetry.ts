import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';

/**
 * OpenTelemetry support without native Workers tracing. Native tracing records the full URL and the D1
 * query text, and it cannot remove attributes. This module implements W3C Trace Context and writes log
 * records in the OpenTelemetry log data model, with semantic convention attribute names. Cloudflare
 * exports the console output to each OTLP destination in observability.logs in wrangler.jsonc.
 * See docs/adr/0008-opentelemetry.md.
 */

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

const hex = (bytes: number): string =>
  [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

const isZero = (id: string) => /^0+$/.test(id);

/** Parses a W3C traceparent (https://www.w3.org/TR/trace-context/). Returns null if the API must ignore the header. */
export function parseTraceparent(header: string | undefined): { traceId: string; parentSpanId: string } | null {
  if (!header) return null;
  const match = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(-.*)?$/.exec(header.trim());
  if (!match) return null;
  const [, version, traceId = '', parentSpanId = '', , rest] = match;
  // Version ff is invalid; version 00 allows no trailing fields; future versions may add some.
  if (version === 'ff' || (version === '00' && rest !== undefined)) return null;
  if (isZero(traceId) || isZero(parentSpanId)) return null;
  return { traceId, parentSpanId };
}

export function startTrace(traceparent: string | undefined): TraceContext {
  const inbound = parseTraceparent(traceparent);
  let spanId = hex(8);
  while (isZero(spanId)) spanId = hex(8);
  if (inbound) return { traceId: inbound.traceId, spanId, parentSpanId: inbound.parentSpanId };
  let traceId = hex(16);
  while (isZero(traceId)) traceId = hex(16);
  return { traceId, spanId };
}

type Severity = 'INFO' | 'WARN' | 'ERROR';

/**
 * Writes one record in the OpenTelemetry log data model. Do not give request URLs, query strings, or
 * request bodies as attributes. The request body contains lastName.
 */
export function log(
  c: Context<AppEnv>,
  severity: Severity,
  body: string,
  attributes: Record<string, unknown> = {},
): void {
  const trace = c.get('trace');
  const record = {
    timestamp: new Date().toISOString(),
    severity_text: severity,
    body,
    trace_id: trace?.traceId,
    span_id: trace?.spanId,
    attributes: {
      'request.id': c.get('requestId'),
      ...(trace?.parentSpanId ? { parent_span_id: trace.parentSpanId } : {}),
      ...attributes,
    },
  };
  (severity === 'ERROR' ? console.error : console.log)(JSON.stringify(record));
}

/** Returns middleware that starts or continues the trace, and writes one access log record for each request. */
export function telemetry(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set('trace', startTrace(c.req.header('traceparent')));
    const started = Date.now();
    await next();
    log(c, 'INFO', 'request', {
      'http.request.method': c.req.method,
      'url.path': new URL(c.req.url).pathname,
      'http.response.status_code': c.res.status,
      duration_ms: Date.now() - started,
      ...c.get('logAttributes'),
    });
  };
}
