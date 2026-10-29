output "d1_database_ids" {
  description = "Paste into apps/api/wrangler.jsonc env.<name>.d1_databases[0].database_id."
  value       = { for env, db in cloudflare_d1_database.api : env => db.id }
}

output "content_buckets" {
  description = "R2 bucket for step 1 content in each environment. The publish job uploads to these buckets."
  value       = { for env, b in cloudflare_r2_bucket.content : env => b.name }
}

output "content_urls" {
  description = "Public CDN URL for step 1 content in each environment."
  value       = { for env, d in cloudflare_r2_custom_domain.content : env => "https://${d.domain}" }
}
