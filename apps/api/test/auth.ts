import { env } from 'cloudflare:test';
import { generateKeyPair, importJWK, type JWTPayload, SignJWT } from 'jose';

interface TokenOptions {
  scope?: string;
  issuer?: string;
  audience?: string;
  expiresIn?: string | number;
  /** Sign with an unrelated key, as a forger would. */
  forged?: boolean;
  claims?: JWTPayload;
}

/** Mints a sign-in token as the Scouting America identity provider would. */
export async function signInToken(options: TokenOptions = {}): Promise<string> {
  const key = options.forged
    ? (await generateKeyPair('ES256')).privateKey
    : await importJWK(JSON.parse(env.TEST_SIGNING_JWK), 'ES256');
  return new SignJWT({ scope: options.scope ?? 'positions:read', ...options.claims })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject('tool-user-1')
    .setIssuer(options.issuer ?? env.OAUTH_ISSUER)
    .setAudience(options.audience ?? env.OAUTH_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? '5m')
    .sign(key);
}

export const bearer = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` });
