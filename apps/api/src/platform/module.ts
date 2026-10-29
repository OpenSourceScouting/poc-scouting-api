import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../env';
import { validationHook } from './problem';

/**
 * A feature module is one independent part of the API, with its own routes, schemas, data access, and
 * tests. A module uses only `platform/`, never a different module. Thus you can add or remove a feature
 * without a change to the other contracts. Register each new module in `modules/index.ts`.
 */
export interface FeatureModule {
  /** The OpenAPI tag that groups the operations of this module in the docs. */
  tag: { name: string; description: string };
  /** The routes of the module, mounted under its versioned base path (for example `/v1`). */
  routes: OpenAPIHono<AppEnv>;
  basePath: `/v${number}`;
}

/** Creates a router with the platform conventions: validation errors become problem+json responses. */
export function createModuleRouter(): OpenAPIHono<AppEnv> {
  return new OpenAPIHono<AppEnv>({ defaultHook: validationHook });
}
