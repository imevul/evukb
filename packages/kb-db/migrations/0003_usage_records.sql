CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"corpus_id" uuid,
	"node_id" uuid,
	"operation_type" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"character_count" integer,
	"chunk_count" integer,
	"request_count" integer DEFAULT 1 NOT NULL,
	"latency_ms" integer NOT NULL,
	"estimated_cost" numeric,
	"currency" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "usage_records_workspace_created_idx" ON "usage_records" USING btree ("workspace_id","created_at");
