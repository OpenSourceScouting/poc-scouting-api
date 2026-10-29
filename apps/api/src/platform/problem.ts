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

export class ProblemError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly slug: string,
    readonly title: string,
    detail?: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(detail ?? title);
  }
}

export function problemResponse(
  c: Context,
  status: ContentfulStatusCode,
  slug: string,
  title: string,
  detail?: string,
  headers: Record<string, string> = {},
): Response {
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
const FIELD_PROBLEMS: Record<string, { slug: string; title: string }> = {
  scoutingMemberId: { slug: 'invalidMemberId', title: 'Invalid member ID' },
  organizationId: { slug: 'invalidOrganizationId', title: 'Invalid organization ID' },
  lastName: { slug: 'invalidLastName', title: 'Invalid last name' },
  // An issue with an empty path is about the body as a whole (for example, an array instead of an object).
  '': { slug: 'invalidRequestBody', title: 'Invalid request body' },
};

/** A zod-openapi hook. It changes each request validation failure into a 400 problem+json response. */
export const validationHook = (
  result: { success: true } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } },
  c: Context,
): Response | undefined => {
  if (result.success) return undefined;
  const issue = result.error.issues[0];
  const field = String(issue?.path[0] ?? '');
  const problem = FIELD_PROBLEMS[field] ?? { slug: 'invalidRequest', title: 'Invalid request' };
  return problemResponse(c, 400, problem.slug, problem.title, issue?.message);
};
