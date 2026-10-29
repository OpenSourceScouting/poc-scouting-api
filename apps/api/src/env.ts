import type { RequestIdVariables } from 'hono/request-id';
import type { TraceContext } from './platform/telemetry';

/** Bindings provided by the Workers runtime; declared in wrangler.jsonc and .dev.vars. */
export interface Bindings {
  DB: D1Database;
  ENVIRONMENT: 'local' | 'test' | 'staging' | 'production';
  /** Workers rate limiting binding: checks per member ID per minute, across all checks and callers. */
  MEMBER_RATE_LIMITER: RateLimit;
  /** Secret key for the HMAC of normalized last names. Must match the key used by the sync. */
  NAME_HASH_KEY: string;
  /** Expected `iss` of Scouting America sign-in tokens. */
  OAUTH_ISSUER: string;
  /** Expected `aud` of Scouting America sign-in tokens. */
  OAUTH_AUDIENCE: string;
  /** JWKS URL of the identity provider. Used when OAUTH_JWKS is not set. */
  OAUTH_JWKS_URL?: string;
  /** Inline JWKS JSON, for local development and tests only. */
  OAUTH_JWKS?: string;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: RequestIdVariables & {
    trace: TraceContext;
    /** Extra attributes for this request's access log record. Must never contain PII. */
    logAttributes?: Record<string, string>;
  };
}
