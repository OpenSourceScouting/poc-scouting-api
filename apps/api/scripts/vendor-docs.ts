/**
 * Copies the pinned Swagger UI build into public/docs/vendor/ so the docs page is self-hosted (served as
 * Workers static assets) and loads nothing from third-party hosts. The license files travel with it, as
 * Apache-2.0 requires. Runs before dev, build, test, and deploy; the output is gitignored.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const source = dirname(createRequire(import.meta.url).resolve('swagger-ui-dist/package.json'));
const target = resolve(import.meta.dirname, '../public/docs/vendor');
mkdirSync(target, { recursive: true });
for (const file of ['swagger-ui-bundle.js', 'swagger-ui.css', 'LICENSE', 'NOTICE']) {
  copyFileSync(resolve(source, file), resolve(target, file));
}
console.log(`Vendored Swagger UI into ${target}`);
