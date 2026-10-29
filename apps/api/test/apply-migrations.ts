import { applyD1Migrations, env } from 'cloudflare:test';
import { beforeEach } from 'vitest';

// Idempotent: already-applied migrations are skipped.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// D1 storage persists across tests in a file; start every test from empty tables.
beforeEach(async () => {
  const { results } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations'",
  ).all<{ name: string }>();
  await env.DB.batch(results.map(({ name }) => env.DB.prepare(`DELETE FROM "${name}"`)));
});
