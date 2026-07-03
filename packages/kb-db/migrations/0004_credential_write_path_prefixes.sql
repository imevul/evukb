ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "write_path_prefixes" jsonb;
ALTER TABLE "mcp_tokens" ADD COLUMN IF NOT EXISTS "write_path_prefixes" jsonb;
