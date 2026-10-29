import { createRoute, z } from '@hono/zod-openapi';
import {
  CheckAnswerSchema,
  evaluate,
  hashLastName,
  CheckRequestSchema,
  checkBody,
  readAsOf,
  respond,
  ScoutingMemberIdParam,
} from '../../platform/adult-check';
import { createModuleRouter } from '../../platform/module';
import { checkResponses, SINGLE_RECORD_EXAMPLES } from '../../platform/openapi';
import { d1SytRepository } from './repository';

const checkSytStatus = createRoute({
  method: 'post',
  path: '/adults/{scoutingMemberId}/syt',
  operationId: 'checkSytStatus',
  tags: ['SYT'],
  summary: 'Checks whether an adult has current Safeguarding Youth Training (SYT), and until when',
  request: { params: z.object({ scoutingMemberId: ScoutingMemberIdParam }), body: checkBody(CheckRequestSchema) },
  security: [],
  responses: checkResponses(CheckAnswerSchema, {
    signedIn: false,
    examples: SINGLE_RECORD_EXAMPLES,
    path: '/v1/adults/{scoutingMemberId}/syt',
  }),
});

export const sytRoutes = createModuleRouter().openapi(checkSytStatus, async (c) => {
  const { scoutingMemberId } = c.req.valid('param');
  const { lastName } = c.req.valid('json');
  const [record, asOf, lastNameHash] = await Promise.all([
    d1SytRepository(c.env.DB).find(scoutingMemberId),
    readAsOf(c.env.DB),
    hashLastName(c.env.NAME_HASH_KEY, lastName),
  ]);
  return respond(c, { scoutingMemberId, ...evaluate(record, lastNameHash, new Date()), asOf }, { lastName });
});
