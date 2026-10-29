import { createRoute, z } from '@hono/zod-openapi';
import {
  hashLastName,
  isUnexpired,
  CheckRequestSchema,
  checkBody,
  OrganizationIdParam,
  readAsOf,
  respond,
  ScoutingMemberIdParam,
} from '../../platform/adult-check';
import { requireSignIn } from '../../platform/auth';
import { createModuleRouter } from '../../platform/module';
import { checkResponses } from '../../platform/openapi';
import { d1PositionsRepository } from './repository';
import { PositionsAnswerSchema } from './schemas';

const checkPositions = createRoute({
  method: 'post',
  path: '/adults/{scoutingMemberId}/organizations/{organizationId}/positions',
  operationId: 'checkPositions',
  tags: ['Positions'],
  summary: 'Lists the positions that an adult holds in one organization, and until when',
  middleware: [requireSignIn('positions:read')] as const,
  request: {
    params: z.object({ scoutingMemberId: ScoutingMemberIdParam, organizationId: OrganizationIdParam }),
    body: checkBody(CheckRequestSchema),
    checkBody,
  },
  security: [{ scoutingSignIn: ['positions:read'] }],
  responses: checkResponses(PositionsAnswerSchema, {
    signedIn: true,
    path: '/v1/adults/{scoutingMemberId}/organizations/{organizationId}/positions',
    examples: {
      current: {
        scoutingMemberId: '000000001',
        organizationId: 'test-org-1',
        status: 'current',
        expiresAt: '2030-01-01T05:00:00Z',
        positions: [
          { positionCode: 'committeeMember', expiresAt: '2029-06-01T05:00:00Z' },
          { positionCode: 'unitLeader', expiresAt: '2030-01-01T05:00:00Z' },
        ],
        asOf: '2026-10-28T14:05:00Z',
      },
      notCurrent: {
        scoutingMemberId: '000000002',
        organizationId: 'test-org-1',
        status: 'notCurrent',
        expiresAt: null,
        positions: [],
        asOf: '2026-10-28T14:05:00Z',
      },
    },
  }),
});

export const positionsRoutes = createModuleRouter().openapi(checkPositions, async (c) => {
  const { scoutingMemberId, organizationId } = c.req.valid('param');
  const { lastName } = c.req.valid('json');
  const [terms, asOf, lastNameHash] = await Promise.all([
    d1PositionsRepository(c.env.DB).list(scoutingMemberId, organizationId),
    readAsOf(c.env.DB),
    hashLastName(c.env.NAME_HASH_KEY, lastName),
  ]);

  const now = new Date();
  // Sorted by code (code-point order, not locale) so the same answer always has the same bytes.
  const positions = terms
    .filter((t) => t.lastNameHash === lastNameHash && isUnexpired(t.expiresAt, now))
    .map(({ positionCode, expiresAt }) => ({ positionCode, expiresAt }))
    .sort((a, b) => (a.positionCode < b.positionCode ? -1 : a.positionCode > b.positionCode ? 1 : 0));
  const ends = positions.map((p) => p.expiresAt).sort();

  // status is derived from positions, so the two can never disagree.
  const answer = {
    scoutingMemberId,
    organizationId,
    status: positions.length > 0 ? 'current' : 'notCurrent',
    expiresAt: ends.at(-1) ?? null,
    positions,
    asOf,
  };
  return respond(c, answer, { lastName });
});
