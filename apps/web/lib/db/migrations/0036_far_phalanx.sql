CREATE TABLE "gateway_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"base_url" text NOT NULL,
	"api_key" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gateway_model_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_model_id" text NOT NULL,
	"provider_options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gateway_models" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"model_id" text NOT NULL,
	"gateway_account_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"description" text,
	"context_window" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gateway_models" ADD CONSTRAINT "gateway_models_gateway_account_id_gateway_accounts_id_fk" FOREIGN KEY ("gateway_account_id") REFERENCES "public"."gateway_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gateway_model_variants_base_model_idx" ON "gateway_model_variants" USING btree ("base_model_id");--> statement-breakpoint
CREATE INDEX "gateway_models_account_idx" ON "gateway_models" USING btree ("gateway_account_id");