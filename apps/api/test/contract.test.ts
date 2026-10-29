import { beforeAll, describe, expect, it } from 'vitest';
import committed from '../../../openapi/openapi.json';
import { bearer, signInToken } from './auth';
import { api } from './http';
import { checkRequest } from './open-adult-check';
import { PROBLEM_BASE, PROBLEM_TYPES } from '../src/platform/problem';

/* eslint-disable @typescript-eslint/no-explicit-any -- walking an arbitrary JSON document */
type Doc = any;

const OPERATIONS = ['checkYptStatus', 'checkMembership', 'checkPositions'];
const SIGNED_IN = ['checkPositions'];

let doc: Doc;
const operations = (): [string, string, Doc][] =>
  Object.entries(doc.paths).flatMap(([path, ops]: [string, Doc]) =>
    Object.entries(ops).map(([method, op]: [string, Doc]): [string, string, Doc] => [
      `${method.toUpperCase()} ${path}`,
      method,
      op,
    ]),
  );
const op = (id: string): Doc => operations().find(([, , o]) => o.operationId === id)![2];
const schema = (name: string): Doc => doc.components.schemas[name];

/** Every property schema anywhere in the document, with its name. */
function allProperties(node: Doc, out: [string, Doc][] = []): [string, Doc][] {
  if (node && typeof node === 'object') {
    if (node.properties) for (const [k, v] of Object.entries(node.properties)) out.push([k, v]);
    for (const v of Object.values(node)) allProperties(v, out);
  }
  return out;
}

beforeAll(async () => {
  doc = await (await api('/openapi.json')).json();
});

describe('OpenAPI contract', () => {
  it('serves a spec identical to the committed contract (run `npm run generate` if this fails)', () => {
    expect(doc).toEqual(committed);
  });

  it('serves interactive docs from self-hosted, pinned Swagger UI with no third-party scripts or styles', async () => {
    const res = await api('/docs');
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    expect(html).toContain('<script src="/docs/vendor/swagger-ui-bundle.js"');
    expect(html).toContain('<link rel="stylesheet" href="/docs/vendor/swagger-ui.css"');
    expect(html).not.toMatch(/(src|href)="https?:/);
    expect(html).not.toMatch(/<script>(?!<\/script>)/); // no inline script, so CSP can forbid it
  });

  it('locks the docs page down with a Content-Security-Policy', async () => {
    const csp = (await api('/docs')).headers.get('Content-Security-Policy') ?? '';

    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("connect-src 'self' https://api.example.scouting.org");
  });

  it('gives the docs a copy of the spec that tries requests against the serving host first', async () => {
    const docsSpec = await (await api('http://127.0.0.1:8787/docs/openapi.json')).json<Doc>();

    expect(docsSpec.servers).toEqual([
      { url: 'http://127.0.0.1:8787', description: 'This host' },
      { url: 'https://api.example.scouting.org', description: 'Placeholder production host' },
    ]);
    expect({ ...docsSpec, servers: doc.servers }).toEqual(doc);
    expect(doc.servers).toEqual([
      { url: 'https://api.example.scouting.org', description: 'Placeholder production host' },
    ]);
  });

  it('describes exactly the version 1 operations, under versioned paths with tags', () => {
    expect(
      operations()
        .map(([, , o]) => o.operationId)
        .sort(),
    ).toEqual([...OPERATIONS].sort());
    for (const [name, method, o] of operations()) {
      expect(method, name).toBe('post');
      expect(name).toMatch(/^POST \/v\d+\/adults\//);
      expect(o.tags?.length, name).toBeGreaterThan(0);
    }
  });

  it('points at the placeholder production host', () => {
    expect(doc.servers).toContainEqual(expect.objectContaining({ url: 'https://api.example.scouting.org' }));
  });

  it('never takes query parameters, and carries the last name only in a required JSON body', () => {
    for (const id of OPERATIONS) {
      const { parameters = [], requestBody } = op(id);
      expect(
        parameters.filter((p: Doc) => p.in !== 'path'),
        id,
      ).toEqual([]);
      expect(requestBody.required, id).toBe(true);
      expect(Object.keys(requestBody.content), id).toEqual(['application/json']);
      const body = requestBody.content['application/json'].schema;
      const resolved = body.$ref ? schema(body.$ref.split('/').at(-1)) : body;
      expect(resolved.required, id).toContain('lastName');
    }
  });

  it('declares the status code table for every operation', () => {
    for (const id of OPERATIONS) {
      const expected = [
        '200',
        '400',
        '413',
        '415',
        '429',
        '500',
        '503',
        ...(SIGNED_IN.includes(id) ? ['401', '403'] : []),
      ];
      expect(Object.keys(op(id).responses).sort(), id).toEqual(expected.sort());
    }
  });

  it('describes every error as application/problem+json', () => {
    for (const id of OPERATIONS) {
      for (const [code, response] of Object.entries(op(id).responses) as [string, Doc][]) {
        if (Number(code) >= 400)
          expect(Object.keys(response.content), `${id} ${code}`).toEqual(['application/problem+json']);
      }
    }
  });

  it('documents no-store and tracing on answers, Retry-After where it applies, and no unsent headers', () => {
    for (const id of OPERATIONS) {
      const { responses } = op(id);
      expect(Object.keys(responses['200'].headers).sort(), id).toEqual(['Cache-Control', 'X-Request-Id']);
      expect(Object.keys(responses['429'].headers), id).toContain('Retry-After');
      expect(Object.keys(responses['503'].headers), id).toContain('Retry-After');
    }
    expect(JSON.stringify(doc)).not.toMatch(/RateLimit|ETag|If-None-Match/);
    expect(Object.keys(op('checkPositions').responses['401'].headers)).toContain('WWW-Authenticate');
  });

  it('explains notCurrent to people, with named examples of both answers on every check', () => {
    for (const id of OPERATIONS) {
      const ok = op(id).responses['200'];
      const examples = ok.content['application/json'].examples;
      expect(Object.keys(examples).sort(), id).toEqual(['current', 'notCurrent']);
      expect(examples.current.value.status, id).toBe('current');
      expect(examples.notCurrent.value, id).toMatchObject({ status: 'notCurrent', expiresAt: null });
      expect(examples.notCurrent.description, id).toMatch(/spelling/i);
      expect(ok.description, id).toMatch(/notCurrent/);
      expect(ok.description, id).toMatch(/my\.scouting/);
    }
    expect(
      op('checkPositions').responses['200'].content['application/json'].examples.notCurrent.value.positions,
    ).toEqual([]);
    expect(schema('Status').description).toMatch(/does not say which/i);
    expect(doc.info.description).toMatch(/000000001/);
  });

  it('gives each error response a realistic example with a real problem type', () => {
    for (const id of OPERATIONS) {
      for (const [code, response] of Object.entries(op(id).responses) as [string, Doc][]) {
        if (Number(code) < 400) continue;
        const examples = Object.values(response.content['application/problem+json'].examples ?? {}) as Doc[];
        expect(examples.length, `${id} ${code}`).toBeGreaterThan(0);
        for (const { value } of examples) {
          const slug = value.type.replace(`${PROBLEM_BASE}/`, '');
          expect(PROBLEM_TYPES, `${id} ${code} ${slug}`).toHaveProperty(slug);
          expect(value, `${id} ${code}`).toMatchObject({
            status: Number(code),
            title: PROBLEM_TYPES[slug as keyof typeof PROBLEM_TYPES].title,
          });
        }
      }
    }
    const badRequest = Object.keys(op('checkPositions').responses['400'].content['application/problem+json'].examples);
    expect(badRequest.sort()).toEqual([
      'invalidLastName',
      'invalidMemberId',
      'invalidOrganizationId',
      'invalidRequestBody',
    ]);
  });

  it('documents error examples that match what the API really sends', async () => {
    const token = await signInToken();
    const noScope = await signInToken({ scope: 'openid' });
    let rateLimitId = 910000000;
    for (const id of OPERATIONS) {
      const [template] = operations()
        .find(([, , o]) => o.operationId === id)![0]
        .split(' ')
        .slice(1);
      const path = (member = '123456789', org = 'unit-1') =>
        template!.replace('{scoutingMemberId}', member).replace('{organizationId}', org);
      const auth = SIGNED_IN.includes(id) ? bearer(token) : {};
      const trigger: Record<string, () => Promise<Response>> = {
        invalidMemberId: () => api(path('abc'), checkRequest({ lastName: 'Rivera' }, auth)),
        invalidOrganizationId: () => api(path('123456789', 'bad_org!'), checkRequest({ lastName: 'Rivera' }, auth)),
        invalidLastName: () => api(path(), checkRequest({}, auth)),
        invalidRequestBody: () => api(path(), checkRequest('{"lastName": ', auth)),
        unauthorized: () => api(path(), checkRequest({ lastName: 'Rivera' })),
        forbidden: () => api(path(), checkRequest({ lastName: 'Rivera' }, bearer(noScope))),
        payloadTooLarge: () => api(path(), checkRequest({ lastName: 'x'.repeat(2048) }, auth)),
        unsupportedMediaType: () =>
          api(path(), { method: 'POST', headers: { ...auth, 'Content-Type': 'text/plain' }, body: 'Rivera' }),
        rateLimited: async () => {
          const member = String(rateLimitId++);
          for (let i = 0; i < 50; i++) await api(path(member), checkRequest({ lastName: 'Rivera' }, auth));
          return api(path(member), checkRequest({ lastName: 'Rivera' }, auth));
        },
        // sync_state is empty (tables are wiped before each test), so a valid check fails inside the API.
        internalError: () => api(path(), checkRequest({ lastName: 'Rivera' }, auth)),
      };
      for (const [code, response] of Object.entries(op(id).responses) as [string, Doc][]) {
        // 503 is for planned maintenance; no code path sends it yet.
        if (Number(code) < 400 || code === '503') continue;
        for (const { value } of Object.values(response.content['application/problem+json'].examples) as Doc[]) {
          const slug = value.type.replace(`${PROBLEM_BASE}/`, '');
          const res = await trigger[slug]!();
          const { type, title, status, detail } = await res.json<Doc>();
          expect({ type, title, status, detail }, `${id} ${code} ${slug}`).toEqual({
            type: value.type,
            title: value.title,
            status: value.status,
            detail: value.detail,
          });
        }
      }
    }
  });

  it('marks open checks as open and positions as signed in with positions:read', () => {
    expect(op('checkYptStatus').security).toEqual([]);
    expect(op('checkMembership').security).toEqual([]);
    expect(op('checkPositions').security).toEqual([{ scoutingSignIn: ['positions:read'] }]);
    expect(doc.components.securitySchemes.scoutingSignIn).toMatchObject({
      type: 'oauth2',
      flows: { authorizationCode: { scopes: { 'positions:read': expect.any(String) } } },
    });
  });

  it('describes status and positionCode as open enums', () => {
    expect(schema('Status').anyOf).toEqual([{ type: 'string', enum: ['current', 'notCurrent'] }, { type: 'string' }]);
    expect(schema('PositionCode').type).toBe('string');
    expect(schema('PositionCode').description).toMatch(/open enum/i);
  });

  it('uses RFC 3339 date-time for every timestamp', () => {
    for (const [name, prop] of allProperties(doc.components.schemas)) {
      if (name === 'expiresAt' || name === 'asOf') {
        const types = prop.anyOf ? prop.anyOf : [prop];
        expect(
          types.some((t: Doc) => t.format === 'date-time'),
          name,
        ).toBe(true);
      }
    }
  });

  it('never returns a last name, contact details, or other personal fields', () => {
    const forbidden = ['lastName', 'firstName', 'name', 'email', 'phone', 'address', 'birthDate'];
    const responseSchemas = Object.entries(doc.components.schemas).filter(([n]) => !n.endsWith('Request'));
    for (const [name] of allProperties(Object.fromEntries(responseSchemas))) {
      expect(forbidden, `schema property "${name}"`).not.toContain(name);
    }
  });
});
