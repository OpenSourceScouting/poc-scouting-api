resource "cloudflare_d1_database" "api" {
  for_each = var.environments

  account_id            = var.cloudflare_account_id
  name                  = "scouting-api-${each.key}"
  primary_location_hint = var.primary_location_hint

  read_replication = {
    mode = "auto"
  }

  # Replacing a D1 database deletes its data.
  lifecycle {
    prevent_destroy = true
  }
}
