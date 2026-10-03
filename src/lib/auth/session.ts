import { cache } from "react";
import { connection } from "next/server";
import { headers } from "next/headers";

import type { MembershipRole } from "@/lib/auth/authorization";
import {
  normalizeAuthUserId,
  verifiedAuthUserIdHeader,
} from "@/lib/auth/identity";
import { getDatabase } from "@/lib/database";
import { hasDatabaseEnvironment, hasSupabaseEnvironment } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type AuthContext = {
  authUserId: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  profile: {
    id: string;
    displayName: string;
    email: string | null;
  };
  membership: {
    id: string;
    role: MembershipRole;
  };
};

export const getVerifiedAuthUserId = cache(async () => {
  await connection();

  if (!hasSupabaseEnvironment()) {
    return null;
  }

  const proxyVerifiedUserId = normalizeAuthUserId(
    (await headers()).get(verifiedAuthUserIdHeader),
  );
  if (proxyVerifiedUserId) return proxyVerifiedUserId;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || typeof data?.claims?.sub !== "string") {
    return null;
  }

  return data.claims.sub;
});

export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const authUserId = await getVerifiedAuthUserId();

  if (!authUserId || !hasDatabaseEnvironment()) {
    return null;
  }

  const database = getDatabase();
  const membership = await database.organizationMembership.findFirst({
    where: {
      isActive: true,
      organization: { status: "ACTIVE" },
      profile: {
        authUserId,
        isActive: true,
      },
    },
    orderBy: { joinedAt: "asc" },
    select: {
      id: true,
      role: true,
      organization: {
        select: { id: true, name: true, slug: true },
      },
      profile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      },
    },
  });

  if (!membership) {
    return null;
  }

  const displayName =
    [membership.profile.firstName, membership.profile.lastName]
      .filter(Boolean)
      .join(" ") ||
    membership.profile.username ||
    membership.profile.email ||
    "CRM user";

  return {
    authUserId,
    organization: membership.organization,
    profile: {
      id: membership.profile.id,
      displayName,
      email: membership.profile.email,
    },
    membership: {
      id: membership.id,
      role: membership.role,
    },
  };
});
