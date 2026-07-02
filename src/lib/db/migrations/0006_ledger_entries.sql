CREATE TYPE "public"."ledger_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."ledger_source_type" AS ENUM('order', 'expense', 'transfer', 'adjustment');--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"cash_account_id" uuid,
	"entry_date" date NOT NULL,
	"direction" "ledger_direction" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"source_type" "ledger_source_type" NOT NULL,
	"source_id" uuid,
	"category_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ledger_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_cash_account_id_cash_accounts_id_fk" FOREIGN KEY ("cash_account_id") REFERENCES "public"."cash_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_entries_company_date_idx" ON "ledger_entries" USING btree ("company_id","entry_date");--> statement-breakpoint
CREATE POLICY "ledger_entries_select_members" ON "ledger_entries" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("ledger_entries"."company_id" in (select company_id from company_members where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "ledger_entries_write_roles" ON "ledger_entries" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ledger_entries"."company_id" in (select company_id from company_members where user_id = (select auth.uid()) and role in ('owner','admin','accountant','encoder'))) WITH CHECK ("ledger_entries"."company_id" in (select company_id from company_members where user_id = (select auth.uid()) and role in ('owner','admin','accountant','encoder')));