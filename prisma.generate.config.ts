import { defineConfig } from "prisma/config";

// Client generation only needs the schema. Keeping the datasource out of this
// config lets CI and Vercel generate the client before runtime secrets exist.
export default defineConfig({
  schema: "prisma/schema.prisma",
});
