/** Prints a local sign-in token for trying the positions endpoint. Usage: npm run dev:token [-- "scope ..."] */
import { readFileSync } from 'node:fs';
import { importJWK, SignJWT } from 'jose';
import { DEV_SIGNING_KEY } from './dev-env';

const scope = process.argv[2] ?? 'positions:read';
const key = await importJWK(JSON.parse(readFileSync(DEV_SIGNING_KEY, 'utf8')), 'ES256');
const token = await new SignJWT({ scope })
  .setProtectedHeader({ alg: 'ES256', kid: 'local-dev' })
  .setSubject('local-dev-tool')
  // Must match OAUTH_ISSUER and OAUTH_AUDIENCE in wrangler.jsonc (top-level, local).
  .setIssuer('https://login.example.scouting.org')
  .setAudience('https://api.example.scouting.org')
  .setIssuedAt()
  .setExpirationTime('8h')
  .sign(key);
console.log(token);
