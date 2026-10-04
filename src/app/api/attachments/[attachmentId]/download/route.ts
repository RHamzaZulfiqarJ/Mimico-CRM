import { NextResponse } from "next/server";

import { canManageOrganization } from "@/lib/auth/authorization";
import { getAuthContext } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const responseHeaders = { "Cache-Control": "private, no-store" };

export async function GET(
  _request: Request,
  context: RouteContext<"/api/attachments/[attachmentId]/download">,
) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: responseHeaders });
  }
  const { attachmentId } = await context.params;
  const roleAccess = canManageOrganization(auth.membership.role)
    ? {}
    : auth.membership.role === "EMPLOYEE"
      ? { assignments: { some: { profileId: auth.profile.id } } }
      : { client: { portalProfileId: auth.profile.id } };
  const attachment = await getDatabase().attachment.findFirst({
    where: {
      id: attachmentId,
      organizationId: auth.organization.id,
      lead: { isArchived: false, ...roleAccess },
    },
    select: { bucket: true, objectPath: true, originalName: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404, headers: responseHeaders });
  }

  const signed = await createAdminClient().storage
    .from(attachment.bucket)
    .createSignedUrl(attachment.objectPath, 60, {
      download: attachment.originalName ?? true,
    });
  if (signed.error) {
    return NextResponse.json(
      { error: "Attachment download could not be prepared." },
      { status: 503, headers: responseHeaders },
    );
  }
  return NextResponse.redirect(signed.data.signedUrl, {
    headers: responseHeaders,
  });
}
