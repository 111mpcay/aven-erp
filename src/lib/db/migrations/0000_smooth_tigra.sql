CREATE TYPE "public"."company_role" AS ENUM('owner', 'admin', 'accountant', 'encoder', 'viewer');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"base_currency" text DEFAULT 'PHP' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "company_members" (
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "company_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_members_company_id_user_id_pk" PRIMARY KEY("company_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "company_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text,
	"action_pin_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "companies_select_members" ON "companies" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("companies"."id" in (select company_id from company_members where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "companies_modify_admins" ON "companies" AS PERMISSIVE FOR ALL TO "authenticated" USING ("companies"."id" in (select company_id from company_members where user_id = (select auth.uid()) and role in ('owner','admin'))) WITH CHECK ("companies"."id" in (select company_id from company_members where user_id = (select auth.uid()) and role in ('owner','admin')));--> statement-breakpoint
CREATE POLICY "company_members_select_self" ON "company_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("company_members"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_select_self" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("profiles"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_update_self" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("profiles"."id" = (select auth.uid())) WITH CHECK ("profiles"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_insert_self" ON "profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("profiles"."id" = (select auth.uid()));