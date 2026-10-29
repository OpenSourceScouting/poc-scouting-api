# Cost model

This document gives example monthly costs to host the Scouting API on Cloudflare and on AWS. It is for the
people who select the hosting or plan the budget. Use it to compare the two platforms at different volumes of
checks, and to calculate the cost for your own volume.

This document does not include these costs:

- Domain names
- The sync from Scouting America systems
- GitHub
- AWS S3 for the OpenTofu state
- Support plans
- Staff time
- Taxes

The current design runs on Cloudflare (see [ADR 0001](adr/0001-hosting-cloudflare-workers-d1.md)).

## Summary

The table gives the example cost each month, in USD, for each volume of checks:

| Checks each month | Cloudflare Workers Paid | AWS (no free tier) |
| ----------------: | ----------------------: | -----------------: |
|                 0 |                   $5.00 |              $0.00 |
|           100,000 |                   $5.00 |              $0.24 |
|         1,000,000 |                   $5.00 |              $2.41 |
|         2,000,000 |                   $5.00 |              $4.82 |
|         5,000,000 |                   $5.00 |             $12.04 |
|        10,000,000 |                   $5.00 |             $24.08 |
|        50,000,000 |                  $36.40 |            $120.42 |
|       100,000,000 |                  $83.40 |            $240.83 |

These are the important results:

- **Below about 2.1 million checks each month, AWS costs less.** Cloudflare Workers Paid has a minimum charge
  of $5 each month. AWS has no minimum, and costs about $2.41 for each 1 million checks.
- **Above about 2.1 million checks each month, Cloudflare costs less.** The $5 includes 10 million requests.
  At 100 million checks, Cloudflare costs about a third of the AWS cost.
- **On Cloudflare, logs are the largest cost at high volume.** At 100 million checks, logs are $48 of the $83.40.
- **On AWS, API Gateway and the rate limit counter are the largest costs.** They are $1.00 and $0.625 of each
  $2.41 for 1 million checks.

The Cloudflare Free plan costs $0, but it has daily limits. For the limits, see
[Cloudflare Free plan](#cloudflare-free-plan).

## Assumptions

Each check uses these resources. These values are estimates. Measure them with real traffic, and then
calculate the costs again.

| Resource for each check | Cloudflare                                  | AWS                                                           |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| Requests                | 1 Worker request                            | 1 API Gateway HTTP API request and 1 Lambda request           |
| Compute                 | 2 ms of CPU time                            | 256 MB of memory for 20 ms (0.005 GB-seconds)                 |
| Data reads              | 2 D1 rows (the status row and `sync_state`) | 2 DynamoDB reads, eventually consistent (1 read request unit) |
| Rate limit              | 1 call to the Workers rate limiting binding | 1 DynamoDB counter update (1 write request unit)              |
| Logs                    | 1 Workers Logs event                        | About 750 bytes in CloudWatch Logs                            |

These rules also apply:

- The checks are SYT, membership, and positions. The model gives them the same cost.
- The AWS column uses the list price without the AWS free tier. The free tier depends on the age and type of
  the AWS account. For details, see [AWS free tier](#aws-free-tier).
- AWS has no service that is equal to the Workers rate limiting binding. The AWS column uses a DynamoDB counter
  for the limit for each member ID. Without this counter, AWS costs about $1.78 for each 1 million checks.
- The AWS prices are for the region US East (N. Virginia).
- Storage is not in the summary. For typical data, it is less than $1 each month on both platforms. See
  [Storage and sync](#storage-and-sync).

## Prices

The prices are list prices in USD. The team read them from the official pricing pages on 2026-10-28.

### Cloudflare prices

The table gives the Cloudflare prices that the model uses:

| Item                       | Included in Workers Paid ($5 each month)         | Price above the included amount |
| -------------------------- | ------------------------------------------------ | ------------------------------- |
| Workers requests           | 10 million each month                            | $0.30 for each 1 million        |
| Workers CPU time           | 30 million ms each month                         | $0.02 for each 1 million ms     |
| D1 rows read               | 25 billion each month                            | $0.001 for each 1 million rows  |
| D1 rows written            | 50 million each month                            | $1.00 for each 1 million rows   |
| D1 storage                 | 5 GB                                             | $0.75 for each GB each month    |
| Workers Logs               | 20 million events each month                     | $0.60 for each 1 million events |
| Static assets (Swagger UI) | No limit                                         | Free                            |
| WAF rate limiting rules    | 1 rule on the Free plan, 2 on Pro, 5 on Business | Included in the plan            |

> **Caution:** From December 1, 2026, Workers Logs uses the Cloudflare Observability pricing. The model uses
> the Workers Logs prices in the table. TODO(verify): calculate the logs cost again with the new prices.

TODO(verify): the Workers rate limiting binding page does not give a price. The model uses $0 for the binding.

### AWS prices

The table gives the AWS prices that the model uses. The rate tables on the AWS pages did not load. Thus most
values come from the worked examples on those pages. Confirm them in the AWS Pricing Calculator before you use
them in a budget.

| Item                          | Price                                         | Source on the AWS page |
| ----------------------------- | --------------------------------------------- | ---------------------- |
| API Gateway HTTP API requests | $1.00 for each 1 million (first 300 million)  | Worked example         |
| Lambda requests               | $0.20 for each 1 million                      | Worked example         |
| Lambda compute (x86)          | $0.0000166667 for each GB-second              | Worked example         |
| DynamoDB on-demand reads      | $0.125 for each 1 million read request units  | Worked example         |
| DynamoDB on-demand writes     | $0.625 for each 1 million write request units | Worked example         |
| DynamoDB storage (Standard)   | $0.25 for each GB each month                  | Worked example         |
| CloudWatch Logs ingestion     | $0.50 for each GB                             | Worked example         |

## How to calculate a cost

Use these formulas. `M` is the number of checks each month, in millions.

Cloudflare Workers Paid:

```text
cost = 5.00
     + 0.30  * max(0, M - 10)        # requests above 10 million
     + 0.02  * max(0, 2 * M - 30)    # CPU: 2 ms for each check, 30 million ms included
     + 0.001 * max(0, 2 * M - 25000) # D1: 2 rows for each check, 25 billion rows included
     + 0.60  * max(0, M - 20)        # logs above 20 million events
```

AWS, without the free tier:

```text
cost = 1.00  * M    # API Gateway
     + 0.20  * M    # Lambda requests
     + 0.083 * M    # Lambda compute: 1 million * 0.005 GB-seconds * $0.0000166667
     + 0.125 * M    # DynamoDB reads: 1 read request unit for each check
     + 0.625 * M    # DynamoDB writes: 1 write request unit for each check (rate limit)
     + 0.375 * M    # CloudWatch Logs: 0.75 GB for each 1 million checks * $0.50
```

For example, for 50 million checks each month:

- Cloudflare: $5.00 + $12.00 (requests) + $1.40 (CPU) + $18.00 (logs) = $36.40.
- AWS: $2.41 for each 1 million checks, multiplied by 50, gives $120.42.

## Cloudflare Free plan

The Cloudflare Free plan costs $0. It has these limits:

- 100,000 Worker requests each day.
- 10 ms of CPU time for each request.
- 5 million D1 rows read and 100,000 D1 rows written each day.
- 200,000 Workers Logs events each day.

At 2 D1 rows for each check, the request limit applies first: about 100,000 checks each day. Since 2026-09-01,
D1 rejects queries on the Free plan above the daily limits until midnight UTC. Thus production must use
Workers Paid (see [ADR 0001](adr/0001-hosting-cloudflare-workers-d1.md)).

## AWS free tier

The AWS pages give these free tier amounts:

- Lambda: 1 million requests and 400,000 GB-seconds each month.
- API Gateway HTTP API: 1 million calls each month, for the first 12 months, for new customers only.
- CloudWatch Logs: 5 GB each month.

With these amounts, 1 million checks each month cost about $0.75 on AWS: only the DynamoDB reads and writes.
New AWS customers since July 15, 2025, get free tier credits of up to $200. TODO(verify): confirm the free tier
of your AWS account before you use these amounts.

## Step 1 content in R2

The step 1 files are in an R2 bucket behind the Cloudflare CDN (see
[ADR 0013](adr/0013-r2-content-behind-the-cdn.md)). The table gives the R2 Standard prices from the
[R2 pricing page](https://developers.cloudflare.com/r2/pricing/) on 2026-10-28:

| Item                                     | Free each month | Price above the free amount |
| ---------------------------------------- | --------------- | --------------------------- |
| Storage                                  | 10 GB-month     | $0.015 for each GB-month    |
| Class A operations (for example, upload) | 1 million       | $4.50 for each 1 million    |
| Class B operations (for example, read)   | 10 million      | $0.36 for each 1 million    |
| Egress                                   | No limit        | Free                        |

For typical step 1 content, the cost is $0 each month:

- The files use much less than 10 GB.
- Each published edition uploads far fewer than 1 million files.
- The CDN keeps each file for one day, so most reads do not go to R2.

TODO(verify): the R2 pricing page does not say if a read from the CDN cache counts as a Class B operation. The
model assumes that only cache misses count.

The AWS column does not include an equivalent for the step 1 content (for example, S3 and CloudFront).
TODO(verify): add S3 and CloudFront prices if you compare this part.

## Storage and sync

The checks only read data. The sync writes the data, and the cost depends on the design of the sync, which is
not built. The table gives the price of each write and of storage:

| Item             | Cloudflare D1                                      | AWS DynamoDB on-demand                      |
| ---------------- | -------------------------------------------------- | ------------------------------------------- |
| 1 million writes | $0 for the first 50 million each month, then $1.00 | $0.625 (1 write request unit for each item) |
| Storage          | $0 for the first 5 GB, then $0.75 for each GB      | $0.25 for each GB                           |

Each record is less than 200 bytes. Thus 1 million adults in three tables use less than 1 GB of storage.

A sync that writes all records each day costs more than a sync that writes only changes. For example, a full
daily sync of 1 million adults in three tables writes about 90 million rows each month. On D1, this costs
about $40 each month. On DynamoDB, it costs about $56 each month.

## Update this model

Do these steps when the prices or the traffic change:

1. Read the prices again on the official pricing pages in [Sources](#sources).
2. Measure the CPU time, the D1 rows read, and the log size for each check, from the Workers Logs.
3. Change the values in [Assumptions](#assumptions) and [Prices](#prices).
4. Calculate the costs again with the formulas in [How to calculate a cost](#how-to-calculate-a-cost).
5. Change the summary table and the date in [Prices](#prices).

## Sources

- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 free tier enforcement](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare WAF rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Workers rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [AWS API Gateway pricing](https://aws.amazon.com/api-gateway/pricing/)
- [AWS Lambda pricing](https://aws.amazon.com/lambda/pricing/)
- [Amazon DynamoDB on-demand pricing](https://aws.amazon.com/dynamodb/pricing/on-demand/)
- [Amazon CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/)
