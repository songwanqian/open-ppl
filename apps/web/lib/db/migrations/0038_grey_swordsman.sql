CREATE TABLE "mcp_servers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"purpose" text NOT NULL,
	"url" text NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_prompts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"mode" text NOT NULL,
	"content" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "mode" text DEFAULT 'search' NOT NULL;--> statement-breakpoint
UPDATE "sessions" SET "mode" = 'computer' WHERE "sandbox_state" IS NOT NULL OR "repo_owner" IS NOT NULL OR "repo_name" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "mcp_servers_purpose_idx" ON "mcp_servers" USING btree ("purpose");--> statement-breakpoint
CREATE INDEX "mcp_servers_enabled_idx" ON "mcp_servers" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "system_prompts_mode_idx" ON "system_prompts" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "system_prompts_enabled_idx" ON "system_prompts" USING btree ("enabled");
