import { beforeEach, describe, expect, it } from 'vitest';
import { bearer, signInToken } from '../../../test/auth';
import { AS_OF, FUTURE, PAST, givenPosition, givenSyncedAt } from '../../../test/fixtures';
import { api } from '../../../test/http';
import { checkRequest } from '../../../test/open-adult-check';

const PROBLEMS = 'https://api.example.scouting.org/problems';
const url = '/v1/adults/123456789/organizations/unit-4f1c2a90/positions';
const rivera = (headers: Record<string, string> = {}) => checkRequest({ lastName: 'Rivera' }, headers);

describe('positions: sign-in', () => {
  beforeEach(() => givenSyncedAt());

  it('requires a bearer token', async () => {
    const res = await api(url, rivera());

    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer realm="scouting-api"');
    expect(await res.json()).toMatchObject({ type: `${PROBLEMS}/unauthorized`, status: 401 });
  });

  it('checks sign-in before validating the request', async () => {
    const res = await api('/v1/adults/abc/organizations/x/positions', checkRequest({}));

    expect(res.status).toBe(401);
  });

  it.each([
    ['garbage', async () => 'not-a-jwt'],
    ['forged', () => signInToken({ forged: true })],
    ['expired', () => signInToken({ expiresIn: Math.floor(Date.now() / 1000) - 60 })],
    ['wrong issuer', () => signInToken({ issuer: 'https://evil.example' })],
    ['wrong audience', () => signInToken({ audience: 'https://some-other-api.example' })],
  ])('rejects a %s token as invalid_token', async (_label, mint) => {
    const res = await api(url, rivera(bearer(await mint())));

    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer realm="scouting-api", error="invalid_token"');
  });

  it('forbids a valid token without the positions:read scope', async () => {
    const res = await api(url, rivera(bearer(await signInToken({ scope: 'openid profile' }))));

    expect(res.status).toBe(403);
    expect(res.headers.get('WWW-Authenticate')).toBe(
      'Bearer realm="scouting-api", error="insufficient_scope", scope="positions:read"',
    );
    expect(await res.json()).toMatchObject({ type: `${PROBLEMS}/forbidden`, status: 403 });
  });
});

describe('positions: the answer', () => {
  const ORG = 'unit-4f1c2a90';
  const signedIn = async (path: string, body: unknown = { lastName: 'Rivera' }) =>
    api(path, checkRequest(body, bearer(await signInToken())));
  const notCurrent = {
    scoutingMemberId: '123456789',
    organizationId: ORG,
    status: 'notCurrent',
    expiresAt: null,
    positions: [],
    asOf: AS_OF,
  };

  beforeEach(() => givenSyncedAt());

  it('lists current positions in the named organization, sorted by code, until the latest end', async () => {
    await givenPosition('123456789', 'rivera', ORG, 'unitLeader', '2027-01-01T06:00:00Z');
    await givenPosition('123456789', 'rivera', ORG, 'committeeMember', '2027-03-01T06:00:00Z');

    const res = await signedIn(url);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      scoutingMemberId: '123456789',
      organizationId: ORG,
      status: 'current',
      expiresAt: '2027-03-01T06:00:00Z',
      positions: [
        { positionCode: 'committeeMember', expiresAt: '2027-03-01T06:00:00Z' },
        { positionCode: 'unitLeader', expiresAt: '2027-01-01T06:00:00Z' },
      ],
      asOf: AS_OF,
    });
  });

  it('leaves out ended terms and positions held in other organizations', async () => {
    await givenPosition('123456789', 'rivera', ORG, 'unitLeader', FUTURE);
    await givenPosition('123456789', 'rivera', ORG, 'committeeMember', PAST);
    await givenPosition('123456789', 'rivera', 'district-77', 'unitCommissioner', FUTURE);

    const body = await (await signedIn(url)).json<{ positions: { positionCode: string }[] }>();

    expect(body.positions.map((p) => p.positionCode)).toEqual(['unitLeader']);
  });

  it.each([
    ['no positions anywhere', async () => {}],
    ['the wrong last name', () => givenPosition('123456789', 'smith', ORG, 'unitLeader', FUTURE)],
    [
      'positions only in another organization',
      () => givenPosition('123456789', 'rivera', 'other', 'unitLeader', FUTURE),
    ],
    ['only ended terms', () => givenPosition('123456789', 'rivera', ORG, 'unitLeader', PAST)],
  ])('answers notCurrent with an empty list for %s', async (_label, arrange) => {
    await arrange();

    const res = await signedIn(url);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(notCurrent);
  });

  it('is never cached', async () => {
    await givenPosition('123456789', 'rivera', ORG, 'unitLeader', FUTURE);

    const res = await signedIn(url);

    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each([
    ['/v1/adults/123456789/organizations/unit-4f1c2a90/positions', {}, 'invalidLastName'],
    ['/v1/adults/12x/organizations/unit-4f1c2a90/positions', { lastName: 'Rivera' }, 'invalidMemberId'],
    ['/v1/adults/123456789/organizations/bad_org!/positions', { lastName: 'Rivera' }, 'invalidOrganizationId'],
  ])('%s with %j is a 400 %s problem', async (path, body, slug) => {
    const res = await signedIn(path, body);

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ type: `${PROBLEMS}/${slug}` });
  });
});
