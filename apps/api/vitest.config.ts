import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { exportJWK, generateKeyPair } from 'jose';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  // A throwaway identity provider key per run: the Worker trusts the public half, tests sign with the private half.
  const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
  const publicJwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'ES256' };
  const privateJwk = { ...(await exportJWK(privateKey)), kid: 'test-key', alg: 'ES256' };

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            ENVIRONMENT: 'test',
            NAME_HASH_KEY: 'test-name-hash-key',
            OAUTH_JWKS: JSON.stringify({ keys: [publicJwk] }),
            TEST_SIGNING_JWK: JSON.stringify(privateJwk),
            TEST_MIGRATIONS: migrations,
          },
          // Counters cannot be reset between tests, so tests use a higher limit than production (10).
          ratelimits: { MEMBER_RATE_LIMITER: { namespace_id: '1000', simple: { limit: 50, period: 60 } } },
        },
      }),
    ],
    test: { setupFiles: ['./test/apply-migrations.ts'], silent: 'passed-only' as const },
  };
});
