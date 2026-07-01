CREATE TYPE "public"."order_fulfillment_status" AS ENUM('pending', 'packed', 'shipped', 'in_transit', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('draft', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'partial', 'paid');--> statement-breakpoint
CREATE TYPE "public"."sales_channel" AS ENUM('shopee', 'lazada', 'tiktok', 'facebook', 'website', 'walk_in', 'other');--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"sku" text,
	"qty" numeric(12, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"unit_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(14, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"order_no" text NOT NULL,
	"customer_name" text,
	"channel" "sales_channel" DEFAULT 'other' NOT NULL,
	"order_date" date NOT NULL,
	"status" "order_status" DEFAULT 'confirmed' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"cash_account_id" uuid,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"shipping_fee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'PHP' NOT NULL,
	"fx_to_php" numeric(18, 6) DEFAULT '1' NOT NULL,
	"notes" text,
	"fulfillment_status" "order_fulfillment_status",
	"courier" text,
	"tracking_no" text,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_company_order_no_uq" UNIQUE("company_id","order_no")
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cash_account_id_cash_accounts_id_fk" FOREIGN KEY ("cash_account_id") REFERENCES "public"."cash_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_company_date_idx" ON "orders" USING btree ("company_id","order_date");--> statement-breakpoint
CREATE INDEX "orders_company_payment_idx" ON "orders" USING btree ("company_id","payment_status");--> statement-breakpoint
CREATE POLICY "order_items_select_members" ON "order_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from orders o join company_members m on m.company_id = o.company_id where o.id = "order_items"."order_id" and m.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "order_items_write_roles" ON "order_items" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from orders o join company_members m on m.company_id = o.company_id where o.id = "order_items"."order_id" and m.user_id = (select auth.uid()) and m.role in ('owner','admin','accountant','encoder'))) WITH CHECK (exists (select 1 from orders o join company_members m on m.company_id = o.company_id where o.id = "order_items"."order_id" and m.user_id = (select auth.uid()) and m.role in ('owner','admin','accountant','encoder')));--> statement-breakpoint
CREATE POLICY "orders_select_members" ON "orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("orders"."company_id" in (select company_id from company_members where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "orders_write_roles" ON "orders" AS PERMISSIVE FOR ALL TO "authenticated" USING ("orders"."company_id" in (select company_id from company_members where user_id = (select auth.uid()) and role in ('owner','admin','accountant','encoder'))) WITH CHECK ("orders"."company_id" in (select company_id from company_members where user_id = (select auth.uid()) and role in ('owner','admin','accountant','encoder')));