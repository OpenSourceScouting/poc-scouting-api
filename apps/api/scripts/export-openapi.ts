/** Writes the OpenAPI contract to openapi/openapi.json. CI fails if the committed copy drifts. */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modules } from '../src/modules';
import { createApp, openApiConfig } from '../src/platform/app';

const doc = createApp(modules).getOpenAPI31Document(openApiConfig(modules));
const outPath = resolve(import.meta.dirname, '../../../openapi/openapi.json');
writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
