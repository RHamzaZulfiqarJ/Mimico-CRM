import { createClient } from "@supabase/supabase-js";

import { getAdminEnvironment } from "@/lib/env";

export function createAdminClient() {
  const environment = getAdminEnvironment();

  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
