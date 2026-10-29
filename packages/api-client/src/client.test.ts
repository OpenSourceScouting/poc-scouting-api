import { describe, expect, expectTypeOf, it } from 'vitest';
import { createScoutingClient, type components, type paths } from './index';

type CheckAnswer = components['schemas']['CheckAnswer'];
type Problem = components['schemas']['Problem'];

const answer: CheckAnswer = {
  scoutingMemberId: '123456789',
  status: 'current',
  expiresAt: '2027-05-15T05:00:00Z',
  asOf: '2026-10-28T14:05:00Z',
};

describe('@scouting/api-client', () => {
  it('POSTs the SYT check with the member ID in the path and the last name only in the JSON body', async () => {
    const calls: { method: string; url: string; contentType: string | null; body: unknown }[] = [];
    const client = createScoutingClient({
      baseUrl: 'https://api.test',
      fetch: async (req: Request) => {
        calls.push({
          method: req.method,
          url: req.url,
          contentType: req.headers.get('Content-Type'),
          body: await req.json(),
        });
        return Response.json(answer);
      },
    });

    const { data } = await client.POST('/v1/adults/{scoutingMemberId}/syt', {
      params: { path: { scoutingMemberId: '123456789' } },
      body: { lastName: "O'Brien" },
    });

    expect(calls).toEqual([
      {
        method: 'POST',
        url: 'https://api.test/v1/adults/123456789/syt',
        contentType: 'application/json',
        body: { lastName: "O'Brien" },
      },
    ]);
    expectTypeOf(data).toEqualTypeOf<CheckAnswer | undefined>();
    expect(data?.status).toBe('current');
  });

  it('exposes no way to send the last name in a URL', () => {
    type SytQuery = paths['/v1/adults/{scoutingMemberId}/syt']['post']['parameters']['query'];
    // Generated as `query?: never`: nothing can be supplied there.
    expectTypeOf<SytQuery>().toEqualTypeOf<undefined>();
  });

  it('accepts unknown status values without type errors (open enum)', () => {
    expectTypeOf<'someFutureStatus'>().toExtend<CheckAnswer['status']>();
  });

  it('types positions answers with their list of positions', () => {
    type Positions = components['schemas']['PositionsAnswer'];
    expectTypeOf<Positions['positions'][number]>().toEqualTypeOf<components['schemas']['Position']>();
    expectTypeOf<Positions['organizationId']>().toEqualTypeOf<string>();
  });

  it('types errors as RFC 9457 problems', async () => {
    const client = createScoutingClient({
      baseUrl: 'https://api.test',
      fetch: async () =>
        Response.json({ type: 'https://x/invalidMemberId', title: 'Invalid member ID', status: 400 }, { status: 400 }),
    });

    const { error } = await client.POST('/v1/adults/{scoutingMemberId}/membership', {
      params: { path: { scoutingMemberId: 'abc' } },
      body: { lastName: 'Smith' },
    });

    expectTypeOf(error).toEqualTypeOf<Problem | undefined>();
    expect(error?.status).toBe(400);
  });
});
