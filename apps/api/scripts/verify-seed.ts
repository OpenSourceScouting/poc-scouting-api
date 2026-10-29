/**
 * Checks the running local API against the sample adults in scripts/sample-adults.ts. For each adult it sends
 * the stored last name, each alternative spelling, and a wrong name to the open checks, and asks for the
 * positions in each sample organization. The expected answer comes from the sample data itself.
 *
 * Usage: start the API (`npm run dev`), seed it (`npm run db:reset -w @scouting/api`), then run
 * `npm run db:verify-seed -w @scouting/api`. Set API_URL to check a different host.
 */
import { readFileSync } from 'node:fs';
import { importJWK, SignJWT } from 'jose';
import { DEV_SIGNING_KEY } from './dev-env';
import { SAMPLE_ORGANIZATIONS, sampleAdults } from './sample-adults';

const baseUrl = process.env.API_URL ?? 'http://localhost:8787';
const now = Date.now();
const isCurrent = (end: string | undefined) => end !== undefined && Date.parse(end) > now;

const key = await importJWK(JSON.parse(readFileSync(DEV_SIGNING_KEY, 'utf8')), 'ES256');
const token = await new SignJWT({ scope: 'positions:read' })
  .setProtectedHeader({ alg: 'ES256', kid: 'local-dev' })
  .setSubject('verify-seed')
  .setIssuer('https://login.example.scouting.org')
  .setAudience('https://api.example.scouting.org')
  .setIssuedAt()
  .setExpirationTime('10m')
  .sign(key);

async function check(path: string, lastName: string, signedIn = false): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(signedIn ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ lastName }),
  });
  if (res.status !== 200) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()) as Record<string, unknown>;
}

let passed = 0;
const failures: string[] = [];
function expect(label: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

for (const adult of sampleAdults(now)) {
  const id = adult.id;
  // At most 1 + 2 + 1 + 1 + organizations checks per adult, inside the limit of 10 checks a minute per member ID.
  for (const name of [adult.lastName, ...(adult.sendAs ?? [])]) {
    const ypt = await check(`/v1/adults/${id}/ypt`, name);
    expect(`${id} ypt as "${name}"`, ypt.status, isCurrent(adult.ypt) ? 'current' : 'notCurrent');
  }
  const wrong = await check(`/v1/adults/${id}/ypt`, 'Wrongname');
  expect(`${id} ypt with a wrong name`, wrong.status, 'notCurrent');
  const membership = await check(`/v1/adults/${id}/membership`, adult.lastName);
  expect(`${id} membership`, membership.status, isCurrent(adult.membership) ? 'current' : 'notCurrent');

  const orgs = new Set((adult.positions ?? []).map(([org]) => org));
  orgs.add(SAMPLE_ORGANIZATIONS.find((o) => !orgs.has(o)) ?? 'unknown-org');
  for (const org of orgs) {
    const answer = await check(`/v1/adults/${id}/organizations/${org}/positions`, adult.lastName, true);
    const expected = (adult.positions ?? [])
      .filter(([o, , end]) => o === org && isCurrent(end))
      .map(([, code]) => code)
      .sort();
    const actual = ((answer.positions as { positionCode: string }[]) ?? []).map((p) => p.positionCode);
    expect(`${id} positions in ${org}`, actual, expected);
    expect(`${id} positions status in ${org}`, answer.status, expected.length > 0 ? 'current' : 'notCurrent');
  }
}

console.log(`${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(failures.length === 0 ? 0 : 1);
