import { z } from '@hono/zod-openapi';
import { CheckAnswerSchema } from '../../platform/adult-check';
import { TimestampSchema } from '../../platform/openapi';

/** A position code. PLACEHOLDER: the position list does not exist yet. The source is the position list of National. */
export const PositionCodeSchema = z.string().openapi('PositionCode', {
  description:
    'A code from /reference/v1/positionCodes.json, which is published separately. This is an open enum: new ' +
    'codes can occur. Show an unknown code as an unknown position, and get the list again. A code is never ' +
    'renamed or used again for a different position.',
  example: 'unitLeader',
});

export const PositionSchema = z
  .object({
    positionCode: PositionCodeSchema,
    expiresAt: TimestampSchema.openapi({ description: 'The end of this position term (exclusive).' }),
  })
  .openapi('Position');

export const PositionsAnswerSchema = CheckAnswerSchema.extend({
  organizationId: z.string().openapi({ description: 'The organization ID from the request.', example: '4f1c2a90' }),
  expiresAt: TimestampSchema.nullable().openapi({
    description: 'The latest end time of the listed positions. It is null when status is notCurrent.',
  }),
  positions: z.array(PositionSchema).openapi({
    description:
      'The current positions in the named organization, sorted by positionCode. When status is notCurrent, the list is empty, never null. The list never has pages.',
  }),
}).openapi('PositionsAnswer');
