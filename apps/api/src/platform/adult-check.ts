import { z } from '@hono/zod-openapi';
import type { Context, TypedResponse } from 'hono';
import type { AppEnv } from '../env';
import { StatusSchema, TimestampSchema } from './openapi';

/**
 * Shared parts for adult checks. An adult check is a yes or no question about one adult. The check
 * identifies the adult by the member ID and the last name together. All check modules use these
 * parts, so all checks share one contract.
 */

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);

/**
 * Returns the normalized form of a last name. The API applies it to the value from the caller and to the
 * source record in the same way, before it hashes them. These rules are part of the public contract
 * (see the OpenAPI description):
 *
 * 1. Remove accents (Peña becomes pena).
 * 2. Change all letters to lowercase.
 * 3. Remove one generational suffix at the end (Jr, Sr, II, III, IV), if other words remain.
 * 4. Remove all characters that are not letters or digits (spaces, apostrophes, hyphens, periods, commas).
 */
export function normalizeLastName(lastName: string): string {
  const words = lastName
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((w) => w.length > 0);
  const last = words.at(-1)?.replaceAll('.', '');
  if (words.length > 1 && last !== undefined && SUFFIXES.has(last)) words.pop();
  return words.join('').replace(/[^\p{L}\p{N}]/gu, '');
}

/** Returns the HMAC-SHA256 of a message as hex. Use a different prefix for each purpose, so nobody can compare hashes from different purposes. */
export async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Returns the stored form of a last name: the HMAC of the normalized name. The sync must make the same value. */
export function hashLastName(key: string, lastName: string): Promise<string> {
  return hmacHex(key, normalizeLastName(lastName));
}

/** Checks whether `expiresAt` is after `now`. `expiresAt` is exclusive: it is the first time when the answer is not true. */
export function isUnexpired(expiresAt: string, now: Date): boolean {
  return Date.parse(expiresAt) > now.getTime();
}

/** A source record for a check that reads one record: the stored last name hash and the end of the fact. */
export interface HeldRecord {
  lastNameHash: string;
  expiresAt: string;
}

/**
 * Applies the uniform answer rule for checks that read one record. No record, a wrong name, and an
 * expired record all give the same notCurrent answer. Thus a response never shows which part failed.
 */
export function evaluate(
  record: HeldRecord | null,
  lastNameHash: string,
  now: Date,
): { status: 'current' | 'notCurrent'; expiresAt: string | null } {
  const current = record !== null && record.lastNameHash === lastNameHash && isUnexpired(record.expiresAt, now);
  return current ? { status: 'current', expiresAt: record.expiresAt } : { status: 'notCurrent', expiresAt: null };
}

export async function readAsOf(db: D1Database): Promise<string> {
  const row = await db.prepare('SELECT as_of FROM sync_state WHERE id = 1').first<{ as_of: string }>();
  if (!row) throw new Error('sync_state is empty: the dataset has never been synced');
  return row.as_of;
}

/**
 * ASSUMPTION (open question for National IT): member IDs have 1 to 12 digits. The ID is a string, so
 * leading zeros stay, and no client rounds a long ID.
 */
export const ScoutingMemberIdParam = z
  .string()
  .regex(/^\d+$/, 'scoutingMemberId must contain digits only.')
  .max(12, 'scoutingMemberId must be at most 12 digits.')
  .openapi({
    param: { name: 'scoutingMemberId', in: 'path' },
    description: 'The Scouting America member ID. Digits only. It is a string, so leading zeros stay.',
    example: '123456789',
  });

/**
 * ASSUMPTION (open question for National IT): one opaque identifier is used for units, districts, and
 * councils. Until the format is known, the API accepts 1 to 64 letters, digits, and hyphens.
 */
export const OrganizationIdParam = z
  .string()
  .regex(/^[A-Za-z0-9-]+$/, 'organizationId must contain only letters, digits, and hyphens.')
  .max(64, 'organizationId must be at most 64 characters.')
  .openapi({
    param: { name: 'organizationId', in: 'path' },
    description: 'The identifier of a unit, district, or council.',
    example: '4f1c2a90',
  });

/** The last name. It is personal data, so it goes only in the request body. It is never in a URL, and the API never logs it. */
export const LastNameSchema = z
  .string({ error: (issue) => (issue.input === undefined ? 'lastName is required.' : 'lastName must be a string.') })
  .min(1, 'lastName is required.')
  .max(100, 'lastName must be at most 100 characters.')
  .refine((v) => /\p{L}/u.test(normalizeLastName(v)), 'lastName must contain at least one letter.')
  .openapi({
    description:
      'Required check against the member ID. Matching ignores case, accents, spaces, apostrophes, hyphens, ' +
      'periods, commas, and one trailing suffix (Jr, Sr, II, III, IV). Never echoed or logged.',
    example: "O'Brien",
  });

const objectBody = { error: 'The request body must be a JSON object.' };

export const CheckRequestSchema = z.object({ lastName: LastNameSchema }, objectBody).openapi('CheckRequest');

/** Returns the request body definition for an adult check route. */
export function checkBody<T extends z.ZodType>(schema: T) {
  return { required: true, content: { 'application/json': { schema } } } as const;
}

export const CheckAnswerSchema = z
  .object({
    scoutingMemberId: z.string().openapi({ description: 'The member ID from the request.', example: '123456789' }),
    status: StatusSchema,
    expiresAt: TimestampSchema.nullable().openapi({
      description:
        'The first time when the answer is not true. It has a value only when status is current. Otherwise it is null.',
    }),
    asOf: TimestampSchema.openapi({
      description: 'The time of the last sync from the Scouting America systems. It is one value for the full dataset.',
      example: '2026-10-28T14:05:00Z',
    }),
  })
  .openapi('CheckAnswer');

export type CheckAnswer = z.infer<typeof CheckAnswerSchema>;

/**
 * Sends a check answer that caches must not keep (see ADR 0010). It also records two abuse signals for the
 * access log: a keyed hash of the normalized last name, for this purpose only, and the outcome. With the
 * member ID in the path, these signals show name guessing, and no name goes into the log.
 */
export async function respond<T extends { status: string; expiresAt: string | null }>(
  c: Context<AppEnv>,
  answer: T,
  check: { lastName: string },
): Promise<TypedResponse<T, 200, 'json'>> {
  c.set('logAttributes', {
    'check.last_name_hash': await hmacHex(c.env.NAME_HASH_KEY, `log|${normalizeLastName(check.lastName)}`),
    'check.outcome': answer.status,
  });
  return c.json(answer, 200, { 'Cache-Control': 'no-store' }) as unknown as TypedResponse<T, 200, 'json'>;
}
