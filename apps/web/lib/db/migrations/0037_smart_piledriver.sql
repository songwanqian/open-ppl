ALTER TABLE "gateway_accounts" ADD COLUMN "model_filter" text;--> statement-breakpoint
ALTER TABLE "gateway_models" ADD COLUMN "remote_model_id" text;