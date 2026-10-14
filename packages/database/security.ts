import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {db} from './index';
const scrypt=promisify(scryptCallback);
export const token=()=>randomBytes(32).toString('hex');
export const hashToken=(v:string)=>createHash('sha256').update(v).digest('hex');
export async function hashPassword(password:string) {const salt=randomBytes(16).toString('hex');return `${salt}:${(await scrypt(password,salt,64) as Buffer).toString('hex')}`;}
export async function verifyPassword(password:string,hash:string) {const [salt,key]=hash.split(':');const actual=await scrypt(password,salt,64) as Buffer;const expected=Buffer.from(key,'hex');return actual.length===expected.length && timingSafeEqual(actual,expected);}
export async function createSession(userId:string) {const raw=token();await db.session.create({data:{id:hashToken(raw),userId,expiresAt:new Date(Date.now()+7*86400000)}});return raw;}
export async function userBySession(raw:string|undefined) {
 if(!raw) return null;
 const s=await db.session.findUnique({where:{id:hashToken(raw)},include:{user:{include:{workspace:true}}}});
 return s && s.expiresAt>new Date() && !s.user.blocked ? s.user : null;
}
export async function rateLimit(key:string,max=30,seconds=60) {
 const bucket=await db.$transaction(async tx=>{
   await tx.$executeRaw`INSERT INTO "RateBucket" (key,count,"expiresAt") VALUES (${key},1,${new Date(Date.now()+seconds*1000)}) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN "RateBucket"."expiresAt"<NOW() THEN 1 ELSE "RateBucket".count+1 END, "expiresAt"=CASE WHEN "RateBucket"."expiresAt"<NOW() THEN EXCLUDED."expiresAt" ELSE "RateBucket"."expiresAt" END`;
   return tx.rateBucket.findUniqueOrThrow({where:{key}});
 });
 if(bucket.count>max) throw new Error('RATE_LIMIT');
}
