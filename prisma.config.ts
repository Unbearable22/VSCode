import 'dotenv/config';
import { defineConfig } from 'prisma/config';
export default defineConfig({schema: 'packages/database/prisma/schema.prisma', migrations: {path: 'packages/database/prisma/migrations', seed: 'tsx packages/database/seed.ts'}, datasource: {url: process.env.DATABASE_URL || 'postgresql://margintools:local_dev_only@localhost:5433/margintools'}});
