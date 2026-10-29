import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * An RFC 9457 Problem Details body. Each error response from this API uses this format, so consumers
 * can handle all errors in the same way.
 */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  requestId?: string;
}

export const PROBLEM_BASE = 'https://api.example.scouting.org/problems';

/**
 * The catalog of problem types. Each type has one status code and one title. The code raises errors from this
 * catalog, and the OpenAPI document builds its error examples from it, so the two cannot differ.
 */
export const PROBLEM_TYPES = {
  invalidMemberId: { status: 400, title: 'Invalid member ID' },
  invalidOrganizationId: { status: 400, title: 'Invalid organization ID' },
  invalidLastName: { status: 400, title: 'Invalid last name' },
  invalidRequestBody: { status: 400, title: 'Invalid request body' },
  invalidRequest: { status: 400, title: 'Invalid request' },
  unauthorized: { status: 401, title: 'Unauthorized' },
  forbidden: { status: 403, title: 'Forbidden' },
  notFound: { status: 404, title: 'Not found' },
  methodNotAllowed: { status: 405, title: 'Method not allowed' },
  payloadTooLarge: { status: 413, title: 'Payload too large' },
  unsupportedMediaType: { status: 415, title: 'Unsupported media type' },
  rateLimited: { status: 429, title: 'Too many requests' },
  internalError: { status: 500, title: 'Internal server error' },
  serviceUnavailable: { status: 503, title: 'Service unavailable' },
} as const satisfies Record<string, { status: ContentfulStatusCode; title: string }>;

export type ProblemSlug = keyof typeof PROBLEM_TYPES;

/** An error that the API sends as a problem response. Throw it from a handler or middleware. */
export class ProblemError extends Error {
  constructor(
    readonly slug: ProblemSlug,
    detail?: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(detail ?? PROBLEM_TYPES[slug].title);
  }
}

export function problemResponse(
  c: Context,
  slug: ProblemSlug,
  detail?: string,
  headers: Record<string, string> = {},
): Response {
  const { status, title } = PROBLEM_TYPES[slug];
  const body: Problem = {
    type: `${PROBLEM_BASE}/${slug}`,
    title,
    status,
    ...(detail === undefined ? {} : { detail }),
    instance: new URL(c.req.url).pathname,
    requestId: c.get('requestId'),
  };
  return c.json(body, status, { ...headers, 'Content-Type': 'application/problem+json' });
}

/** The problem type for each request field. Callers can use `type` and do not have to parse `detail`. */
const FIELD_PROBLEMS: Record<string, ProblemSlug> = {
  scoutingMemberId: 'invalidMemberId',
  organizationId: 'invalidOrganizationId',
  lastName: 'invalidLastName',
  // An issue with an empty path is about the body as a whole (for example, an array instead of an object).
  '': 'invalidRequestBody',
};

/** A zod-openapi hook. It changes each request validation failure into a 400 problem+json response. */
export const validationHook = (
  result: { success: true } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } },
  c: Context,
): Response | undefined => {
  if (result.success) return undefined;
  const issue = result.error.issues[0];
  const field = String(issue?.path[0] ?? '');
  return problemResponse(c, FIELD_PROBLEMS[field] ?? 'invalidRequest', issue?.message);
};
