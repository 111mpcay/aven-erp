CREATE TYPE "public"."cash_account_type" AS ENUM('bank', 'ewallet', 'cash');--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('income', 'cogs', 'expense');--> statement-breakpoint
CREATE TYPE "public"."expense_source" AS ENUM('manual', 'meta_ads', 'import', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('draft', 'approved');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"company_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"changes" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cash_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "cash_account_type" NOT NULL,
	"opening_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'PHP' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_accounts_company_name_uq" UNIQUE("company_id","name")
);
--> statement-breakpoint
ALTER TABLE "cash_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "category_kind" NOT NULL,
	"code" text,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_company_code_uq" UNIQUE("company_id","code")
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"expense_date" date NOT NULL,
	"category_id" uuid,
	"cash_account_id" uuid,
	"vendor" text,
	"description" text,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'PHP' NOT NULL,
	"fx_to_php" numeric(18, 6) DEFAULT '1' NOT NULL,
	"source" "expense_source" DEFAULT 'manual' NOT NULL,
	"source_ref" text,
	"receipt_path" text,
	"status" "expense_status" DEFAULT 'approved' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_accounts" ADD CONSTRAINT "cash_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_cash_account_id_cash_accounts_id_fk" FOREIGN KEY ("cash_account_id") REFERENCES "public"."cash_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_company_idx" ON "audit_log" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "cash_accounts_company_idx" ON "cash_accounts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "categories_company_idx" ON "categories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "expenses_company_date_idx" ON "expenses" USING btree ("company_id","expense_date");--> statement-breakpoint
CREATE INDEX "expenses_company_category_idx" ON "expenses" USING btree ("company_id","category_id");--> statement-breakpoint
CREATE POLICY "audit_log_select_admins" ON "audit_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("audit_log"."company_id" in (select company_id from company_members where user_id = (select auth.uid()) and role in ('owner','admin')));--> statement-breakpoint
CREATE POLICY "audit_log_insert_members" ON "audit_log" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("audit_log"."company_id" in (select company_id from company_members where user_id = (select auth.uid())) and "audit_log"."actor_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "cash_accounts_select_members" ON "cash_accounts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("cash_accounts"."company_id" in (select company_id from company_members where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "cash_accounts_write_roles" ON "cash_accounts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("cash_accounts"."company_id" in (select company_id from company_members where user_id = (select auth.uid()) and role in ('owner','admin','accountant','encoder'))) WITH CHECK ("cash_accounts"."company_id" in (select company_id from company_members where user_id = (select auth.uid()) and role in ('owner','admin','accountant','encoder')));--> statement-breakpoint
CREATE POLICY "categories_select_members" ON "categories" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("categories"."company_id" in (select company_id from company_members where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "categories_write_roles" ON "categories" AS PERMISSIVE FOR ALL TO "authenticated" USING ("categories"."company_id" in (select company_id from company_members where user_id = (select auth.uid()) and role in ('owner','admin','accountant','encoder'))) WITH CHECK ("categories"."company_id" in (select company_id from company_members where user_id = (select auth.uid()) and role in ('owner','admin','accountant','encoder')));--> statement-breakpoint
CREATE POLICY "expenses_select_members" ON "expenses" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("expenses"."company_id" in (select company_id from company_members where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "expenses_write_roles" ON "expenses" AS PERMISSIVE FOR ALL TO "authenticated" USING ("expenses"."company_id" in (select company_id from company_members where user_id = (select auth.uid()) and role in ('owner','admin','accountant','encoder'))) WITH CHECK ("expenses"."company_id" in (select company_id from company_members where user_id = (select auth.uid()) and role in ('owner','admin','accountant','encoder')));