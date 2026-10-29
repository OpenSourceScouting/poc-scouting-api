import { z } from '@hono/zod-openapi';

/**
 * Shared OpenAPI parts. Each check module describes its responses with `checkResponses`, so all
 * operations document the same status codes, headers, and problem format.
 */

export const TimestampSchema = z.string().openapi({
  format: 'date-time',
  description: 'An RFC 3339 timestamp in UTC, with whole seconds, ending in Z. An end time is exclusive.',
  example: '2027-05-15T05:00:00Z',
});

/** The answer status. An open enum: the known values or any string, so generated clients accept new values. */
export const StatusSchema = z.union([z.enum(['current', 'notCurrent']), z.string()]).openapi('Status', {
  description:
    'An open enum: `current` or `notCurrent`. New values can occur. Treat an unknown value as `notCurrent`. ' +
    '`notCurrent` has three causes: the data does not match, the member is unknown, or the record is not ' +
    'current. The answer does not say which cause applies. Thus nobody can use it to find real member IDs ' +
    'or to learn who owns an ID.',
});

/** The text that tells a person what `notCurrent` means. All checks use it. */
export const NOT_CURRENT_MEANS =
  '`notCurrent` has three possible causes. The member ID and the last name do not match the records, or the ' +
  'platform does not answer for the member ID (it never includes youth), or the record is not current. The ' +
  'answer does not say which cause applies (the uniform answer rule). In your tool, tell people to examine ' +
  'the spelling of the member ID and the last name. Tell the adult to sign in to my.scouting to see their ' +
  'own record.';

export const ProblemSchema = z
  .object({
    type: z.url(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    requestId: z.string().optional(),
  })
  .openapi('Problem', { description: 'An error in the RFC 9457 Problem Details format.' });

const header = (description: string) => ({ description, schema: { type: 'string' as const } });

const RETRY_AFTER = { 'Retry-After': header('The number of seconds to wait before you send the request again.') };

const ANSWER_HEADERS = {
  'Cache-Control': header('Always no-store. The API does not let caches keep answers.'),
  'X-Request-Id': header('The request ID for tracing. If the caller sends an ID, the API returns that ID.'),
};

const problem = (description: string, headers: Record<string, ReturnType<typeof header>> = {}) => ({
  description,
  headers,
  content: { 'application/problem+json': { schema: ProblemSchema } },
});

/** Returns the full status code table for an adult check. */
export function checkResponses(
  schema: z.ZodType,
  options: { signedIn: boolean; examples: { current: object; notCurrent: object } },
) {
  return {
    200: {
      description:
        'The answer is in `status`. Each valid request gets a 200, for each answer. Thus read `status`, not the ' +
        `HTTP status code. ${NOT_CURRENT_MEANS}`,
      headers: ANSWER_HEADERS,
      content: {
        'application/json': {
          schema,
          examples: {
            current: { summary: 'Current', value: options.examples.current },
            notCurrent: {
              summary: 'Not current, no match, or unknown member',
              description: `Examine the spelling of the member ID and the last name. ${NOT_CURRENT_MEANS}`,
              value: options.examples.notCurrent,
            },
          },
        },
      },
    },
    400: problem(
      'An identifier or the body is not valid, or lastName is missing. The formats are public, so this error shows no data.',
    ),
    ...(options.signedIn
      ? {
          401: problem('The sign-in token is missing, not valid, or expired.', {
            'WWW-Authenticate': header('An RFC 6750 Bearer challenge.'),
          }),
          403: problem(
            'The token is valid, but this caller cannot make this check. The answer gives no data about the person.',
            {
              'WWW-Authenticate': header('An RFC 6750 Bearer challenge with error="insufficient_scope".'),
            },
          ),
        }
      : {}),
    413: problem('The request body is larger than 1 KiB.'),
    415: problem('The request body is not application/json.'),
    429: problem(
      'Too many requests: from this client (CDN limit), or about this member ID (platform limit).',
      RETRY_AFTER,
    ),
    500: problem('Our fault.'),
    503: problem('The API is not available for a short time, for example during maintenance.', RETRY_AFTER),
  } as const;
}

/** The sign-in scheme: OAuth 2.0 authorization code flow with PKCE. The token goes to the tool when a registered adult signs in. */
export const SCOUTING_SIGN_IN = {
  type: 'oauth2' as const,
  description:
    'Scouting America sign-in. Tools use the authorization code flow with PKCE. A tool never sees the password, ' +
    'and never asks for the session token of a different person. The URLs are placeholders.',
  flows: {
    authorizationCode: {
      authorizationUrl: 'https://login.example.scouting.org/oauth2/authorize',
      tokenUrl: 'https://login.example.scouting.org/oauth2/token',
      scopes: { 'positions:read': 'Lets the tool check which positions an adult holds in a named organization.' },
    },
  },
};

const AS_OF_EXAMPLE = '2026-10-28T14:05:00Z';

/** Example answers for checks that read one record. The examples use the reserved test identities. */
export const SINGLE_RECORD_EXAMPLES = {
  current: { scoutingMemberId: '000000001', status: 'current', expiresAt: '2030-01-01T05:00:00Z', asOf: AS_OF_EXAMPLE },
  notCurrent: { scoutingMemberId: '000000002', status: 'notCurrent', expiresAt: null, asOf: AS_OF_EXAMPLE },
};
