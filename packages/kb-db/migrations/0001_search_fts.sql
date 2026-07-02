ALTER TABLE "knowledge_chunks" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce("body", ''))) STORED;--> statement-breakpoint
CREATE INDEX "knowledge_chunks_search_vector_idx" ON "knowledge_chunks" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunks_node_ordinal_uq" ON "knowledge_chunks" USING btree ("node_id","ordinal");
