import { env } from 'cloudflare:test';
import app from '../src/index';

/** Calls the fully composed app exactly as the Workers runtime would. */
export function api(path: string, init?: RequestInit): Promise<Response> {
  return Promise.resolve(app.request(path, init, env));
}
