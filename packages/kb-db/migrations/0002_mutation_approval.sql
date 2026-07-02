CREATE TABLE "mutation_approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"corpus_id" uuid NOT NULL,
	"status" text NOT NULL,
	"action" text NOT NULL,
	"request" jsonb NOT NULL,
	"actor" jsonb NOT NULL,
	"preview" jsonb NOT NULL,
	"decided_by" jsonb,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mutation_approval_workspace_status_created_idx" ON "mutation_approval_requests" USING btree ("workspace_id","status","created_at");
