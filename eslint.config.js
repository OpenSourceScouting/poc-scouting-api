import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/',
      '**/.wrangler/',
      'docs-site/',
      '**/schema.d.ts',
      '**/worker-configuration.d.ts',
      // Third-party code vendored at build time (scripts/vendor-docs.ts).
      'apps/api/public/docs/vendor/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    // Feature modules may depend on the platform, never on each other. This keeps features
    // additive: deleting or changing one module cannot break another.
    files: ['apps/api/src/modules/*/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.\\./(?!\\.\\./(platform|env)(/|$)|\\.\\./\\.\\./test/)',
              message: 'Feature modules must not import other modules. Move shared code into src/platform.',
            },
          ],
        },
      ],
    },
  },
  {
    // Browser scripts served as static assets.
    files: ['apps/api/public/**/*.js'],
    languageOptions: { globals: { window: 'readonly', SwaggerUIBundle: 'readonly' } },
  },
  {
    files: ['**/*.test.ts', '**/test/**/*.ts', 'apps/web/src/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
