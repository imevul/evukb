CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text DEFAULT '' NOT NULL,
	"hash" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor" jsonb NOT NULL,
	"action" text NOT NULL,
	"target" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text DEFAULT '' NOT NULL,
	"hash" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"nonce" "bytea" NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"corpus_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"file_path" text NOT NULL,
	"folder_path" text DEFAULT '' NOT NULL,
	"heading_path" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"body" text NOT NULL,
	"body_preview" text DEFAULT '' NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"embedding" vector(1536),
	"external_vector_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_corpora" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"embedding_provider_id" uuid,
	"embedding_model_id" text,
	"ranking_strategy_id" text DEFAULT 'hybrid_default_v1' NOT NULL,
	"file_count" integer DEFAULT 0 NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"total_bytes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"corpus_id" uuid NOT NULL,
	"from_node_id" uuid NOT NULL,
	"to_node_id" uuid,
	"link_kind" text NOT NULL,
	"raw" text NOT NULL,
	"target_path" text,
	"external_url" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"corpus_id" uuid NOT NULL,
	"parent_id" uuid,
	"path" text DEFAULT '' NOT NULL,
	"name" text NOT NULL,
	"node_type" text NOT NULL,
	"storage_rel_path" text,
	"source_type" text DEFAULT 'managed' NOT NULL,
	"source_ref" text,
	"content_hash" text,
	"mime_type" text,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"index_status" text DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"indexed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "api_keys_workspace_idx" ON "api_keys" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_uq" ON "api_keys" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "audit_log_workspace_created_idx" ON "audit_log" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_workspace_action_idx" ON "audit_log" USING btree ("workspace_id","action");--> statement-breakpoint
CREATE INDEX "mcp_tokens_workspace_idx" ON "mcp_tokens" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_tokens_hash_uq" ON "mcp_tokens" USING btree ("hash");--> statement-breakpoint
CREATE UNIQUE INDEX "secrets_workspace_name_uq" ON "secrets" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "secrets_workspace_idx" ON "secrets" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_workspace_corpus_idx" ON "knowledge_chunks" USING btree ("workspace_id","corpus_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_corpus_idx" ON "knowledge_chunks" USING btree ("corpus_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_node_idx" ON "knowledge_chunks" USING btree ("node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_corpora_workspace_name_uq" ON "knowledge_corpora" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "knowledge_corpora_workspace_idx" ON "knowledge_corpora" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "knowledge_links_workspace_corpus_idx" ON "knowledge_links" USING btree ("workspace_id","corpus_id");--> statement-breakpoint
CREATE INDEX "knowledge_links_corpus_idx" ON "knowledge_links" USING btree ("corpus_id");--> statement-breakpoint
CREATE INDEX "knowledge_links_from_idx" ON "knowledge_links" USING btree ("from_node_id");--> statement-breakpoint
CREATE INDEX "knowledge_links_to_idx" ON "knowledge_links" USING btree ("to_node_id");--> statement-breakpoint
CREATE INDEX "knowledge_nodes_workspace_corpus_idx" ON "knowledge_nodes" USING btree ("workspace_id","corpus_id");--> statement-breakpoint
CREATE INDEX "knowledge_nodes_corpus_idx" ON "knowledge_nodes" USING btree ("corpus_id");--> statement-breakpoint
CREATE INDEX "knowledge_nodes_parent_idx" ON "knowledge_nodes" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_nodes_corpus_path_uq" ON "knowledge_nodes" USING btree ("corpus_id","path","name") WHERE "knowledge_nodes"."node_type" = 'file';--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspace_members_workspace_idx" ON "workspace_members" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_uq" ON "workspaces" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "workspaces_name_idx" ON "workspaces" USING btree ("name");