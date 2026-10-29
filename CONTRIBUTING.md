# Contributing

This guide is for developers from any team who want to change this repository. It gives the rules for a
change and the steps to add a check. This repository uses InnerSource: any team can contribute, and the trusted
committers in `.github/CODEOWNERS` review and merge the changes.

Before you write code for a change that is larger than a bug fix, open an issue. The team can then agree on the
contract before you start.

## Rules for every change

1. **Write the test first.** Write one failing test and make sure that it fails. Then write the minimum code
   that makes it pass. Do this for one behavior at a time. A pull request (PR) must include tests that fail
   without the change.
2. **Follow the [API guidelines](docs/api-guidelines.md).** Do not put personally identifiable information (PII)
   in URLs or logs. Send inputs as JSON bodies in `POST` requests. Do not use query parameters.
3. **Only add to a contract.** In `/v1`, you can add operations, optional request fields, and response fields.
   Do not remove or rename an item, make an optional field required, or remove a value from an enum. The CI job
   `oasdiff` stops changes that break the contract. A breaking change needs a new major version (`/v2`) and an
   architecture decision record (ADR).
4. **Put each feature in its own module.** A feature is in `apps/api/src/modules/FEATURE/` and imports only from
   `src/platform/`. ESLint stops imports from one module to a different module.
5. **Only add to the database schema.** The code and the schema deploy at different times. A migration must
   work with the code that is deployed: add tables or columns, but do not delete or rename them in the same
   release.
6. **Use Conventional Commits with a body.** The team squash merges each pull request. The pull request title
   becomes the commit header, and the pull request body becomes the commit body. Thus:
   - Write the pull request title as a Conventional Commits header, for example
     `fix(auth): require exp on sign-in tokens`.
   - Write the pull request body as the reason for the change. Replace the template text. Do not add a
     checklist or other text that you do not want in the history.

   The CI job `commit-messages` checks the title and the body (see `commitlint.config.js`), and runs again when
   you edit them. The local `commit-msg` hook applies the same rules to your branch commits. `npm install`
   installs the hook.

## Before you open a pull request

Make sure that these items are true:

- You wrote the tests first and saw them fail.
- You ran `npm run generate` and committed `openapi/openapi.json` and the client types.
- A contract change only adds to the contract, or it uses a new major version.
- Each D1 migration only adds to the schema.
- The feature code is in its own module in `src/modules/` and imports only from `platform/`.
- `npm run ci` passes.

## Where to put tests

Tests are only at three agreed boundaries (seams). A seam is the public interface that a test uses:

| Seam             | How the test works                                                                                        | What it finds                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| HTTP API         | `api()` from `apps/api/test/http.ts` sends requests to the full app in `workerd`, with a real D1 database | Errors in routing, validation, SQL, and headers                     |
| OpenAPI contract | `apps/api/test/contract.test.ts`, and the CI job `oasdiff`                                                | Differences between the code and the contract, and breaking changes |
| Generated client | `packages/api-client/src/client.test.ts`, which Vitest also type-checks                                   | A client that does not agree with the contract                      |

A test can add rows to the D1 database to set up a case. Make all assertions through HTTP. Do not test the
internal parts of a repository.

## Add a check module

1. Create the folder `apps/api/src/modules/CHECK/` with the files `repository.ts`, `routes.ts`, `index.ts`, and
   `CHECK.test.ts`. Replace `CHECK` with the name of the check, for example `syt`. For the smallest example, see
   `syt/`. For a signed-in check that returns a list, see `positions/`.
2. Add a fixture function for the new table in `apps/api/test/fixtures.ts`, for example `givenSyt`.
3. Write the test first. An open check that reads one record needs only this test:

   ```ts
   describeOpenAdultCheck({ path: (id) => `/v1/adults/${id}/CHECK`, given: GIVEN_FUNCTION });
   ```

   Replace `CHECK` with the name of the check, and `GIVEN_FUNCTION` with the fixture function from step 2.

4. Run the tests and make sure that the new test fails:

   ```sh
   npm test -w @scouting/api
   ```

5. Add a migration `apps/api/migrations/NUMBER_CHECK.sql`. Replace `NUMBER` with the next four-digit number. The
   table must contain only the fields that the check returns. Store the last name only as `last_name_hash`. Do
   not store records about youth.
6. Write the route with the platform parts:
   - `method: 'post'`
   - `ScoutingMemberIdParam` for the path
   - `body: checkBody(CheckRequestSchema)`
   - `checkResponses()`, with examples of a `current` answer and a `notCurrent` answer
   - `evaluate()` to apply the uniform answer rule
   - `respond()`, with the last name from the request
   - `requireSignIn()`, only if the check needs a sign-in token

   Give each route an `operationId` that starts with `check`, and a tag.

7. Register the module in `apps/api/src/modules/index.ts`.
8. Add the `operationId` to `OPERATIONS` in `apps/api/test/contract.test.ts`.
9. Add sample adults for the new check in `apps/api/scripts/sample-adults.ts`. Then run
   `npm run db:reset -w @scouting/api` and `npm run db:verify-seed -w @scouting/api`.
10. Generate the contract and the client again:

    ```sh
    npm run generate
    ```

11. Run all checks and make sure that they pass:

    ```sh
    npm run ci
    ```

12. Commit `openapi/openapi.json` and `packages/api-client/src/schema.d.ts` with your change.

If a change does not follow the [API guidelines](docs/api-guidelines.md), the Redocly lint and the contract tests
fail the build.

## Optional: find breaking changes on your computer

CI finds breaking changes in each pull request. To find them before you push, install `oasdiff` and compare your
contract with the contract on `main`:

```sh
brew install oasdiff
git show main:openapi/openapi.json > /tmp/base.json
oasdiff breaking /tmp/base.json openapi/openapi.json
```
