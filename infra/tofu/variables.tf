variable "cloudflare_account_id" {
  description = "Cloudflare account that hosts the Worker and D1 databases."
  type        = string
}

variable "environments" {
  description = "Deployed environments. Each gets its own isolated D1 database."
  type        = set(string)
  default     = ["staging", "production"]
}

variable "primary_location_hint" {
  description = "Region for the D1 primary (wnam, enam, weur, eeur, apac, oc)."
  type        = string
  default     = "enam"
}

variable "content_zone_id" {
  description = "Cloudflare zone that serves the step 1 content hostnames (the CDN)."
  type        = string
}

variable "content_hostnames" {
  description = "CDN hostname for the step 1 content bucket in each environment. Placeholders until the domain is known."
  type        = map(string)
  default = {
    staging    = "content-staging.example.scouting.org"
    production = "content.example.scouting.org"
  }

  validation {
    condition     = toset(keys(var.content_hostnames)) == var.environments
    error_message = "content_hostnames must have exactly one hostname for each environment in var.environments."
  }
}

variable "content_edge_ttl_seconds" {
  description = "How long the CDN keeps step 1 content before it asks R2 again. The publish job purges the cache for a new edition."
  type        = number
  default     = 86400
}
