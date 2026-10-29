# Tests for the step 1 content bucket and its CDN front end. They run offline with a mocked
# Cloudflare provider: `tofu test` from infra/tofu.

mock_provider "cloudflare" {}

variables {
  cloudflare_account_id = "0123456789abcdef0123456789abcdef"
  content_zone_id       = "fedcba9876543210fedcba9876543210"
}

run "creates_one_content_bucket_per_environment" {
  command = plan

  assert {
    condition     = toset([for b in cloudflare_r2_bucket.content : b.name]) == toset(["scouting-content-staging", "scouting-content-production"])
    error_message = "Expected one R2 content bucket for each environment."
  }
}

run "serves_each_bucket_only_through_its_cdn_hostname" {
  command = plan

  assert {
    condition     = cloudflare_r2_custom_domain.content["production"].domain == "content.example.scouting.org"
    error_message = "Production content must be served at content.example.scouting.org."
  }
  assert {
    condition     = cloudflare_r2_custom_domain.content["staging"].domain == "content-staging.example.scouting.org"
    error_message = "Staging content must be served at content-staging.example.scouting.org."
  }
  assert {
    condition     = alltrue([for d in cloudflare_r2_custom_domain.content : d.enabled && d.min_tls == "1.2" && d.zone_id == var.content_zone_id])
    error_message = "Each custom domain must be enabled, require TLS 1.2, and use the content zone."
  }
  assert {
    condition     = alltrue([for m in cloudflare_r2_managed_domain.content : m.enabled == false])
    error_message = "The public r2.dev URL must be disabled, so the CDN is the only way in."
  }
}

run "caches_content_at_the_edge_and_keeps_etags" {
  command = plan

  assert {
    condition     = cloudflare_ruleset.content_cache.phase == "http_request_cache_settings" && cloudflare_ruleset.content_cache.kind == "zone"
    error_message = "The cache rule must be a zone ruleset in the cache settings phase."
  }
  assert {
    condition     = strcontains(cloudflare_ruleset.content_cache.rules[0].expression, "content.example.scouting.org") && strcontains(cloudflare_ruleset.content_cache.rules[0].expression, "content-staging.example.scouting.org")
    error_message = "The cache rule must match every content hostname."
  }
  assert {
    condition     = cloudflare_ruleset.content_cache.rules[0].action_parameters.cache == true && cloudflare_ruleset.content_cache.rules[0].action_parameters.respect_strong_etags == true
    error_message = "Content must be cacheable and keep strong ETags, so clients get 304 Not Modified."
  }
  assert {
    condition     = cloudflare_ruleset.content_cache.rules[0].action_parameters.edge_ttl.mode == "override_origin" && cloudflare_ruleset.content_cache.rules[0].action_parameters.edge_ttl.default == 86400
    error_message = "The edge must cache content for one day."
  }
}

run "rejects_hostnames_that_do_not_match_the_environments" {
  command = plan

  variables {
    content_hostnames = { production = "content.example.scouting.org" }
  }

  expect_failures = [var.content_hostnames]
}
