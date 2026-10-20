import type { NextConfig } from 'next';
const config: NextConfig = { serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg', 'exceljs', 'pdf-lib', '@pdf-lib/fontkit'], poweredByHeader: false };
export default config;
