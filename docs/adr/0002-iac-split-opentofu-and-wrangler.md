# 0002: Use OpenTofu for resources and Wrangler for code

**Status:** Accepted (2026-10-28)

## Decision

- **OpenTofu** (`infra/tofu`) owns the resources that last a long time and keep state. These are the D1
  databases, and later custom domains, DNS, and access policies. The state is in S3, with native lock files.
  The team selected OpenTofu instead of Terraform because of its open license. The configuration stays
  compatible with Terraform 1.10 and later.
- **Wrangler** (`apps/api/wrangler.jsonc`) owns the Worker code, the bindings, and the D1 migrations. CI
  deploys them.

## Why

The code changes many times each day. Wrangler gives it versioned and gradual deployments. The databases
change rarely, and nobody must replace one by accident (`prevent_destroy`). If one tool owned both, each code deployment must go through the infrastructure as code (IaC) state.

## Consequences

The D1 database IDs go in one direction only: from `tofu output` into `wrangler.jsonc`. A person does this step
manually. If the number of environments increases, automate this step.
