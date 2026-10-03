import "dotenv/config";

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migration commands should use Supabase's direct or session-mode endpoint.
    url: env("DIRECT_URL"),
  },
});
