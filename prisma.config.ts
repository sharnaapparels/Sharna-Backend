// Prisma 6 config — schema & migration paths defined here
// DB URL stays in schema.prisma via env("DATABASE_URL")
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});

