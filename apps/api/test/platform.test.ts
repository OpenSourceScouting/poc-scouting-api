/* eslint-disable @typescript-eslint/no-explicit-any -- inspecting arbitrary log JSON */
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FUTURE, givenSyncedAt, givenYpt, hashOfNormalized } from './fixtures';
import { api } from './http';

const PROBLEMS = 'https://api.example.scouting.org/problems';

/** Header lists are comma separated with optional whitespace; compare them as lists. */
const list = (value: string | null) => value?.split(',').map((v) => v.trim()) ?? [];

describe('platform', () => {
  it('reports health', async () => {
    const res = await api('/health');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', environment: 'test' });
  });

  it('answers unknown paths with an RFC 9457 problem', async () => {
    const res = await api('/v1/does-not-exist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toBe('application/problem+json');
    expect(await res.json()).toMatchObject({
      type: `${PROBLEMS}/notFound`,
      title: 'Not found',
      status: 404,
      instance: '/v1/does-not-exist',
    });
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'])(
    'refuses %s on operational endpoints with Allow: GET',
    async (method) => {
      const res = await api('/health', { method });

      expect(res.status).toBe(405);
      expect(res.headers.get('Allow')).toBe('GET, OPTIONS');
    },
  );

  it.each(['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD'])('refuses %s on API endpoints with Allow: POST', async (method) => {
    const res = await api('/v1/adults/123456789/ypt', { method });

    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST, OPTIONS');
    if (method !== 'HEAD') expect(await res.json()).toMatchObject({ type: `${PROBLEMS}/methodNotAllowed` });
  });

  it('requires a JSON body on API endpoints (415 otherwise)', async () => {
    const res = await api('/v1/adults/123456789/ypt', { method: 'POST', body: 'lastName=Rivera' });

    expect(res.status).toBe(415);
    expect(await res.json()).toMatchObject({ type: `${PROBLEMS}/unsupportedMediaType` });
  });

  it('rejects malformed JSON as a 400 problem', async () => {
    const res = await api('/v1/adults/123456789/ypt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"lastName": ',
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ type: `${PROBLEMS}/invalidRequestBody` });
  });

  it('rejects bodies over 1 KiB with 413', async () => {
    const res = await api('/v1/adults/123456789/ypt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastName: 'x'.repeat(2048) }),
    });

    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ type: `${PROBLEMS}/payloadTooLarge` });
  });

  it('echoes a caller-supplied request id for tracing', async () => {
    const res = await api('/health', { headers: { 'X-Request-Id': 'trace-123' } });

    expect(res.headers.get('X-Request-Id')).toBe('trace-123');
  });

  it('sets HSTS and nosniff', async () => {
    const res = await api('/health');

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=');
  });

  it('allows any browser origin without credentials and exposes contract headers', async () => {
    const res = await api('/health', { headers: { Origin: 'https://some-volunteer-tool.example' } });

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    expect(list(res.headers.get('Access-Control-Expose-Headers'))).toEqual([
      'Retry-After',
      'Deprecation',
      'Sunset',
      'X-Request-Id',
    ]);
  });

  it('answers CORS preflight with the allowed request headers and a cacheable max age', async () => {
    const res = await api('/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://some-volunteer-tool.example',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
    });

    expect(res.status).toBe(204);
    expect(list(res.headers.get('Access-Control-Allow-Methods'))).toEqual(['GET', 'POST', 'OPTIONS']);
    expect(list(res.headers.get('Access-Control-Allow-Headers'))).toEqual([
      'Authorization',
      'Content-Type',
      'traceparent',
    ]);
    expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
  });

  it('lets any origin read responses (Cross-Origin-Resource-Policy: cross-origin)', async () => {
    const res = await api('/health');

    expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
  });
});

describe('per-member-ID rate limit', () => {
  const PROBLEMS = 'https://api.example.scouting.org/problems';
  const check = (path: string) =>
    api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"lastName":"Rivera"}' });

  beforeEach(() => givenSyncedAt());

  it('limits checks about one member ID across all checks, so names cannot be guessed from many IPs', async () => {
    // The test limit is 50 a minute; alternate checks to show the counter is shared.
    for (let i = 0; i < 50; i++) {
      const res = await check(i % 2 ? '/v1/adults/900000001/ypt' : '/v1/adults/900000001/membership');
      expect(res.status, `request ${i + 1}`).toBe(200);
    }

    const limited = await check('/v1/adults/900000001/ypt');

    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('60');
    expect(await limited.json()).toMatchObject({ type: `${PROBLEMS}/rateLimited`, status: 429 });
  });

  it('does not limit other member IDs', async () => {
    const res = await check('/v1/adults/900000002/ypt');

    expect(res.status).toBe(200);
  });
});

describe('OpenTelemetry', () => {
  const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';
  const PARENT_SPAN_ID = '00f067aa0ba902b7';

  /** Runs a request and returns the JSON log records it wrote. */
  async function logsOf(path: string, init?: RequestInit): Promise<Record<string, any>[]> {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await api(path, init);
    const records = [...log.mock.calls, ...error.mock.calls].map((args) => JSON.parse(String(args[0])));
    log.mockRestore();
    error.mockRestore();
    return records;
  }
  const check = (lastName: string, headers: Record<string, string> = {}): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ lastName }),
  });
  const accessLog = async (path: string, init?: RequestInit) =>
    (await logsOf(path, init)).find((r) => r.body === 'request')!;

  beforeEach(() => givenSyncedAt());

  it('writes one OTel-shaped access log record per request with semantic-convention attributes', async () => {
    const record = await accessLog('/v1/adults/123456789/ypt', check('Rivera', { 'X-Request-Id': 'r-1' }));

    expect(record).toMatchObject({
      severity_text: 'INFO',
      body: 'request',
      attributes: {
        'http.request.method': 'POST',
        'url.path': '/v1/adults/123456789/ypt',
        'http.response.status_code': 200,
        'request.id': 'r-1',
      },
    });
    expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(record.attributes['duration_ms']).toEqual(expect.any(Number));
  });

  it('records explicit, non-reversible abuse signals for checks: a keyed name hash and the outcome', async () => {
    await givenYpt('123456789', 'rivera', FUTURE);
    const match = await accessLog('/v1/adults/123456789/ypt', check('Rivera'));
    const sameNameOtherForm = await accessLog('/v1/adults/123456789/ypt', check('RIVERA'));
    const mismatch = await accessLog('/v1/adults/123456789/ypt', check('Smith'));

    expect(match.attributes['check.last_name_hash']).toMatch(/^[0-9a-f]{64}$/);
    expect(sameNameOtherForm.attributes['check.last_name_hash']).toBe(match.attributes['check.last_name_hash']);
    expect(mismatch.attributes['check.last_name_hash']).not.toBe(match.attributes['check.last_name_hash']);
    // Purpose-separated from the stored hash, so logs cannot be joined to table rows by name hash.
    expect(match.attributes['check.last_name_hash']).not.toBe(await hashOfNormalized('rivera'));
    expect(match.attributes['check.outcome']).toBe('current');
    expect(mismatch.attributes['check.outcome']).toBe('notCurrent');
  });

  it('never writes the last name to any log record', async () => {
    const records = await logsOf('/v1/adults/123456789/ypt', check('Zzyzx'));

    expect(JSON.stringify(records)).not.toMatch(/zzyzx/i);
  });

  it('continues an inbound W3C trace: same trace id, new span id, caller span as parent', async () => {
    const record = await accessLog('/health', { headers: { traceparent: `00-${TRACE_ID}-${PARENT_SPAN_ID}-01` } });

    expect(record.trace_id).toBe(TRACE_ID);
    expect(record.span_id).toMatch(/^[0-9a-f]{16}$/);
    expect(record.span_id).not.toBe(PARENT_SPAN_ID);
    expect(record.attributes['parent_span_id']).toBe(PARENT_SPAN_ID);
  });

  it.each([
    ['absent', undefined],
    ['malformed', 'not-a-traceparent'],
    ['unsupported version ff', `ff-${TRACE_ID}-${PARENT_SPAN_ID}-01`],
    ['all-zero trace id', `00-${'0'.repeat(32)}-${PARENT_SPAN_ID}-01`],
    ['all-zero parent id', `00-${TRACE_ID}-${'0'.repeat(16)}-01`],
  ])('starts a new trace when traceparent is %s', async (_label, traceparent) => {
    const record = await accessLog('/health', traceparent ? { headers: { traceparent } } : undefined);

    expect(record.trace_id).toMatch(/^[0-9a-f]{32}$/);
    expect(record.trace_id).not.toBe(TRACE_ID);
    expect(record.trace_id).not.toBe('0'.repeat(32));
    expect(record.span_id).toMatch(/^[0-9a-f]{16}$/);
    expect(record.attributes['parent_span_id']).toBeUndefined();
  });

  it('correlates error logs with the trace', async () => {
    await env.DB.prepare('DELETE FROM sync_state').run(); // forces an internal error
    const records = await logsOf(
      '/v1/adults/123456789/ypt',
      check('Rivera', { traceparent: `00-${TRACE_ID}-${PARENT_SPAN_ID}-01` }),
    );

    expect(records).toContainEqual(expect.objectContaining({ severity_text: 'ERROR', trace_id: TRACE_ID }));
  });
});
