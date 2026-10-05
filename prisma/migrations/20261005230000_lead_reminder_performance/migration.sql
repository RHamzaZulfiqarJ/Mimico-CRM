-- Keep latest-follow-up reminder lookups fast as each lead's history grows.
CREATE INDEX "follow_ups_organization_id_lead_id_created_at_idx"
ON "follow_ups"("organization_id", "lead_id", "created_at" DESC);
