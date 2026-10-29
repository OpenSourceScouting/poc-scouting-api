import type { MiddlewareHandler } from 'hono';
import { createLocalJWKSet, createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose';
import type { AppEnv, Bindings } from '../env';
import { ProblemError } from './problem';

const REALM = 'Bearer realm="scouting-api"';

/** Remote key sets keep their keys in a cache, so keep one key set for each URL while the isolate runs. */
const remoteKeySets = new Map<string, JWTVerifyGetKey>();

function keySet(env: Bindings): JWTVerifyGetKey {
  if (env.OAUTH_JWKS) return createLocalJWKSet(JSON.parse(env.OAUTH_JWKS));
  if (!env.OAUTH_JWKS_URL) throw new Error('Neither OAUTH_JWKS nor OAUTH_JWKS_URL is configured');
  let remote = remoteKeySets.get(env.OAUTH_JWKS_URL);
  if (!remote) {
    remote = createRemoteJWKSet(new URL(env.OAUTH_JWKS_URL));
    remoteKeySets.set(env.OAUTH_JWKS_URL, remote);
  }
  return remote;
}

const unauthorized = (challenge: string) =>
  new ProblemError(401, 'unauthorized', 'Unauthorized', 'A valid sign-in token is required.', {
    'WWW-Authenticate': challenge,
  });

/**
 * Returns middleware that requires a Scouting America sign-in token with `scope`. The tool gets the token
 * from the OAuth 2.0 authorization code flow with PKCE. The errors follow RFC 6750 and give no data about the
 * person that the tool checks.
 */
export function requireSignIn(scope: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const match = /^Bearer (\S+)$/i.exec(c.req.header('Authorization') ?? '');
    if (!match?.[1]) throw unauthorized(REALM);

    let granted: string[];
    try {
      const { payload } = await jwtVerify(match[1], keySet(c.env), {
        issuer: c.env.OAUTH_ISSUER,
        audience: c.env.OAUTH_AUDIENCE,
        algorithms: ['ES256', 'RS256'],
      });
      granted = typeof payload.scope === 'string' ? payload.scope.split(' ') : [];
    } catch {
      throw unauthorized(`${REALM}, error="invalid_token"`);
    }

    if (!granted.includes(scope)) {
      throw new ProblemError(403, 'forbidden', 'Forbidden', 'This sign-in is not allowed to make this check.', {
        'WWW-Authenticate': `${REALM}, error="insufficient_scope", scope="${scope}"`,
      });
    }
    await next();
  };
}
