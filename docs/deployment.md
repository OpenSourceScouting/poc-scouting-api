# Deployment

This guide is for the team that operates the API. It tells you how to set up the staging and production
environments one time, and how each release deploys. To run the API on your computer, see the
[README](../README.md) instead.

## Before you begin

You need these items:

- A Cloudflare account, and permission to create API tokens in it.
- A domain (zone) in the same Cloudflare account. The step 1 content hostnames use this zone.
- An AWS account, and AWS credentials that can read and write an S3 bucket.
- OpenTofu 1.10 or later, installed on your computer.
- Administrator access to the GitHub repository.

## Set up the environments

Do these steps one time.

1. Create an S3 bucket for the OpenTofu state.
2. Copy the backend configuration example:

   ```sh
   cp infra/tofu/backend.hcl.example infra/tofu/backend.hcl
   ```

3. In `infra/tofu/backend.hcl`, set `bucket`, `key`, and `region` for your S3 bucket.
4. In Cloudflare, create an API token with these permissions:
   - Account: **D1 Edit**, **Workers Scripts Edit**, and **Workers R2 Storage Edit**
   - Zone, for the content zone: **Cache Rules Edit**

   TODO(verify): the Cloudflare permissions page does not name the permission for R2 custom domains, and
   the name **Cache Rules Edit** is not confirmed. If `tofu apply` fails with an authorization error, add the
   permission that the error names.

5. Copy the variables example:

   ```sh
   cp infra/tofu/terraform.tfvars.example infra/tofu/terraform.tfvars
   ```

6. In `infra/tofu/terraform.tfvars`, set `cloudflare_account_id` to your Cloudflare account ID, and
   `content_zone_id` to the ID of the content zone. To use real hostnames instead of the placeholders, also
   set `content_hostnames`.
7. Create the D1 databases, the R2 content buckets, their CDN hostnames, and the cache rule:

   ```sh
   cd infra/tofu
   export CLOUDFLARE_API_TOKEN=API_TOKEN
   tofu init -backend-config=backend.hcl
   tofu apply
   tofu output d1_database_ids
   tofu output content_urls
   ```

   Replace `API_TOKEN` with the token from step 4. The last two commands show the ID of each database and the
   content URL of each environment. For the content design, see
   [ADR 0013](adr/0013-r2-content-behind-the-cdn.md).

8. In `apps/api/wrangler.jsonc`, put each database ID in `database_id` under `env.staging` and
   `env.production`.
9. In the same file, set the identity provider values `OAUTH_ISSUER`, `OAUTH_AUDIENCE`, and `OAUTH_JWKS_URL` for
   each environment.
10. Set the name hash key for staging:

    ```sh
    npx wrangler secret put NAME_HASH_KEY --env staging
    ```

    The key must be the same key that the sync uses.

11. Set the name hash key for production:

    ```sh
    npx wrangler secret put NAME_HASH_KEY --env production
    ```

12. Optional: To export logs with OpenTelemetry, create an OTLP destination in the Cloudflare dashboard, in
    **Observability > Destinations**. Then add its name to `observability.logs.destinations` in
    `apps/api/wrangler.jsonc`. For the design, see [ADR 0008](adr/0008-opentelemetry.md).
13. In Cloudflare, add a WAF rate limiting rule for the API hostname. For the design, see
    [ADR 0009](adr/0009-rate-limiting-at-the-cdn.md).
14. In GitHub, create the environments `staging` and `production`.
15. Add required reviewers to the `production` environment.
16. In each environment, add the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## How a release deploys

When you merge a change to `main`, the workflow `.github/workflows/deploy.yml` deploys to staging. The workflow
does these steps:

1. It runs the tests.
2. It applies the D1 migrations to the remote database (`wrangler d1 migrations apply --remote`).
3. It runs `npm run deploy:staging`, which copies Swagger UI into the static assets and deploys the Worker.

To deploy to production, start the same workflow manually and select `production`.

## Host the sample frontend

The sample frontend (`apps/web`) builds to static files. You can host these files on Cloudflare Pages or as
Workers static assets. When you build the frontend, set `VITE_API_URL` to the URL of the API. The API allows
requests from any origin (CORS `*`, without credentials), so you do not need to change CORS.
