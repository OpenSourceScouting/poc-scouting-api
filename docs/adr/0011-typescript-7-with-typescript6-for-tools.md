# 0011: Use TypeScript 7 for the compiler and TypeScript 6 for the tools

**Status:** Proposed (2026-10-28). Supersedes ADR 0005.

## Facts (checked on 2026-10-28)

The table gives each fact, its source, and how the team verified it:

| Fact                                                                                                                                                                                                                 | Source                                                                                                                                                                       | Verification                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| TypeScript 7.0 "does not ship with an API". A new, different API is expected in 7.1. Tools that embed TypeScript "can only currently rely on TypeScript 6.0."                                                        | [TypeScript 7.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), 2026-07-08                                                              | The package root of `typescript@7.0.2` exports only `./lib/version.cjs`. The classic API is only in 6.x. |
| TypeScript 6.0 is "the last release based on the current JavaScript codebase" and "the bridge between TypeScript 5.9 and 7.0."                                                                                       | [TypeScript 6.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/), 2026-03-23                                                              | The text of the post                                                                                     |
| The setup that Microsoft recommends: `"typescript": "npm:@typescript/typescript6@^6.0.2"` for the tools, and `"@typescript/native": "npm:typescript@^7.0.2"` for `tsc`.                                              | TypeScript 7.0 announcement                                                                                                                                                  | `@typescript/typescript6` is on npm, published by the TypeScript maintainers                             |
| Typedoc 0.28.20 supports TypeScript `... 5.9.x \|\| 6.0.x`. Typescript-eslint 8.72.1 supports `>=4.8.4 <6.1.0`.                                                                                                      | npm `peerDependencies`                                                                                                                                                       | `npm view`                                                                                               |
| Openapi-typescript 7.13.0 (the latest version) declares `^5.x`, uses the classic API (`ts.factory`, `ts.createPrinter`), and fails on TypeScript 7. Support for TypeScript 6 and 7 is in open PRs, not in a release. | [#2841](https://github.com/openapi-ts/openapi-typescript/issues/2841), [#2723](https://github.com/openapi-ts/openapi-typescript/issues/2723), PRs #2818, #2862, #2867, #2872 | Read on GitHub, and the source code examined                                                             |

"Openapi-typescript supports TypeScript 7" is true only for its **generated types**: they work in a TypeScript
7 application. The **generator** must run on a TypeScript 5 or 6 compiler (the workaround in PR #2862). Native
support is not released.

## Experiments in this repository

The team ran the experiments on temporary copies of the repository. The main tree did not change. The table
gives the results:

| Setup                                                          | `npm run ci` (lint, type check, 114 API tests and 10 client tests, build) | `npm run docs` | Generated client | API type check time |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------- | ---------------- | ------------------- |
| TypeScript 5.9 (current)                                       | Pass                                                                      | Pass           | Baseline         | About 1.05 s        |
| TypeScript 6.0.3                                               | Pass                                                                      | Pass           | Byte-identical   | About 1.05 s        |
| TypeScript 7.0.2 `tsc` and the `@typescript/typescript6` alias | Pass                                                                      | Pass           | Byte-identical   | About 0.29 s        |

In the TypeScript 7 setup, the team added a type error on purpose. Both `npm run typecheck` and the Vitest type
tests of the client failed. Thus the checks ran.

Both upgrades need one npm `overrides` entry, because the published peer range of openapi-typescript (`^5.x`)
is out of date for 6.0. Add this entry to `package.json`:

```json
"overrides": { "openapi-typescript": { "typescript": "$typescript" } }
```

## Decision (proposed)

Use the setup that Microsoft recommends. TypeScript 7 gives `tsc`, which type-checks the code. The package
name `typescript` is an alias for `@typescript/typescript6`, which typedoc, typescript-eslint, and
openapi-typescript use.

## Consequences

- Type checks are faster, and the code is checked by the compiler that the ecosystem moves to.
- Openapi-typescript runs on 6.0, outside its declared range. Its open TypeScript 6 PR (#2818) reports that
  `Readable` and `Writable` in `openapi-typescript-helpers` (which openapi-fetch uses) can remove method types
  in 6.0. The types of this API do not have this problem. If the problem occurs, the client type tests find it. When openapi-typescript
  releases support for 6 or 7, remove the override.
- When TypeScript 7.1 releases its new API, examine this decision again. The tools can then possibly stop using
  the 6.0 alias.
- If you do not want the override, a lower-risk option is TypeScript 6.0 only. It needs the same override and
  gives no speed increase.
