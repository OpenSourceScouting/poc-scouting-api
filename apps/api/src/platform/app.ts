import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv } from '../env';
import type { FeatureModule } from './module';
import { SCOUTING_SIGN_IN } from './openapi';
import { hmacHex } from './adult-check';
import { ProblemError, problemResponse } from './problem';
import { log, telemetry } from './telemetry';

/** API operations are POST only, so no personal data is ever carried in a URL. Operational endpoints are GET. */
const PRODUCTION_SERVER = { url: 'https://api.example.scouting.org', description: 'Placeholder production host' };
const API_PREFIX = '/v1/';

const DOCS_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  // Swagger UI sets inline style attributes.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src 'self' ${PRODUCTION_SERVER.url}`,
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const DOCS_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Scouting API docs</title>
    <link rel="icon" href="data:," />
    <link rel="stylesheet" href="/docs/vendor/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/docs/vendor/swagger-ui-bundle.js"></script>
    <script src="/docs/init.js"></script>
  </body>
</html>
`;
const ALLOW_API = 'POST, OPTIONS';
const ALLOW_OPS = 'GET, OPTIONS';
const MAX_BODY_BYTES = 1024;

export function createApp(modules: readonly FeatureModule[]): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();

  app.use(requestId());
  // W3C Trace Context and OTel-shaped access logs. Replaces Workers invocation logs and native traces,
  // which would record the full URL including lastName.
  app.use(telemetry());
  // Public API: any origin may read responses.
  app.use(secureHeaders({ crossOriginResourcePolicy: 'cross-origin' }));
  // Any origin, no cookies. Exposed headers are listed because browser code cannot read them otherwise.
  app.use(
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type', 'traceparent'],
      exposeHeaders: ['Retry-After', 'Deprecation', 'Sunset', 'X-Request-Id'],
      maxAge: 86400,
    }),
  );
  app.use(async (c, next) => {
    const allow = new URL(c.req.url).pathname.startsWith(API_PREFIX) ? ALLOW_API : ALLOW_OPS;
    if (c.req.method === 'OPTIONS') return c.body(null, 204, { Allow: allow });
    if (!allow.startsWith(c.req.method)) {
      return problemResponse(c, 'methodNotAllowed', `Use one of these methods: ${allow}.`, {
        Allow: allow,
      });
    }
    await next();
  });
  // API bodies: JSON only, small, well formed. Parsed once here; validators reuse Hono's body cache.
  app.use(`${API_PREFIX}*`, async (c, next) => {
    if (!/^application\/json\s*(;|$)/i.test(c.req.header('Content-Type') ?? '')) {
      return problemResponse(c, 'unsupportedMediaType', 'Set Content-Type to application/json.');
    }
    if (
      Number(c.req.header('Content-Length') ?? 0) > MAX_BODY_BYTES ||
      (await c.req.raw.clone().arrayBuffer()).byteLength > MAX_BODY_BYTES
    ) {
      return problemResponse(c, 'payloadTooLarge', `The maximum size of a request body is ${MAX_BODY_BYTES} bytes.`);
    }
    try {
      await c.req.json();
    } catch {
      return problemResponse(c, 'invalidRequestBody', 'The request body is not valid JSON.');
    }
    await next();
  });
  // Caps checks about any one member ID, across all callers, so a last name cannot be guessed by spreading
  // attempts over many IPs. The key is a keyed hash, so no member ID reaches the limiter. Approximate, per location.
  app.use(`${API_PREFIX}adults/:scoutingMemberId/*`, async (c, next) => {
    const key = await hmacHex(c.env.NAME_HASH_KEY, `rate-limit|${c.req.param('scoutingMemberId')}`);
    const { success } = await c.env.MEMBER_RATE_LIMITER.limit({ key });
    if (!success) {
      return problemResponse(
        c,
        'rateLimited',
        'There were too many checks about this member ID. Wait, then send the check again.',
        {
          'Retry-After': '60',
        },
      );
    }
    await next();
  });

  app.get('/health', (c) => c.json({ status: 'ok', environment: c.env.ENVIRONMENT }));

  // The root is not part of the contract. Browsers go to the docs; API clients get links.
  app.get('/', (c) => {
    if (c.req.header('Accept')?.includes('text/html')) return c.redirect('/docs', 302);
    const { title, version } = openApiConfig(modules).info;
    return c.json({ name: title, version, docs: '/docs', openapi: '/openapi.json', health: '/health' });
  });

  for (const module of modules) {
    app.route(module.basePath, module.routes);
  }

  app.openAPIRegistry.registerComponent('securitySchemes', 'scoutingSignIn', SCOUTING_SIGN_IN);
  app.doc31('/openapi.json', openApiConfig(modules));
  // Interactive docs: self-hosted, pinned Swagger UI (docs/adr/0012). The page loads only same-origin files.
  app.get('/docs', (c) =>
    c.html(DOCS_HTML, 200, {
      'Content-Security-Policy': DOCS_CSP,
      // Keep the docs out of shared caches so a Swagger UI upgrade is picked up immediately.
      'Cache-Control': 'no-cache',
    }),
  );
  // The docs' copy of the spec lists the serving host first, so "Try it out" works locally. The canonical
  // /openapi.json names only production.
  app.get('/docs/openapi.json', (c) => {
    const origin = new URL(c.req.url).origin;
    const here = origin === PRODUCTION_SERVER.url ? [] : [{ url: origin, description: 'This host' }];
    return c.json({ ...app.getOpenAPI31Document(openApiConfig(modules)), servers: [...here, PRODUCTION_SERVER] });
  });

  app.notFound((c) => problemResponse(c, 'notFound', 'The path does not exist.'));
  app.onError((err, c) => {
    if (err instanceof ProblemError) {
      return problemResponse(c, err.slug, err.message, err.headers);
    }
    // Do not log the URL or the body. The body contains lastName.
    log(c, 'ERROR', 'unhandled error', { 'exception.type': err.name, 'exception.message': err.message });
    return problemResponse(c, 'internalError');
  });

  return app;
}

const DESCRIPTION = `This API answers questions about one adult. Each check identifies the adult by the member ID and
the last name together. This document is a draft for discussion, not a commitment. Version 0.1.0 is an
unofficial alpha, and nothing in it is official Scouting America policy or service. The host name is a
placeholder.

**Adults only.** The API does not store or answer about youth.

**No personal data in URLs.** Each check is a \`POST\` request. The JSON body contains \`lastName\`. A URL contains
only identifiers. No operation has query parameters. The API does not return, store, or log \`lastName\`. Checks
are safe and idempotent: they change nothing, so you can send a check again.

**Uniform answer rule.** Each valid request gets a \`200\` answer in the same format. These cases all give
\`notCurrent\` with \`expiresAt\` set to null: an unknown member, a wrong last name, a youth member, an expired
record, and a wrong organization. The \`positions\` list is empty when it applies. A \`404\` occurs only for an
unknown path.

**Read an answer.** Read the field \`status\`, not the HTTP status code. A wrong last name is a valid question
with the answer \`notCurrent\`. It is not an error. \`notCurrent\` has three possible causes: the data does not
match, the member ID is unknown, or the record is not current. The answer does not tell which cause applies.
Thus a check cannot show if an ID is real or who owns it. In your tool, tell people to examine the spelling of
the member ID and the last name. Tell the adult to sign in to my.scouting to see their own record.

**Test identities.** Reserved test identities give the same answers on each check, in each environment. Member
ID \`000000001\` with last name \`Testcurrent\` is always \`current\`. Member ID \`000000002\` with last name
\`Testnotcurrent\` is always \`notCurrent\`. Member IDs are strings, so leading zeros are part of the ID.

**Last name matching.** The API normalizes the supplied name and the stored name in the same way. It removes
accents and ignores case. It ignores all characters that are not letters or digits, for example spaces,
apostrophes, hyphens, periods, and commas. It also removes one suffix at the end (Jr, Sr, II, III, IV) if other
words remain.

**Open enums.** An enum can get new values at any time. Your client must accept values that it does not know.

**No cache.** Each answer has \`Cache-Control: no-store\`.

**Methods.** Use \`POST\` or \`OPTIONS\` on \`/v1\`. Other methods get \`405\` with \`Allow: POST, OPTIONS\`. The body
must be \`application/json\` (otherwise \`415\`) and 1 KiB or less (otherwise \`413\`). The API ignores unknown
body fields.

**Rate limits.** The CDN limits each client IP address, to about 60 requests each minute at first. The platform
limits each member ID to 10 checks each minute, from all checks and all callers. Both limits answer \`429\` with
\`Retry-After\`. If your tool has no API key, send a \`User-Agent\` that gives the name of the tool and a contact
address.

**Versions.** The path contains the major version. A new field or enum value does not break the contract. A
breaking change gets a new major version. The old version announces its end with the \`Deprecation\` header
(RFC 9745) and the \`Sunset\` header (RFC 8594).`;

/** Returns the document metadata. The served contract and `openapi:export` both use it. */
export function openApiConfig(modules: readonly FeatureModule[]) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Scouting API',
      // 0.x: an unofficial alpha proof of concept. The /v1 path is the contract major version, not this number.
      version: '0.1.0',
      description: DESCRIPTION,
      license: { name: 'Apache-2.0', identifier: 'Apache-2.0' },
    },
    servers: [PRODUCTION_SERVER],
    security: [],
    tags: modules.map((m) => m.tag),
  };
}
