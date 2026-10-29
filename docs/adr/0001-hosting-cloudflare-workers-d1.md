# 0001: Host on Cloudflare Workers and D1

**Status:** Accepted (2026-10-28)

## Context

The team needs hosting on AWS or Cloudflare with these properties:

- It has the lowest cost.
- It is reliable.
- It scales up with demand, and down to zero when there are no requests.

## Options

The table compares the two options:

|                       | Cloudflare Workers and D1                      | AWS Lambda, API Gateway (HTTP API), and DynamoDB                |
| --------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| Cost with no requests | $0                                             | $0, plus fixed extras such as custom domains or a WAF           |
| Cold start            | None in practice (V8 isolates)                 | 100 ms to more than 1 s for Node.js                             |
| Locations             | Runs in each Cloudflare location by default    | One region, unless you replicate it                             |
| Egress                | No egress charges                              | Charges for data transfer                                       |
| Local development     | `wrangler dev` runs the real `workerd` runtime | Emulation with SAM or LocalStack                                |
| Relational data       | D1 (SQLite)                                    | DynamoDB (key-value), or Aurora Serverless (has a minimum cost) |

### Cost model

These are the list prices in USD from the official pages on 2026-10-28. For example costs at different request
volumes, see [Cost model](../cost-model.md).

| Service              | Free                                                  | Paid or pay per use                                                                                                                                                |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Workers              | 100,000 requests each day, 10 ms CPU for each request | $5 each month minimum, with 10M requests and 30M CPU ms included. Then $0.30 for each 1M requests and $0.02 for each 1M CPU ms. No charges for duration or egress. |
| D1                   | 5M rows read and 100,000 rows written each day, 5 GB  | 25B rows read and 50M rows written each month included, and 5 GB. Then $0.001 for each 1M reads, $1.00 for each 1M writes, and $0.75 for each GB-month.            |
| Lambda (x86)         | 1M requests and 400,000 GB-seconds each month         | $0.20 for each 1M requests, $0.0000166667 for each GB-second                                                                                                       |
| API Gateway HTTP API | 1M calls each month, for the first 12 months only     | About $1.00 for each 1M (from the AWS worked example, not the rate table)                                                                                          |
| DynamoDB on-demand   | 25 GB storage                                         | About $0.625 for each 1M writes, $0.125 for each 1M reads, and $0.25 for each GB-month (from the AWS worked examples)                                              |

Since 2026-09-01, D1 rejects free-plan queries over the daily limits until midnight UTC. Thus production must
use Workers Paid. D1 counts the rows that a query _scans_, not the rows that it returns, so a missing index
costs money.

Sources: [Workers](https://developers.cloudflare.com/workers/platform/pricing/),
[D1](https://developers.cloudflare.com/d1/platform/pricing/),
[D1 free tier enforcement](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/),
[Lambda](https://aws.amazon.com/lambda/pricing/), [API Gateway](https://aws.amazon.com/api-gateway/pricing/),
[DynamoDB](https://aws.amazon.com/dynamodb/pricing/on-demand/). The values with "about" come from AWS worked
examples, because the rate tables did not load. Confirm these values in the AWS Pricing Calculator before you
use them.

## Decision

Use Cloudflare Workers and D1. This option has the lowest cost at low and moderate volume, has no cold starts,
and gives the best local development.

## Consequences

- D1 limits apply: a maximum size for each database, and one primary that accepts writes. These limits are
  acceptable for this domain. Examine the decision again if the write volume increases quickly.
- The design stays portable. Hono runs on Lambda without changes, and each module reads data through a
  repository interface. A move to AWS needs new repository implementations, not a rewrite.
- The design uses AWS for its strongest service here: S3 for the OpenTofu state.
