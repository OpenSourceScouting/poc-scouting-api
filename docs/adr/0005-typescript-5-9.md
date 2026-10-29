# 0005: Pin TypeScript 5.9

**Status:** Superseded by [ADR 0011](0011-typescript-7-with-typescript6-for-tools.md) (2026-10-28).

## Correction (fact check, 2026-10-28)

The original text had three errors:

1. It said that typedoc, typescript-eslint, and openapi-typescript all "declare peer ranges below 6.1". This is
   not correct. Typedoc (`... || 6.0.x`) and typescript-eslint (`>=4.8.4 <6.1.0`) already support TypeScript
   6.0. Only openapi-typescript (`^5.x`) does not. TypeScript 6.0 was available, and the pin had to be 6.0.
2. It said that the tools were late to support TypeScript 7. The real cause is a design change. TypeScript 7
   has no JavaScript compiler API: its package root exports only a version file. A tool that uses that API
   cannot use TypeScript 7 as its compiler until the tool changes.
3. It did not include the setup that Microsoft documents for this case: TypeScript 7 as the compiler, with
   `typescript` aliased to `@typescript/typescript6`. With this setup, the tools keep the 6.0 API.

The author read the peer ranges, but did not run the tools. The peer ranges did not show what works.

## Original text

TypeScript 7 (native compiler) is current on npm, but typedoc, typescript-eslint, and openapi-typescript
declare peer ranges below 6.1. We pin `~5.9` until those tools support 7, then upgrade in one PR.
