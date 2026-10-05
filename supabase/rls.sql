-- Apply after the Prisma migration has created the public tables and enums.
-- Browser/Data API access is denied unless an authenticated user satisfies a policy.
-- Privileged server connections can bypass RLS and must also use the application guards.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles as p
  where p.auth_user_id = (select auth.uid())
    and p.is_active
  limit 1
$$;

create or replace function private.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = target_organization_id
      and membership.profile_id = private.current_profile_id()
      and membership.is_active
  )
$$;

create or replace function private.has_org_role(
  target_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = target_organization_id
      and membership.profile_id = private.current_profile_id()
      and membership.is_active
      and membership.role::text = any(allowed_roles)
  )
$$;

create or replace function private.is_profile_member(
  target_organization_id uuid,
  target_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = target_organization_id
      and membership.profile_id = target_profile_id
      and membership.is_active
  )
$$;

create or replace function private.can_read_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_profile_id = private.current_profile_id()
    or exists (
      select 1
      from public.organization_memberships as viewer
      join public.organization_memberships as target
        on target.organization_id = viewer.organization_id
      where viewer.profile_id = private.current_profile_id()
        and viewer.is_active
        and viewer.role::text = any(array['employee', 'manager', 'super_admin'])
        and target.profile_id = target_profile_id
        and target.is_active
    )
$$;

create or replace function private.can_access_lead(target_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leads as lead
    where lead.id = target_lead_id
      and (
        private.has_org_role(
          lead.organization_id,
          array['manager', 'super_admin']
        )
        or (
          not lead.is_archived
          and
          private.has_org_role(lead.organization_id, array['employee'])
          and exists (
            select 1
            from public.lead_assignments as assignment
            where assignment.lead_id = lead.id
              and assignment.profile_id = private.current_profile_id()
          )
        )
        or (
          not lead.is_archived
          and
          private.has_org_role(lead.organization_id, array['client'])
          and exists (
            select 1
            from public.clients as client
            where client.id = lead.client_id
              and client.is_active
              and client.portal_profile_id = private.current_profile_id()
          )
        )
      )
  )
$$;

revoke all on function private.current_profile_id() from public;
revoke all on function private.is_org_member(uuid) from public;
revoke all on function private.has_org_role(uuid, text[]) from public;
revoke all on function private.is_profile_member(uuid, uuid) from public;
revoke all on function private.can_read_profile(uuid) from public;
revoke all on function private.can_access_lead(uuid) from public;

grant execute on function private.current_profile_id() to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;
grant execute on function private.is_profile_member(uuid, uuid) to authenticated;
grant execute on function private.can_read_profile(uuid) to authenticated;
grant execute on function private.can_access_lead(uuid) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations',
    'profiles',
    'organization_memberships',
    'clients',
    'societies',
    'projects',
    'inventories',
    'leads',
    'lead_assignments',
    'follow_ups',
    'attachments',
    'tasks',
    'calendar_events',
    'approvals',
    'notifications',
    'sales',
    'cashbook_entries',
    'vouchers',
    'refunds',
    'payroll_deduction_policies',
    'payroll_transcripts',
    'facebook_integrations',
    'facebook_inbound_leads',
    'facebook_lead_claims',
    'audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end
$$;

grant select on table public.organizations to authenticated;
grant select on table public.profiles to authenticated;
grant update (first_name, last_name, phone, city, cnic) on table public.profiles to authenticated;
grant select on table public.organization_memberships to authenticated;
-- Client mutations are server-only so employees cannot bypass the application's
-- manager-only portal-link and lifecycle controls through the Data API.
grant select on table public.clients to authenticated;
grant select, insert, update, delete on table public.leads to authenticated;
grant select, insert, update, delete on table public.lead_assignments to authenticated;
grant select, insert, update, delete on table public.follow_ups to authenticated;
grant select, insert, update, delete on table public.attachments to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.calendar_events to authenticated;
grant select, insert, update, delete on table public.approvals to authenticated;
grant select, update (read_at) on table public.notifications to authenticated;
grant select, update (status, responded_at) on table public.facebook_lead_claims to authenticated;
grant select on table public.audit_logs to authenticated;

drop policy if exists organizations_select_members on public.organizations;
create policy organizations_select_members
on public.organizations for select to authenticated
using (private.is_org_member(id));

drop policy if exists profiles_select_visible on public.profiles;
create policy profiles_select_visible
on public.profiles for select to authenticated
using (private.can_read_profile(id));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles for update to authenticated
using (id = private.current_profile_id())
with check (id = private.current_profile_id());

drop policy if exists memberships_select_members on public.organization_memberships;
create policy memberships_select_members
on public.organization_memberships for select to authenticated
using (private.is_org_member(organization_id));

drop policy if exists clients_select_staff_or_self on public.clients;
create policy clients_select_staff_or_self
on public.clients for select to authenticated
using (
  private.has_org_role(organization_id, array['employee', 'manager', 'super_admin'])
  or (
    is_active
    and portal_profile_id = private.current_profile_id()
    and private.has_org_role(organization_id, array['client'])
  )
);

drop policy if exists clients_insert_staff on public.clients;
create policy clients_insert_staff
on public.clients for insert to authenticated
with check (private.has_org_role(organization_id, array['employee', 'manager', 'super_admin']));

drop policy if exists clients_update_staff on public.clients;
create policy clients_update_staff
on public.clients for update to authenticated
using (private.has_org_role(organization_id, array['employee', 'manager', 'super_admin']))
with check (private.has_org_role(organization_id, array['employee', 'manager', 'super_admin']));

drop policy if exists clients_delete_management on public.clients;
create policy clients_delete_management
on public.clients for delete to authenticated
using (private.has_org_role(organization_id, array['manager', 'super_admin']));

drop policy if exists leads_select_authorized on public.leads;
create policy leads_select_authorized
on public.leads for select to authenticated
using (private.can_access_lead(id));

drop policy if exists leads_insert_staff on public.leads;
create policy leads_insert_staff
on public.leads for insert to authenticated
with check (private.has_org_role(organization_id, array['employee', 'manager', 'super_admin']));

drop policy if exists leads_update_authorized on public.leads;
create policy leads_update_authorized
on public.leads for update to authenticated
using (
  private.can_access_lead(id)
  and private.has_org_role(organization_id, array['employee', 'manager', 'super_admin'])
)
with check (private.has_org_role(organization_id, array['employee', 'manager', 'super_admin']));

drop policy if exists leads_delete_management on public.leads;
create policy leads_delete_management
on public.leads for delete to authenticated
using (private.has_org_role(organization_id, array['manager', 'super_admin']));

drop policy if exists assignments_select_authorized on public.lead_assignments;
create policy assignments_select_authorized
on public.lead_assignments for select to authenticated
using (
  (
    profile_id = private.current_profile_id()
    and private.is_org_member(organization_id)
  )
  or private.has_org_role(organization_id, array['manager', 'super_admin'])
);

drop policy if exists assignments_write_management on public.lead_assignments;
create policy assignments_write_management
on public.lead_assignments for insert to authenticated
with check (
  private.has_org_role(organization_id, array['manager', 'super_admin'])
  and private.can_access_lead(lead_id)
  and private.is_profile_member(organization_id, profile_id)
);

drop policy if exists assignments_delete_management on public.lead_assignments;
create policy assignments_delete_management
on public.lead_assignments for delete to authenticated
using (private.has_org_role(organization_id, array['manager', 'super_admin']));

drop policy if exists follow_ups_select_authorized on public.follow_ups;
create policy follow_ups_select_authorized
on public.follow_ups for select to authenticated
using (private.can_access_lead(lead_id));

drop policy if exists follow_ups_insert_authorized on public.follow_ups;
create policy follow_ups_insert_authorized
on public.follow_ups for insert to authenticated
with check (
  private.can_access_lead(lead_id)
  and private.has_org_role(organization_id, array['employee', 'manager', 'super_admin'])
  and created_by_profile_id = private.current_profile_id()
);

drop policy if exists follow_ups_update_authorized on public.follow_ups;
create policy follow_ups_update_authorized
on public.follow_ups for update to authenticated
using (
  private.can_access_lead(lead_id)
  and private.has_org_role(organization_id, array['employee', 'manager', 'super_admin'])
)
with check (
  private.can_access_lead(lead_id)
  and private.has_org_role(organization_id, array['employee', 'manager', 'super_admin'])
);

drop policy if exists follow_ups_delete_management on public.follow_ups;
create policy follow_ups_delete_management
on public.follow_ups for delete to authenticated
using (private.has_org_role(organization_id, array['manager', 'super_admin']));

drop policy if exists attachments_select_authorized on public.attachments;
create policy attachments_select_authorized
on public.attachments for select to authenticated
using (
  (lead_id is not null and private.can_access_lead(lead_id))
  or private.has_org_role(organization_id, array['employee', 'manager', 'super_admin'])
);

drop policy if exists attachments_insert_staff on public.attachments;
create policy attachments_insert_staff
on public.attachments for insert to authenticated
with check (
  private.has_org_role(organization_id, array['employee', 'manager', 'super_admin'])
  and created_by_profile_id = private.current_profile_id()
);

drop policy if exists attachments_delete_management on public.attachments;
create policy attachments_delete_management
on public.attachments for delete to authenticated
using (private.has_org_role(organization_id, array['manager', 'super_admin']));

drop policy if exists tasks_select_participant on public.tasks;
create policy tasks_select_participant
on public.tasks for select to authenticated
using (
  (
    (
      assigned_to_profile_id = private.current_profile_id()
      or created_by_profile_id = private.current_profile_id()
    )
    and private.is_org_member(organization_id)
  )
  or private.has_org_role(organization_id, array['manager', 'super_admin'])
);

drop policy if exists tasks_insert_staff on public.tasks;
create policy tasks_insert_staff
on public.tasks for insert to authenticated
with check (
  private.has_org_role(organization_id, array['employee', 'manager', 'super_admin'])
  and created_by_profile_id = private.current_profile_id()
  and private.is_profile_member(organization_id, assigned_to_profile_id)
);

drop policy if exists tasks_update_participant on public.tasks;
create policy tasks_update_participant
on public.tasks for update to authenticated
using (
  (
    assigned_to_profile_id = private.current_profile_id()
    and private.is_org_member(organization_id)
  )
  or private.has_org_role(organization_id, array['manager', 'super_admin'])
)
with check (private.is_org_member(organization_id));

drop policy if exists tasks_delete_owner_or_management on public.tasks;
drop policy if exists tasks_delete_management on public.tasks;
create policy tasks_delete_management
on public.tasks for delete to authenticated
using (
  private.has_org_role(organization_id, array['manager', 'super_admin'])
);

drop policy if exists events_select_owner_or_management on public.calendar_events;
create policy events_select_owner_or_management
on public.calendar_events for select to authenticated
using (
  (
    owner_profile_id = private.current_profile_id()
    and private.is_org_member(organization_id)
  )
  or private.has_org_role(organization_id, array['manager', 'super_admin'])
);

drop policy if exists events_insert_owner on public.calendar_events;
create policy events_insert_owner
on public.calendar_events for insert to authenticated
with check (
  owner_profile_id = private.current_profile_id()
  and private.is_org_member(organization_id)
);

drop policy if exists events_update_owner on public.calendar_events;
create policy events_update_owner
on public.calendar_events for update to authenticated
using (
  (
    owner_profile_id = private.current_profile_id()
    and private.is_org_member(organization_id)
  )
  or private.has_org_role(organization_id, array['manager', 'super_admin'])
)
with check (private.is_org_member(organization_id));

drop policy if exists events_delete_owner on public.calendar_events;
create policy events_delete_owner
on public.calendar_events for delete to authenticated
using (
  (
    owner_profile_id = private.current_profile_id()
    and private.is_org_member(organization_id)
  )
  or private.has_org_role(organization_id, array['manager', 'super_admin'])
);

drop policy if exists approvals_select_requester_or_management on public.approvals;
create policy approvals_select_requester_or_management
on public.approvals for select to authenticated
using (
  (
    requested_by_profile_id = private.current_profile_id()
    and private.is_org_member(organization_id)
  )
  or private.has_org_role(organization_id, array['manager', 'super_admin'])
);

drop policy if exists approvals_insert_staff on public.approvals;
create policy approvals_insert_staff
on public.approvals for insert to authenticated
with check (
  private.has_org_role(organization_id, array['employee', 'manager', 'super_admin'])
  and requested_by_profile_id = private.current_profile_id()
);

drop policy if exists approvals_update_management on public.approvals;
create policy approvals_update_management
on public.approvals for update to authenticated
using (private.has_org_role(organization_id, array['manager', 'super_admin']))
with check (private.has_org_role(organization_id, array['manager', 'super_admin']));

drop policy if exists approvals_delete_management on public.approvals;
create policy approvals_delete_management
on public.approvals for delete to authenticated
using (private.has_org_role(organization_id, array['manager', 'super_admin']));

drop policy if exists notifications_select_recipient on public.notifications;
create policy notifications_select_recipient
on public.notifications for select to authenticated
using (
  (
    recipient_profile_id = private.current_profile_id()
    and private.is_org_member(organization_id)
  )
  or private.has_org_role(organization_id, array['manager', 'super_admin'])
);

drop policy if exists notifications_update_recipient on public.notifications;
create policy notifications_update_recipient
on public.notifications for update to authenticated
using (
  recipient_profile_id = private.current_profile_id()
  and private.is_org_member(organization_id)
)
with check (
  recipient_profile_id = private.current_profile_id()
  and private.is_org_member(organization_id)
);

drop policy if exists claims_select_owner_or_management on public.facebook_lead_claims;
create policy claims_select_owner_or_management
on public.facebook_lead_claims for select to authenticated
using (
  (
    profile_id = private.current_profile_id()
    and private.is_org_member(organization_id)
  )
  or private.has_org_role(organization_id, array['manager', 'super_admin'])
);

drop policy if exists claims_update_owner on public.facebook_lead_claims;
create policy claims_update_owner
on public.facebook_lead_claims for update to authenticated
using (
  profile_id = private.current_profile_id()
  and private.is_org_member(organization_id)
  and status = 'pending'
)
with check (
  profile_id = private.current_profile_id()
  and private.is_org_member(organization_id)
  and status = 'rejected'
);

drop policy if exists audit_logs_select_management on public.audit_logs;
create policy audit_logs_select_management
on public.audit_logs for select to authenticated
using (private.has_org_role(organization_id, array['manager', 'super_admin']));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'societies',
    'projects',
    'inventories',
    'sales',
    'cashbook_entries',
    'vouchers',
    'refunds',
    'payroll_deduction_policies',
    'payroll_transcripts',
    'facebook_integrations',
    'facebook_inbound_leads'
  ]
  loop
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_staff_select', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.has_org_role(organization_id, array[''employee'', ''manager'', ''super_admin'']))',
      table_name || '_staff_select',
      table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_staff_insert', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.has_org_role(organization_id, array[''employee'', ''manager'', ''super_admin'']))',
      table_name || '_staff_insert',
      table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_staff_update', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.has_org_role(organization_id, array[''employee'', ''manager'', ''super_admin''])) with check (private.has_org_role(organization_id, array[''employee'', ''manager'', ''super_admin'']))',
      table_name || '_staff_update',
      table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_management_delete', table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.has_org_role(organization_id, array[''manager'', ''super_admin'']))',
      table_name || '_management_delete',
      table_name
    );
  end loop;
end
$$;

-- Refund requests are visible to their requester and organization management.
-- Employees may create only self-owned requests for leads they can access;
-- status decisions remain management-only.
drop policy if exists refunds_staff_select on public.refunds;
create policy refunds_staff_select
on public.refunds for select to authenticated
using (
  requested_by_profile_id = private.current_profile_id()
  or private.has_org_role(organization_id, array['manager', 'super_admin'])
);

drop policy if exists refunds_staff_insert on public.refunds;
create policy refunds_staff_insert
on public.refunds for insert to authenticated
with check (
  requested_by_profile_id = private.current_profile_id()
  and private.has_org_role(organization_id, array['employee', 'manager', 'super_admin'])
  and lead_id is not null
  and private.can_access_lead(lead_id)
);

drop policy if exists refunds_staff_update on public.refunds;
create policy refunds_staff_update
on public.refunds for update to authenticated
using (private.has_org_role(organization_id, array['manager', 'super_admin']))
with check (private.has_org_role(organization_id, array['manager', 'super_admin']));

-- Payroll policy changes and transcript writes are management-only. Staff may
-- read only their own transcript rows through the Data API.
drop policy if exists payroll_deduction_policies_staff_select on public.payroll_deduction_policies;
create policy payroll_deduction_policies_staff_select
on public.payroll_deduction_policies for select to authenticated
using (private.has_org_role(organization_id, array['manager', 'super_admin']));

drop policy if exists payroll_deduction_policies_staff_insert on public.payroll_deduction_policies;
create policy payroll_deduction_policies_staff_insert
on public.payroll_deduction_policies for insert to authenticated
with check (private.has_org_role(organization_id, array['manager', 'super_admin']));

drop policy if exists payroll_deduction_policies_staff_update on public.payroll_deduction_policies;
create policy payroll_deduction_policies_staff_update
on public.payroll_deduction_policies for update to authenticated
using (private.has_org_role(organization_id, array['manager', 'super_admin']))
with check (private.has_org_role(organization_id, array['manager', 'super_admin']));

drop policy if exists payroll_transcripts_staff_select on public.payroll_transcripts;
create policy payroll_transcripts_staff_select
on public.payroll_transcripts for select to authenticated
using (
  profile_id = private.current_profile_id()
  or private.has_org_role(organization_id, array['manager', 'super_admin'])
);

drop policy if exists payroll_transcripts_staff_insert on public.payroll_transcripts;
create policy payroll_transcripts_staff_insert
on public.payroll_transcripts for insert to authenticated
with check (private.has_org_role(organization_id, array['manager', 'super_admin']));

drop policy if exists payroll_transcripts_staff_update on public.payroll_transcripts;
create policy payroll_transcripts_staff_update
on public.payroll_transcripts for update to authenticated
using (private.has_org_role(organization_id, array['manager', 'super_admin']))
with check (private.has_org_role(organization_id, array['manager', 'super_admin']));

-- Integration metadata contains secret references and is management-only.
-- Inbound lead rows are readable by staff, while writes flow through the
-- signature-verified server webhook and authorized server actions.
drop policy if exists facebook_integrations_staff_select on public.facebook_integrations;
create policy facebook_integrations_staff_select
on public.facebook_integrations for select to authenticated
using (private.has_org_role(organization_id, array['manager', 'super_admin']));

drop policy if exists facebook_integrations_staff_insert on public.facebook_integrations;
create policy facebook_integrations_staff_insert
on public.facebook_integrations for insert to authenticated
with check (private.has_org_role(organization_id, array['manager', 'super_admin']));

drop policy if exists facebook_integrations_staff_update on public.facebook_integrations;
create policy facebook_integrations_staff_update
on public.facebook_integrations for update to authenticated
using (private.has_org_role(organization_id, array['manager', 'super_admin']))
with check (private.has_org_role(organization_id, array['manager', 'super_admin']));

drop policy if exists facebook_inbound_leads_staff_insert on public.facebook_inbound_leads;
create policy facebook_inbound_leads_staff_insert
on public.facebook_inbound_leads for insert to authenticated
with check (private.has_org_role(organization_id, array['manager', 'super_admin']));

drop policy if exists facebook_inbound_leads_staff_select on public.facebook_inbound_leads;
create policy facebook_inbound_leads_staff_select
on public.facebook_inbound_leads for select to authenticated
using (
  private.has_org_role(organization_id, array['manager', 'super_admin'])
  or exists (
    select 1
    from public.facebook_lead_claims claim
    where claim.inbound_lead_id = facebook_inbound_leads.id
      and claim.profile_id = private.current_profile_id()
      and private.is_org_member(facebook_inbound_leads.organization_id)
  )
);

drop policy if exists facebook_inbound_leads_staff_update on public.facebook_inbound_leads;
create policy facebook_inbound_leads_staff_update
on public.facebook_inbound_leads for update to authenticated
using (private.has_org_role(organization_id, array['manager', 'super_admin']))
with check (private.has_org_role(organization_id, array['manager', 'super_admin']));
