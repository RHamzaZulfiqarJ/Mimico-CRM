-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "organization_status" AS ENUM ('active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "membership_role" AS ENUM ('client', 'employee', 'manager', 'super_admin');

-- CreateEnum
CREATE TYPE "record_status" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "lead_priority" AS ENUM ('veryCold', 'cold', 'moderate', 'hot', 'veryHot');

-- CreateEnum
CREATE TYPE "lead_stage" AS ENUM ('newClient', 'followUp', 'contactedClient', 'callNotAttend', 'visitSchedule', 'visitDone', 'closedWon', 'closedLost');

-- CreateEnum
CREATE TYPE "inventory_status" AS ENUM ('sold', 'unsold', 'underProcess');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('todo', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "task_outcome" AS ENUM ('successful', 'unsuccessful');

-- CreateEnum
CREATE TYPE "approval_type" AS ENUM ('request', 'voucher', 'receipt', 'refund');

-- CreateEnum
CREATE TYPE "approval_status" AS ENUM ('underProcess', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "cash_direction" AS ENUM ('in', 'out');

-- CreateEnum
CREATE TYPE "facebook_lead_status" AS ENUM ('pending', 'accepted', 'expired', 'converted');

-- CreateEnum
CREATE TYPE "facebook_claim_status" AS ENUM ('pending', 'accepted', 'rejected', 'dismissed');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "organization_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "auth_user_id" UUID,
    "legacy_mongo_id" TEXT,
    "username" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "cnic" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "role" "membership_role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "portal_profile_id" UUID,
    "legacy_mongo_id" TEXT,
    "uid" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "display_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "city" TEXT,
    "cnic" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "societies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "uid" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "societies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "uid" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "status" "record_status" NOT NULL DEFAULT 'active',
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID,
    "owner_profile_id" UUID,
    "legacy_mongo_id" TEXT,
    "uid" TEXT,
    "seller_name" TEXT,
    "seller_phone" TEXT,
    "seller_email" TEXT,
    "seller_company_name" TEXT,
    "seller_city" TEXT,
    "property_street_number" TEXT,
    "property_number" TEXT,
    "price" DECIMAL(18,2),
    "remarks" TEXT,
    "status" "inventory_status" NOT NULL DEFAULT 'unsold',
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "client_id" UUID,
    "project_id" UUID,
    "created_by_profile_id" UUID,
    "legacy_mongo_id" TEXT,
    "uid" TEXT,
    "client_name" TEXT,
    "client_phone" TEXT,
    "area" TEXT,
    "city" TEXT,
    "priority" "lead_priority" NOT NULL DEFAULT 'moderate',
    "stage" "lead_stage" NOT NULL DEFAULT 'newClient',
    "source" TEXT,
    "description" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "refund_requested" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "assigned_by_profile_id" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "created_by_profile_id" UUID,
    "legacy_mongo_id" TEXT,
    "uid" TEXT,
    "stage" "lead_stage" NOT NULL,
    "follow_up_at" TIMESTAMPTZ(6),
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lead_id" UUID,
    "society_id" UUID,
    "created_by_profile_id" UUID,
    "legacy_path" TEXT,
    "bucket" TEXT NOT NULL,
    "object_path" TEXT NOT NULL,
    "original_name" TEXT,
    "content_type" TEXT,
    "size_bytes" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "assigned_to_profile_id" UUID NOT NULL,
    "created_by_profile_id" UUID,
    "legacy_mongo_id" TEXT,
    "uid" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_at" TIMESTAMPTZ(6),
    "status" "task_status" NOT NULL DEFAULT 'todo',
    "outcome" "task_outcome",
    "outcome_comment" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "legacy_payload" JSONB,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "owner_profile_id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "uid" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lead_id" UUID,
    "requested_by_profile_id" UUID,
    "decided_by_profile_id" UUID,
    "legacy_mongo_id" TEXT,
    "uid" TEXT,
    "title" TEXT,
    "description" TEXT NOT NULL,
    "due_at" TIMESTAMPTZ(6),
    "type" "approval_type" NOT NULL,
    "status" "approval_status" NOT NULL DEFAULT 'underProcess',
    "payload" JSONB,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "recipient_profile_id" UUID NOT NULL,
    "approval_id" UUID,
    "legacy_mongo_id" TEXT,
    "uid" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT NOT NULL,
    "payload" JSONB,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lead_id" UUID,
    "staff_profile_id" UUID,
    "legacy_mongo_id" TEXT,
    "uid" TEXT,
    "staff_name" TEXT,
    "client_name" TEXT,
    "payment_type" TEXT,
    "reference_number" TEXT,
    "net_price" DECIMAL(18,2),
    "received_amount" DECIMAL(18,2),
    "profit" DECIMAL(18,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashbook_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lead_id" UUID,
    "project_id" UUID,
    "staff_profile_id" UUID,
    "legacy_mongo_id" TEXT,
    "uid" TEXT,
    "direction" "cash_direction" NOT NULL,
    "branch" TEXT,
    "staff_name" TEXT,
    "client_name" TEXT,
    "remarks" TEXT,
    "payment_type" TEXT,
    "reference_number" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cashbook_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "allocated_to_profile_id" UUID,
    "project_id" UUID,
    "legacy_mongo_id" TEXT,
    "uid" TEXT,
    "issuing_date" DATE,
    "due_date" DATE,
    "branch" TEXT,
    "client_name" TEXT,
    "cnic" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "type" TEXT,
    "cheque" TEXT,
    "property_type" TEXT,
    "area" TEXT,
    "total" DECIMAL(18,2),
    "paid" DECIMAL(18,2),
    "remaining" DECIMAL(18,2),
    "note" TEXT,
    "status" "approval_status" NOT NULL DEFAULT 'underProcess',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lead_id" UUID,
    "requested_by_profile_id" UUID,
    "decided_by_profile_id" UUID,
    "legacy_mongo_id" TEXT,
    "legacy_notification_id" TEXT,
    "uid" TEXT,
    "branch" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "client_name" TEXT NOT NULL,
    "cnic" TEXT,
    "phone" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "approval_status" NOT NULL DEFAULT 'underProcess',
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_deduction_policies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "late_arrivals" INTEGER NOT NULL,
    "half_days" INTEGER NOT NULL,
    "days_off" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_deduction_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_transcripts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "profile_id" UUID,
    "legacy_mongo_id" TEXT,
    "uid" TEXT,
    "employee_name" TEXT NOT NULL,
    "designation" TEXT,
    "phone" TEXT,
    "pay_period_start" DATE NOT NULL,
    "salary_type" TEXT,
    "total_salary" DECIMAL(18,2),
    "late_arrivals" INTEGER,
    "half_days" INTEGER,
    "days_off" INTEGER,
    "amount_per_day_off" DECIMAL(18,2),
    "net_salary" DECIMAL(18,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facebook_integrations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "legacy_mongo_id" TEXT,
    "page_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "verify_token_secret_name" TEXT NOT NULL,
    "app_secret_name" TEXT NOT NULL,
    "page_access_token_secret_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "facebook_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facebook_inbound_leads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "accepted_by_profile_id" UUID,
    "converted_lead_id" UUID,
    "legacy_mongo_id" TEXT,
    "provider_lead_id" TEXT NOT NULL,
    "event_title" TEXT NOT NULL DEFAULT 'Facebook Lead',
    "field_data" JSONB NOT NULL,
    "raw_payload" JSONB,
    "status" "facebook_lead_status" NOT NULL DEFAULT 'pending',
    "provider_created_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "accepted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "facebook_inbound_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facebook_lead_claims" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "inbound_lead_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "status" "facebook_claim_status" NOT NULL DEFAULT 'pending',
    "responded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "facebook_lead_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_profile_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_auth_user_id_key" ON "profiles"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_legacy_mongo_id_key" ON "profiles"("legacy_mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE INDEX "profiles_phone_idx" ON "profiles"("phone");

-- CreateIndex
CREATE INDEX "organization_memberships_profile_id_is_active_idx" ON "organization_memberships"("profile_id", "is_active");

-- CreateIndex
CREATE INDEX "organization_memberships_organization_id_role_is_active_idx" ON "organization_memberships"("organization_id", "role", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_organization_id_profile_id_key" ON "organization_memberships"("organization_id", "profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_legacy_mongo_id_key" ON "clients"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "clients_organization_id_phone_idx" ON "clients"("organization_id", "phone");

-- CreateIndex
CREATE INDEX "clients_organization_id_email_idx" ON "clients"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_organization_id_uid_key" ON "clients"("organization_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "clients_organization_id_portal_profile_id_key" ON "clients"("organization_id", "portal_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "societies_legacy_mongo_id_key" ON "societies"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "societies_organization_id_status_is_archived_idx" ON "societies"("organization_id", "status", "is_archived");

-- CreateIndex
CREATE UNIQUE INDEX "societies_organization_id_uid_key" ON "societies"("organization_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "projects_legacy_mongo_id_key" ON "projects"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "projects_organization_id_society_id_status_is_archived_idx" ON "projects"("organization_id", "society_id", "status", "is_archived");

-- CreateIndex
CREATE INDEX "projects_organization_id_city_idx" ON "projects"("organization_id", "city");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organization_id_uid_key" ON "projects"("organization_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "inventories_legacy_mongo_id_key" ON "inventories"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "inventories_organization_id_project_id_status_is_archived_idx" ON "inventories"("organization_id", "project_id", "status", "is_archived");

-- CreateIndex
CREATE INDEX "inventories_organization_id_owner_profile_id_idx" ON "inventories"("organization_id", "owner_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventories_organization_id_uid_key" ON "inventories"("organization_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "leads_legacy_mongo_id_key" ON "leads"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "leads_organization_id_stage_priority_is_archived_idx" ON "leads"("organization_id", "stage", "priority", "is_archived");

-- CreateIndex
CREATE INDEX "leads_organization_id_client_id_idx" ON "leads"("organization_id", "client_id");

-- CreateIndex
CREATE INDEX "leads_organization_id_project_id_idx" ON "leads"("organization_id", "project_id");

-- CreateIndex
CREATE INDEX "leads_organization_id_client_phone_idx" ON "leads"("organization_id", "client_phone");

-- CreateIndex
CREATE UNIQUE INDEX "leads_organization_id_uid_key" ON "leads"("organization_id", "uid");

-- CreateIndex
CREATE INDEX "lead_assignments_organization_id_profile_id_idx" ON "lead_assignments"("organization_id", "profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_assignments_lead_id_profile_id_key" ON "lead_assignments"("lead_id", "profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "follow_ups_legacy_mongo_id_key" ON "follow_ups"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "follow_ups_organization_id_lead_id_follow_up_at_idx" ON "follow_ups"("organization_id", "lead_id", "follow_up_at");

-- CreateIndex
CREATE UNIQUE INDEX "follow_ups_organization_id_uid_key" ON "follow_ups"("organization_id", "uid");

-- CreateIndex
CREATE INDEX "attachments_organization_id_lead_id_idx" ON "attachments"("organization_id", "lead_id");

-- CreateIndex
CREATE INDEX "attachments_organization_id_society_id_idx" ON "attachments"("organization_id", "society_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_bucket_object_path_key" ON "attachments"("bucket", "object_path");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_legacy_mongo_id_key" ON "tasks"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "tasks_organization_id_assigned_to_profile_id_status_is_arch_idx" ON "tasks"("organization_id", "assigned_to_profile_id", "status", "is_archived");

-- CreateIndex
CREATE INDEX "tasks_organization_id_due_at_idx" ON "tasks"("organization_id", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_organization_id_uid_key" ON "tasks"("organization_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_legacy_mongo_id_key" ON "calendar_events"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "calendar_events_organization_id_owner_profile_id_starts_at_idx" ON "calendar_events"("organization_id", "owner_profile_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_organization_id_uid_key" ON "calendar_events"("organization_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "approvals_legacy_mongo_id_key" ON "approvals"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "approvals_organization_id_status_type_idx" ON "approvals"("organization_id", "status", "type");

-- CreateIndex
CREATE INDEX "approvals_organization_id_requested_by_profile_id_idx" ON "approvals"("organization_id", "requested_by_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "approvals_organization_id_uid_key" ON "approvals"("organization_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_legacy_mongo_id_key" ON "notifications"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "notifications_organization_id_recipient_profile_id_read_at__idx" ON "notifications"("organization_id", "recipient_profile_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_organization_id_uid_key" ON "notifications"("organization_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "sales_legacy_mongo_id_key" ON "sales"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "sales_organization_id_lead_id_created_at_idx" ON "sales"("organization_id", "lead_id", "created_at");

-- CreateIndex
CREATE INDEX "sales_organization_id_staff_profile_id_idx" ON "sales"("organization_id", "staff_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_organization_id_uid_key" ON "sales"("organization_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "cashbook_entries_legacy_mongo_id_key" ON "cashbook_entries"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "cashbook_entries_organization_id_occurred_at_direction_idx" ON "cashbook_entries"("organization_id", "occurred_at", "direction");

-- CreateIndex
CREATE INDEX "cashbook_entries_organization_id_lead_id_idx" ON "cashbook_entries"("organization_id", "lead_id");

-- CreateIndex
CREATE INDEX "cashbook_entries_organization_id_project_id_idx" ON "cashbook_entries"("organization_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "cashbook_entries_organization_id_uid_key" ON "cashbook_entries"("organization_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_legacy_mongo_id_key" ON "vouchers"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "vouchers_organization_id_status_due_date_idx" ON "vouchers"("organization_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "vouchers_organization_id_allocated_to_profile_id_idx" ON "vouchers"("organization_id", "allocated_to_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_organization_id_uid_key" ON "vouchers"("organization_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_legacy_mongo_id_key" ON "refunds"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "refunds_organization_id_status_created_at_idx" ON "refunds"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "refunds_organization_id_lead_id_idx" ON "refunds"("organization_id", "lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_organization_id_uid_key" ON "refunds"("organization_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_deduction_policies_legacy_mongo_id_key" ON "payroll_deduction_policies"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "payroll_deduction_policies_organization_id_effective_from_idx" ON "payroll_deduction_policies"("organization_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_transcripts_legacy_mongo_id_key" ON "payroll_transcripts"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "payroll_transcripts_organization_id_pay_period_start_idx" ON "payroll_transcripts"("organization_id", "pay_period_start");

-- CreateIndex
CREATE INDEX "payroll_transcripts_organization_id_profile_id_idx" ON "payroll_transcripts"("organization_id", "profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_transcripts_organization_id_uid_key" ON "payroll_transcripts"("organization_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "facebook_integrations_legacy_mongo_id_key" ON "facebook_integrations"("legacy_mongo_id");

-- CreateIndex
CREATE UNIQUE INDEX "facebook_integrations_organization_id_page_id_key" ON "facebook_integrations"("organization_id", "page_id");

-- CreateIndex
CREATE UNIQUE INDEX "facebook_inbound_leads_converted_lead_id_key" ON "facebook_inbound_leads"("converted_lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "facebook_inbound_leads_legacy_mongo_id_key" ON "facebook_inbound_leads"("legacy_mongo_id");

-- CreateIndex
CREATE INDEX "facebook_inbound_leads_organization_id_status_expires_at_idx" ON "facebook_inbound_leads"("organization_id", "status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "facebook_inbound_leads_organization_id_provider_lead_id_key" ON "facebook_inbound_leads"("organization_id", "provider_lead_id");

-- CreateIndex
CREATE INDEX "facebook_lead_claims_organization_id_profile_id_status_idx" ON "facebook_lead_claims"("organization_id", "profile_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "facebook_lead_claims_inbound_lead_id_profile_id_key" ON "facebook_lead_claims"("inbound_lead_id", "profile_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_entity_type_entity_id_idx" ON "audit_logs"("organization_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_profile_id_created_at_idx" ON "audit_logs"("actor_profile_id", "created_at");

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_portal_profile_id_fkey" FOREIGN KEY ("portal_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "societies" ADD CONSTRAINT "societies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_owner_profile_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_assigned_by_profile_id_fkey" FOREIGN KEY ("assigned_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_profile_id_fkey" FOREIGN KEY ("assigned_to_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_owner_profile_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_profile_id_fkey" FOREIGN KEY ("requested_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decided_by_profile_id_fkey" FOREIGN KEY ("decided_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_profile_id_fkey" FOREIGN KEY ("recipient_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_allocated_to_profile_id_fkey" FOREIGN KEY ("allocated_to_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_profile_id_fkey" FOREIGN KEY ("requested_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_decided_by_profile_id_fkey" FOREIGN KEY ("decided_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_deduction_policies" ADD CONSTRAINT "payroll_deduction_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_transcripts" ADD CONSTRAINT "payroll_transcripts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_transcripts" ADD CONSTRAINT "payroll_transcripts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facebook_integrations" ADD CONSTRAINT "facebook_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facebook_inbound_leads" ADD CONSTRAINT "facebook_inbound_leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facebook_inbound_leads" ADD CONSTRAINT "facebook_inbound_leads_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "facebook_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facebook_inbound_leads" ADD CONSTRAINT "facebook_inbound_leads_accepted_by_profile_id_fkey" FOREIGN KEY ("accepted_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facebook_inbound_leads" ADD CONSTRAINT "facebook_inbound_leads_converted_lead_id_fkey" FOREIGN KEY ("converted_lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facebook_lead_claims" ADD CONSTRAINT "facebook_lead_claims_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facebook_lead_claims" ADD CONSTRAINT "facebook_lead_claims_inbound_lead_id_fkey" FOREIGN KEY ("inbound_lead_id") REFERENCES "facebook_inbound_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facebook_lead_claims" ADD CONSTRAINT "facebook_lead_claims_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
