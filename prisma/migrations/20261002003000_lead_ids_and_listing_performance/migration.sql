-- Backfill readable identifiers for records created before lead IDs were generated.
UPDATE public.leads
SET uid = 'LEAD-' || upper(substr(replace(id::text, '-', ''), 1, 12))
WHERE uid IS NULL OR btrim(uid) = '';

-- Support the organization-scoped, newest-first lead list without a sort scan.
CREATE INDEX IF NOT EXISTS "leads_organization_id_is_archived_updated_at_idx"
ON public.leads (organization_id, is_archived, updated_at DESC);
