import { beforeEach, describe, expect, it } from 'vitest';
import { AS_OF, FUTURE, PAST, givenSyncedAt } from './fixtures';
import { api } from './http';

const PROBLEMS = 'https://api.example.scouting.org/problems';

/** A check request: POST with a JSON body, so no personal data is ever in the URL. */
export function checkRequest(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

/**
 * The shared contract every open adult check (YPT, membership, ...) must satisfy: one response
 * shape, last-name matching, the uniform answer rule, validation problems, and no caching.
 * A new open check module proves conformance by calling this with its own path and fixture.
 */
export function describeOpenAdultCheck(options: {
  /** Path for a member ID. */
  path: (scoutingMemberId: string) => string;
  /** Arrange: the source system holds a record for this adult that is valid until `expiresAt`. */
  given: (memberId: string, normalizedLastName: string, expiresAt: string) => Promise<void>;
}): void {
  const { path, given } = options;
  const check = (memberId: string, lastName: unknown, headers?: Record<string, string>) =>
    api(path(memberId), checkRequest({ lastName }, headers));

  describe(`POST ${path('{scoutingMemberId}')}`, () => {
    beforeEach(async () => {
      await givenSyncedAt();
      await given('123456789', 'obrien', FUTURE);
    });

    it('answers current, until when, for an adult with a current record', async () => {
      const res = await check('123456789', 'OBrien');

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        scoutingMemberId: '123456789',
        status: 'current',
        expiresAt: FUTURE,
        asOf: AS_OF,
      });
    });

    it('is never cached', async () => {
      const res = await check('123456789', 'OBrien');

      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(res.headers.get('ETag')).toBeNull();
    });

    it('ignores unknown body fields, so clients can evolve additively', async () => {
      const res = await api(path('123456789'), checkRequest({ lastName: 'OBrien', someFutureField: true }));

      expect(await res.json()).toMatchObject({ status: 'current' });
    });
  });

  describe('last name matching', () => {
    beforeEach(() => givenSyncedAt());

    it.each([
      ['obrien', "O'Brien"],
      ['obrien', 'O’Brien'],
      ['obrien', 'OBRIEN'],
      ['pena', 'Peña'],
      ['muller', 'Müller'],
      ['vanderberg', 'van der Berg'],
      ['smithjones', 'Smith-Jones'],
      ['smith', 'Smith Jr.'],
      ['smith', 'Smith, Jr'],
      ['king', 'King III'],
    ])('matches stored "%s" when the caller sends "%s"', async (stored, supplied) => {
      await given('100000001', stored, FUTURE);

      expect(await (await check('100000001', supplied)).json()).toMatchObject({ status: 'current' });
    });

    it('does not strip a suffix-like word that is the whole name', async () => {
      await given('100000002', 'ii', FUTURE);

      expect(await (await check('100000002', 'II')).json()).toMatchObject({ status: 'current' });
    });
  });

  describe('uniform answer rule', () => {
    const notCurrent = { scoutingMemberId: '200000001', status: 'notCurrent', expiresAt: null, asOf: AS_OF };

    beforeEach(() => givenSyncedAt());

    it('answers notCurrent for a member ID the platform does not hold (no such member, or a youth)', async () => {
      const res = await check('200000001', 'Anyone');

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(notCurrent);
    });

    it('answers notCurrent for the wrong last name', async () => {
      await given('200000001', 'rivera', FUTURE);

      expect(await (await check('200000001', 'Smith')).json()).toEqual(notCurrent);
    });

    it('answers notCurrent once the record has expired', async () => {
      await given('200000001', 'rivera', PAST);

      expect(await (await check('200000001', 'Rivera')).json()).toEqual(notCurrent);
    });

    it('gives a wrong-name answer that is byte-identical to an unknown-member answer', async () => {
      const unknown = await (await check('200000001', 'Smith')).text();
      await given('200000001', 'rivera', FUTURE);
      const wrongName = await (await check('200000001', 'Smith')).text();

      expect(wrongName).toBe(unknown);
    });
  });

  describe('malformed requests', () => {
    beforeEach(() => givenSyncedAt());

    it.each([
      ['no lastName', '123456789', {}, 'invalidLastName', 'lastName is required.'],
      ['empty lastName', '123456789', { lastName: '' }, 'invalidLastName', 'lastName is required.'],
      ['non-string lastName', '123456789', { lastName: 42 }, 'invalidLastName', 'lastName must be a string.'],
      [
        'punctuation only',
        '123456789',
        { lastName: "'- " },
        'invalidLastName',
        'lastName must contain at least one letter.',
      ],
      [
        'non-digit member ID',
        'abc',
        { lastName: 'Smith' },
        'invalidMemberId',
        'scoutingMemberId must contain digits only.',
      ],
      [
        '13-digit member ID',
        '1234567890123',
        { lastName: 'Smith' },
        'invalidMemberId',
        'scoutingMemberId must be at most 12 digits.',
      ],
      ['a JSON array body', '123456789', [], 'invalidRequestBody', 'The request body must be a JSON object.'],
    ])('%s is a 400 %s problem', async (_label, memberId, body, slug, detail) => {
      const res = await api(path(memberId), checkRequest(body));

      expect(res.status).toBe(400);
      expect(res.headers.get('Content-Type')).toBe('application/problem+json');
      expect(await res.json()).toMatchObject({ type: `${PROBLEMS}/${slug}`, status: 400, detail });
    });
  });
}
