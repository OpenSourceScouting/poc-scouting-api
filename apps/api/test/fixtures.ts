import { env } from 'cloudflare:test';

export const AS_OF = '2026-10-28T14:05:00Z';
export const FUTURE = '2099-05-15T05:00:00Z';
export const PAST = '2001-01-01T05:00:00Z';

/**
 * HMAC of an already-normalized last name, computed independently of the production
 * normalizer so that tests of name matching are not tautological.
 */
export async function hashOfNormalized(normalized: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.NAME_HASH_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(normalized));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function givenSyncedAt(asOf = AS_OF): Promise<void> {
  await env.DB.prepare('INSERT OR REPLACE INTO sync_state (id, as_of) VALUES (1, ?)').bind(asOf).run();
}

export async function givenYpt(memberId: string, normalizedLastName: string, expiresAt: string): Promise<void> {
  await env.DB.prepare('INSERT OR REPLACE INTO ypt_status (member_id, last_name_hash, expires_at) VALUES (?, ?, ?)')
    .bind(memberId, await hashOfNormalized(normalizedLastName), expiresAt)
    .run();
}

/** An RFC 3339 UTC timestamp, whole seconds, `seconds` from now. */
export function inSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export async function givenMembership(memberId: string, normalizedLastName: string, expiresAt: string): Promise<void> {
  await env.DB.prepare(
    'INSERT OR REPLACE INTO membership_status (member_id, last_name_hash, expires_at) VALUES (?, ?, ?)',
  )
    .bind(memberId, await hashOfNormalized(normalizedLastName), expiresAt)
    .run();
}

export async function givenPosition(
  memberId: string,
  normalizedLastName: string,
  organizationId: string,
  positionCode: string,
  expiresAt: string,
): Promise<void> {
  await env.DB.prepare(
    'INSERT OR REPLACE INTO position_assignments (member_id, organization_id, position_code, last_name_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(memberId, organizationId, positionCode, await hashOfNormalized(normalizedLastName), expiresAt)
    .run();
}
