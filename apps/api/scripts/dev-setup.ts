/**
 * Creates local-only secrets (idempotent): a random NAME_HASH_KEY and an ES256 key pair standing in
 * for the Scouting America identity provider. The public half goes into .dev.vars as OAUTH_JWKS.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { exportJWK, generateKeyPair } from 'jose';
import { DEV_SIGNING_KEY, readDevVars, writeDevVars } from './dev-env';

const vars = readDevVars();
vars.NAME_HASH_KEY ??= randomBytes(32).toString('hex');

if (!existsSync(DEV_SIGNING_KEY) || !vars.OAUTH_JWKS) {
  const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
  const meta = { kid: 'local-dev', alg: 'ES256', use: 'sig' };
  writeFileSync(DEV_SIGNING_KEY, JSON.stringify({ ...(await exportJWK(privateKey)), ...meta }));
  vars.OAUTH_JWKS = JSON.stringify({ keys: [{ ...(await exportJWK(publicKey)), ...meta }] });
}

writeDevVars(vars);
console.log('Local secrets ready in apps/api/.dev.vars');
