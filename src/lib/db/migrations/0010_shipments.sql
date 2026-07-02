CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "order_fulfillment_status" DEFAULT 'pending' NOT NULL,
	"courier" text,
	"tracking_no" text,
	"cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'PHP' NOT NULL,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "shipments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipments_company_status_idx" ON "shipments" USING btree ("company_id","status");--> statement-breakpoint
CREATE POLICY "shipments_select_members" ON "shipments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("shipments"."company_id" in (select company_id from company_members where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "shipments_write_roles" ON "shipments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("shipments"."company_id" in (select company_id from company_members where user_id = (select auth.uid()) and role in ('owner','admin','accountant','encoder'))) WITH CHECK ("shipments"."company_id" in (select company_id from company_members where user_id = (select auth.uid()) and role in ('owner','admin','accountant','encoder')));