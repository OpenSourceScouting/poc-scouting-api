# Scouting API

The Scouting API is a proof of concept of an API for Scouting America. It answers three questions about one
adult. This README is for developers who want to run the API on their computer, call it, or contribute to it.

> This project is not affiliated with or endorsed by Scouting America. All data in it is fictional.

## What the API does

Each check identifies one adult by two values: the member ID and the last name. The API has these checks:

| Check      | Endpoint                                                                      | Access                                        |
| ---------- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| YPT status | `POST /v1/adults/{scoutingMemberId}/ypt`                                      | Open                                          |
| Membership | `POST /v1/adults/{scoutingMemberId}/membership`                               | Open                                          |
| Positions  | `POST /v1/adults/{scoutingMemberId}/organizations/{organizationId}/positions` | Sign-in token with the `positions:read` scope |

YPT means Youth Protection Training. Each check sends the last name in a JSON body, for example
`{"lastName": "O'Brien"}`. The API never puts personal data in a URL.

The API answers only about adults. Each valid request gets the status code `200` and an answer in the same
format. For the reasons, see the uniform answer rule in [ADR 0006](docs/adr/0006-adult-check-contract.md).

## Before you begin

Install these tools:

- Node.js 24. The file `.nvmrc` sets this version.
- npm, which Node.js includes.

You do not need a Cloudflare account. The command `wrangler dev` runs the Workers runtime (`workerd`) and a
local D1 database on your computer.

## Run the API on your computer

1. Select the Node.js version:

   ```sh
   nvm use
   ```

2. Install the dependencies, create the local secrets and database, and generate the contract and client:

   ```sh
   npm run setup
   ```

3. Start the API:

   ```sh
   npm run dev
   ```

   The API is available at `http://localhost:8787`.

4. Optional: In a second terminal, start the sample frontend:

   ```sh
   npm run dev:web
   ```

   The sample frontend is available at `http://localhost:5173`.

5. To make sure that the API works, send a check for a reserved test identity:

   ```sh
   curl -X POST localhost:8787/v1/adults/000000001/ypt \
     -H 'Content-Type: application/json' \
     -d '{"lastName":"Testcurrent"}'
   ```

   The answer contains `"status":"current"`.

The positions check needs a sign-in token. To send a positions check, run this command:

```sh
curl -X POST localhost:8787/v1/adults/000000001/organizations/test-org-1/positions \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $(npm run -s dev:token -w @scouting/api)" \
  -d '{"lastName":"Testcurrent"}'
```

For the test identities and their answers, see [Reserved test identities](docs/reserved-test-identities.md). For
more fictional adults, one for each use case, see [Sample data](docs/sample-data.md).

## Local URLs

When the API runs on your computer, these URLs are available:

| URL                                  | Content                                                                |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `http://localhost:8787/docs`         | Interactive API reference (Swagger UI). You can send requests from it. |
| `http://localhost:8787/openapi.json` | The OpenAPI 3.1 document                                               |
| `http://localhost:5173`              | The sample frontend, which uses the generated client                   |

## Repository layout

The repository has these main folders:

```text
apps/api/                 The Cloudflare Worker (Hono and @hono/zod-openapi)
  src/platform/           The shared contract: check rules, sign-in, telemetry, errors, OpenAPI parts
  src/modules/<check>/    One folder for each check: routes, data access, schemas, tests
  src/modules/index.ts    The list of registered modules
  migrations/             The D1 database schema
  scripts/                Local tools: secrets, sign-in tokens, seed data, OpenAPI export
apps/web/                 The sample frontend (Vite)
packages/api-client/      The TypeScript client, generated from the contract
openapi/openapi.json      The contract. A script generates this file. Do not edit it by hand.
infra/tofu/               OpenTofu configuration: D1 databases, R2 content buckets, CDN cache rule
docs/                     Architecture, guidelines, and architecture decision records (ADRs)
```

## Common commands

Run these commands from the repository root:

| Command                                   | Result                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `npm test`                                | Runs the API tests in `workerd` with a real D1 database, and the client tests          |
| `npm run generate`                        | Exports `openapi/openapi.json` and generates the client types again                    |
| `npm run lint`                            | Runs ESLint, Prettier, and the Redocly lint of the OpenAPI document                    |
| `npm run docs`                            | Builds the static API reference (Redocly) and code reference (TypeDoc) in `docs-site/` |
| `npm run ci`                              | Runs all CI checks                                                                     |
| `npm run db:reset -w @scouting/api`       | Deletes, migrates, and seeds the local database again                                  |
| `npm run dev:token -w @scouting/api`      | Prints a local sign-in token for the positions check                                   |
| `npm run db:verify-seed -w @scouting/api` | Checks each sample adult against the running API                                       |

## Next steps

- To learn how the code works and how it stores data, see [Architecture](docs/architecture.md).
- To learn the rules for all APIs in this repository, see [API guidelines](docs/api-guidelines.md).
- To compare hosting costs on Cloudflare and AWS, see [Cost model](docs/cost-model.md).
- To deploy the API, see [Deployment](docs/deployment.md).
- To contribute a change, see [Contributing](CONTRIBUTING.md).
