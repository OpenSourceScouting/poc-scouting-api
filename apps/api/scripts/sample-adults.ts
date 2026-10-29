/**
 * Fictional sample adults for local development, demos, and manual tests. Each entry describes one use
 * case. `scripts/generate-seed.ts` turns this list into seed/seed.sql and docs/sample-data.md, and
 * `scripts/verify-seed.ts` checks the running API against it. All people and organizations are fictional.
 * Position codes are placeholders until the position list of National exists.
 */

/** An RFC 3339 UTC timestamp, whole seconds, `hours` from the time of seeding. */
export function inHours(hours: number, from = Date.now()): string {
  return new Date(from + hours * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export const AS_OF = '2026-10-28T14:05:00Z';
/** Far in the future: the record stays current. */
export const LATER = '2030-01-01T05:00:00Z';
/** In the future, but earlier than LATER. */
export const EARLIER = '2029-06-01T05:00:00Z';
/** In the past: the record is not current. */
export const ENDED = '2025-01-01T05:00:00Z';

export interface SampleAdult {
  id: string;
  /** The last name as the source system stores it. */
  lastName: string;
  /** Other spellings that must match `lastName` after normalization. */
  sendAs?: string[];
  /** The use case, in one sentence. */
  useCase: string;
  group: string;
  syt?: string;
  membership?: string;
  positions?: [organizationId: string, positionCode: string, expiresAt: string][];
}

export function sampleAdults(now = Date.now()): SampleAdult[] {
  const soon = inHours(1, now);
  const justEnded = inHours(-1, now);
  const inThirtyDays = inHours(24 * 30, now);

  return [
    // Reserved test identities. The sync must load these in every environment.
    {
      group: 'Reserved test identities',
      id: '000000001',
      lastName: 'Testcurrent',
      useCase: 'Current on every check, with two positions in test-org-1.',
      syt: LATER,
      membership: LATER,
      positions: [
        ['test-org-1', 'unitLeader', LATER],
        ['test-org-1', 'committeeMember', EARLIER],
      ],
    },
    {
      group: 'Reserved test identities',
      id: '000000002',
      lastName: 'Testnotcurrent',
      useCase: 'Not current on every check: all records ended.',
      syt: ENDED,
      membership: ENDED,
      positions: [['test-org-1', 'unitLeader', ENDED]],
    },

    // Last name matching.
    {
      group: 'Last name matching',
      id: '123456789',
      lastName: "O'Brien",
      sendAs: ['obrien', 'O’BRIEN'],
      useCase: 'Straight apostrophe in the stored name; any case and a curly apostrophe match.',
      syt: LATER,
      membership: LATER,
      positions: [['4f1c2a90', 'unitLeader', LATER]],
    },
    {
      group: 'Last name matching',
      id: '400000001',
      lastName: 'O’Connor',
      sendAs: ["O'Connor"],
      useCase: 'Curly apostrophe in the stored name; a straight apostrophe matches.',
      syt: LATER,
      membership: LATER,
    },
    {
      group: 'Last name matching',
      id: '400000002',
      lastName: "D'Angelo",
      sendAs: ['DANGELO'],
      useCase: 'Apostrophe after a single letter.',
      syt: LATER,
      membership: LATER,
    },
    {
      group: 'Last name matching',
      id: '223456789',
      lastName: 'Peña',
      sendAs: ['PENA'],
      useCase: 'Accent: SYT ended, membership current.',
      syt: ENDED,
      membership: LATER,
    },
    {
      group: 'Last name matching',
      id: '400000003',
      lastName: 'Nguyễn',
      sendAs: ['Nguyen'],
      useCase: 'Two stacked diacritics on one letter.',
      syt: LATER,
      membership: LATER,
    },
    {
      group: 'Last name matching',
      id: '400000004',
      lastName: 'Müller-Lüdenscheidt',
      sendAs: ['mullerludenscheidt'],
      useCase: 'Umlauts and a hyphen together.',
      syt: LATER,
      membership: LATER,
    },
    {
      group: 'Last name matching',
      id: '323456789',
      lastName: 'Smith-Jones',
      sendAs: ['Smith Jones'],
      useCase: 'Hyphen; a space matches. Positions in two organizations.',
      syt: LATER,
      membership: LATER,
      positions: [
        ['4f1c2a90', 'committeeMember', LATER],
        ['district-77', 'unitCommissioner', EARLIER],
      ],
    },
    {
      group: 'Last name matching',
      id: '400000005',
      lastName: 'van der Berg',
      sendAs: ['VanDerBerg'],
      useCase: 'A name with spaces; the same name without spaces matches.',
      syt: LATER,
      membership: LATER,
    },
    {
      group: 'Last name matching',
      id: '400000006',
      lastName: 'Martin',
      sendAs: ['Martin Jr.', 'Martin, Jr'],
      useCase: 'The caller adds a suffix (Jr) that the source does not store.',
      syt: LATER,
      membership: LATER,
    },
    {
      group: 'Last name matching',
      id: '400000007',
      lastName: 'King III',
      sendAs: ['King'],
      useCase: 'The source stores a suffix (III) that the caller leaves out.',
      syt: LATER,
      membership: LATER,
    },
    {
      group: 'Last name matching',
      id: '400000008',
      lastName: 'St. James',
      sendAs: ['st james'],
      useCase: 'A period and a space.',
      syt: LATER,
      membership: LATER,
    },
    {
      group: 'Last name matching',
      id: '400000009',
      lastName: 'Ng',
      sendAs: ['NG'],
      useCase: 'A short name of two letters.',
      syt: LATER,
      membership: LATER,
    },
    {
      group: 'Last name matching',
      id: '400000010',
      lastName: 'II',
      sendAs: ['ii'],
      useCase: 'A whole name that looks like a suffix; the API does not remove it.',
      syt: LATER,
      membership: LATER,
    },
    {
      group: 'Last name matching',
      id: '400000011',
      lastName: 'Wolfeschlegelsteinhausenbergerdorff',
      useCase: 'A long name.',
      syt: LATER,
      membership: LATER,
    },
    {
      group: 'Last name matching',
      id: '400000012',
      lastName: 'Smith',
      useCase: 'A common name. Adult 400000013 has the same name and a different answer.',
      syt: LATER,
      membership: LATER,
    },
    {
      group: 'Last name matching',
      id: '400000013',
      lastName: 'Smith',
      useCase: 'The same name as 400000012; the member ID decides the answer.',
      syt: ENDED,
      membership: LATER,
    },

    // Status combinations and expiry.
    {
      group: 'Status and expiry',
      id: '410000001',
      lastName: 'Rivera',
      useCase: 'SYT current, membership ended.',
      syt: LATER,
      membership: ENDED,
    },
    {
      group: 'Status and expiry',
      id: '410000002',
      lastName: 'Okafor',
      useCase: 'Membership current, no SYT record (never trained).',
      membership: LATER,
    },
    {
      group: 'Status and expiry',
      id: '410000003',
      lastName: 'Lindqvist',
      useCase: 'SYT current, no membership record.',
      syt: LATER,
    },
    {
      group: 'Status and expiry',
      id: '410000004',
      lastName: 'Haddad',
      useCase: 'SYT and membership both ended.',
      syt: ENDED,
      membership: ENDED,
    },
    {
      group: 'Status and expiry',
      id: '410000005',
      lastName: 'Tanaka',
      useCase: 'SYT ends 1 hour after you seed. Use it to test the end of a term.',
      syt: soon,
      membership: LATER,
    },
    {
      group: 'Status and expiry',
      id: '410000006',
      lastName: 'Kowalski',
      useCase: 'SYT ended 1 hour before you seed.',
      syt: justEnded,
      membership: LATER,
    },
    {
      group: 'Status and expiry',
      id: '410000007',
      lastName: 'Abernathy',
      useCase: 'Membership ends 30 days after you seed.',
      syt: LATER,
      membership: inThirtyDays,
    },

    // Positions.
    {
      group: 'Positions',
      id: '420000001',
      lastName: 'Fitzgerald',
      useCase: 'Three positions in one unit; one term ended, so the answer lists two.',
      syt: LATER,
      membership: LATER,
      positions: [
        ['unit-1001', 'unitLeader', LATER],
        ['unit-1001', 'committeeMember', EARLIER],
        ['unit-1001', 'charteredOrganizationRepresentative', ENDED],
      ],
    },
    {
      group: 'Positions',
      id: '420000002',
      lastName: 'Achebe',
      useCase: 'Positions in a unit, a district, and a council. Each organization needs its own check.',
      syt: LATER,
      membership: LATER,
      positions: [
        ['unit-1002', 'assistantUnitLeader', LATER],
        ['district-12', 'unitCommissioner', LATER],
        ['council-500', 'committeeMember', EARLIER],
      ],
    },
    {
      group: 'Positions',
      id: '420000003',
      lastName: 'Moreau',
      useCase: 'All position terms in the unit ended.',
      syt: LATER,
      membership: LATER,
      positions: [
        ['unit-1001', 'unitLeader', ENDED],
        ['unit-1001', 'committeeMember', ENDED],
      ],
    },
    {
      group: 'Positions',
      id: '420000004',
      lastName: 'Castillo',
      useCase: 'A position, but no SYT or membership record. Each check reads only its own table.',
      positions: [['unit-1002', 'committeeMember', LATER]],
    },
    {
      group: 'Positions',
      id: '420000005',
      lastName: 'Petrov',
      useCase: 'A district position that ends 1 hour after you seed.',
      syt: LATER,
      membership: LATER,
      positions: [['district-12', 'districtCommissioner', soon]],
    },

    // Member ID formats.
    {
      group: 'Member ID formats',
      id: '000000123',
      lastName: 'Leadingzero',
      useCase: 'Leading zeros are part of the ID: 123 and 00000123 are different IDs.',
      syt: LATER,
      membership: LATER,
    },
    {
      group: 'Member ID formats',
      id: '999999999999',
      lastName: 'Maxlength',
      useCase: 'The longest member ID that the API accepts (12 digits).',
      syt: LATER,
      membership: LATER,
    },
    {
      group: 'Member ID formats',
      id: '7',
      lastName: 'Short',
      useCase: 'The shortest member ID that the API accepts (1 digit).',
      syt: LATER,
      membership: LATER,
    },
  ];
}

/** Organizations that the samples use. A check about any other organization answers notCurrent. */
export const SAMPLE_ORGANIZATIONS = [
  'test-org-1',
  '4f1c2a90',
  'district-77',
  'unit-1001',
  'unit-1002',
  'district-12',
  'council-500',
];
