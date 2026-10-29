import createClient, { type ClientOptions } from 'openapi-fetch';
import type { paths } from './schema';

export type { components, operations, paths } from './schema';

/**
 * Creates a typed client for the Scouting API. The types come from openapi/openapi.json. Thus a contract
 * change causes a compile error in the code that uses the client, not an error when the code runs.
 */
export function createScoutingClient(options: ClientOptions & { baseUrl: string }) {
  return createClient<paths>(options);
}

export type ScoutingClient = ReturnType<typeof createScoutingClient>;
