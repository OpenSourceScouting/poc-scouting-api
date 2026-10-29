terraform {
  required_version = ">= 1.10"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.28"
    }
  }

  # State lives in AWS S3 with native lockfiles (no DynamoDB table needed).
  # Supply bucket/key/region via: tofu init -backend-config=backend.hcl
  backend "s3" {
    use_lockfile = true
    encrypt      = true
  }
}

# Reads CLOUDFLARE_API_TOKEN from the environment. Token needs D1 Edit on the account.
provider "cloudflare" {}
