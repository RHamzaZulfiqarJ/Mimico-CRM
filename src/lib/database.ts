import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseEnvironment } from "@/lib/env";

const globalForDatabase = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function getDatabase() {
  if (!globalForDatabase.prisma) {
    const { DATABASE_URL } = getDatabaseEnvironment();
    const adapter = new PrismaPg({ connectionString: DATABASE_URL });

    globalForDatabase.prisma = new PrismaClient({ adapter });
  }

  return globalForDatabase.prisma;
}
