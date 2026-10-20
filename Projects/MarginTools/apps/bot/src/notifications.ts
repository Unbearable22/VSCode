import type {Bot} from 'grammy';
import {db} from '../../../packages/database';

export async function deliverNotifications(bot:Bot) {
 const now=new Date();
 const expiring=await db.subscription.findMany({where:{expiresAt:{gte:now,lte:new Date(now.getTime()+3*86400000)},planCode:{not:'free'}},include:{workspace:true}});
 for(const s of expiring)await db.notification.upsert({where:{id:`expiry:${s.id}:${s.expiresAt!.toISOString()}`},create:{id:`expiry:${s.id}:${s.expiresAt!.toISOString()}`,userId:s.workspace.ownerId,text:`Подписка MarginTools заканчивается ${s.expiresAt!.toLocaleDateString('ru-RU')}. Данные останутся доступны для чтения.`},update:{}});
 const pending=await db.notification.findMany({where:{status:'pending',nextAttempt:{lte:now}},take:20,orderBy:{createdAt:'asc'}});
 for(const n of pending){
  const claimed=await db.notification.updateMany({where:{id:n.id,status:'pending',nextAttempt:{lte:now}},data:{nextAttempt:new Date(now.getTime()+300000),attempts:{increment:1}}});
  if(!claimed.count)continue;
  const account=await db.telegramAccount.findUnique({where:{userId:n.userId},include:{user:true}});
  if(!account?.notifications||account.user.blocked){await db.notification.update({where:{id:n.id},data:{status:'skipped'}});continue;}
  try{await bot.api.sendMessage(account.telegramId,n.text);await db.notification.update({where:{id:n.id},data:{status:'sent'}});}
  catch{await db.notification.update({where:{id:n.id},data:{status:n.attempts>=4?'failed':'pending',nextAttempt:new Date(Date.now()+Math.min(3600000,60000*2**n.attempts))}});await db.auditLog.create({data:{action:'error.notification',targetId:n.id}});}
 }
}
