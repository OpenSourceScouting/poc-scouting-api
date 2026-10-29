# Step 1 content: public program content and the reference files that the API uses (for example the
# positionCode enum file). A batch job publishes the files to R2. Readers get them only through the
# Cloudflare CDN, at one hostname for each environment. See docs/architecture.md and ADR 0013.

resource "cloudflare_r2_bucket" "content" {
  for_each = var.environments

  account_id    = var.cloudflare_account_id
  name          = "scouting-content-${each.key}"
  location      = var.primary_location_hint
  storage_class = "Standard"
}

# A custom domain puts the bucket behind the Cloudflare CDN.
resource "cloudflare_r2_custom_domain" "content" {
  for_each = var.environments

  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.content[each.key].name
  domain      = var.content_hostnames[each.key]
  zone_id     = var.content_zone_id
  enabled     = true
  min_tls     = "1.2"
}

# Turn off the public r2.dev URL, so the CDN (with its caching and rate limiting) is the only way in.
resource "cloudflare_r2_managed_domain" "content" {
  for_each = var.environments

  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.content[each.key].name
  enabled     = false
}

# Cache all content at the edge, including JSON and Markdown, which Cloudflare does not cache by default.
# Strong ETags stay strong, so a client with the current version gets 304 Not Modified.
# Note: a zone has only one ruleset for this phase. Add other cache rules for the zone to this resource.
resource "cloudflare_ruleset" "content_cache" {
  zone_id     = var.content_zone_id
  name        = "Scouting content cache"
  description = "Cache step 1 content from R2 at the edge."
  kind        = "zone"
  phase       = "http_request_cache_settings"

  rules = [
    {
      ref         = "cache_step1_content"
      description = "Cache step 1 content and keep strong ETags"
      expression  = "(http.host in {${join(" ", [for h in values(var.content_hostnames) : "\"${h}\""])}})"
      action      = "set_cache_settings"
      enabled     = true
      action_parameters = {
        cache                = true
        respect_strong_etags = true
        edge_ttl = {
          mode    = "override_origin"
          default = var.content_edge_ttl_seconds
        }
        browser_ttl = {
          mode = "respect_origin"
        }
      }
    }
  ]
}
