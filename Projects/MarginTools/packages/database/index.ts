import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const globalDb = globalThis as unknown as {mtDb?:PrismaClient};
export const db = globalDb.mtDb ?? new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL || 'postgresql://margintools:local_dev_only@localhost:5433/margintools'})});
if(process.env.NODE_ENV!=='production') globalDb.mtDb=db;
export {Prisma};
export type Transaction = Prisma.TransactionClient;
export async function workspaceTransaction<T>(workspaceId:string, fn:(tx:Transaction)=>Promise<T>):Promise<T> {
  return db.$transaction(async tx=> {await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;return fn(tx);});
}
