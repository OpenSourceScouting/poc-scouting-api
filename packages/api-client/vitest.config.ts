import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Type assertions (expectTypeOf) live in ordinary test files; type-check them, not just *.test-d.ts.
    typecheck: { enabled: true, include: ['src/**/*.test.ts'], tsconfig: './tsconfig.json' },
  },
});
