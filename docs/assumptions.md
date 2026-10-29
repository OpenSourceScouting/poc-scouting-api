# Assumptions for open questions

This proof of concept (POC) uses assumptions where National IT has not yet answered a question. The questions
come from the draft API one-pager for National IT. Use this page to find each assumption and the one place in
the code to change it.

The table gives each open question, the assumption, and the location:

| Open question               | Assumption in this POC                                                                                                                                            | Location                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Member ID format and length | Digits only, 1 to 12 digits, sent as a string                                                                                                                     | `ScoutingMemberIdParam` in `src/platform/adult-check.ts` |
| Check digit on member IDs   | None. If member IDs have a check digit, the API can reject most typing errors with a `400`. This does not leak data, because the format is public.                | `ScoutingMemberIdParam`                                  |
| Organization identifier     | One opaque ID for units, districts, and councils: 1 to 64 letters, digits, and hyphens                                                                            | `OrganizationIdParam`, in the same file                  |
| Position codes              | Placeholder codes in camelCase (for example, `unitLeader` and `committeeMember`), in the seed data only. The contract documents `positionCode` as an open string. | `src/modules/positions/schemas.ts`                       |
| Last name field             | The field that the sync supplies. The platform sees only its keyed hash (HMAC).                                                                                   | The sync (not built)                                     |
| Expiry time zone            | The sync changes source dates to UTC times before it loads them. The API does not change time zones.                                                              | The sync (not built)                                     |
| Data freshness              | `asOf` is one value for the full dataset, in the table `sync_state`                                                                                               | `migrations/0001_platform_sync_state.sql`                |
| Sign-in                     | A JSON Web Token (JWT) with the `positions:read` scope. The identity provider gives this scope only to registered adults.                                         | ADR 0007                                                 |
| Hosting platform for Walk   | Cloudflare Workers and D1, as in the proof of concept. National IT can select a different platform.                                                               | ADR 0001, `TODO.md`                                      |
| Opt-out                     | The tables do not contain an adult who opts out, so the answers are `notCurrent`                                                                                  | The sync (not built)                                     |

## Work that is not in this repository

The sync from Scouting America systems is not in this repository. The sync must:

- Normalize last names with the same rules as `normalizeLastName`.
- Hash last names with the same key (`NAME_HASH_KEY`).
- Load the reserved test identities.
