import {db,workspaceTransaction,type Transaction} from '../database';
import {decimal,money} from '../calculations';
import type {Limits} from '../config';
export class LimitError extends Error { constructor(public feature:string, public limit:number) {super(`Лимит тарифа: ${limit}. Перейдите к тарифам или удалите ненужные записи.`);} }
export async function currentPlan(workspaceId:string,tx:Transaction|typeof db=db) {
 const subscription=await tx.subscription.findUnique({where:{workspaceId}});
 const code=subscription && (!subscription.expiresAt || subscription.expiresAt>new Date())?subscription.planCode:'free';
 const plan=await tx.plan.findUniqueOrThrow({where:{code}});
 return {...plan,limits:plan.limits as Limits,subscription};
}
export async function checkLimit(workspaceId:string,kind:'calculations'|'deals'|'products'|'pdf'|'xlsx'|'logo',tx:Transaction|typeof db=db) {
 const p=await currentPlan(workspaceId,tx);const limit=p.limits[kind];
 if(typeof limit==='boolean') {if(!limit)throw new LimitError(kind,0);return;}
 const count=kind==='calculations'?await tx.calculation.count({where:{workspaceId}}):kind==='deals'?await tx.deal.count({where:{workspaceId}}):kind==='products'?await tx.product.count({where:{workspaceId}}): (await tx.usage.findUnique({where:{workspaceId_kind_period:{workspaceId,kind:'pdf',period:new Date().toISOString().slice(0,7)}}}))?.count??0;
 if(count>=limit)throw new LimitError(kind,limit);
}
export const testBillingEnabled=()=>process.env.NODE_ENV!=='production' && process.env.BILLING_MODE==='test' && process.env.TEST_BILLING_ENABLED==='true';
export interface PaymentAdapter {name:string; createCheckout(paymentId:string):Promise<string>;}
export const testAdapter:PaymentAdapter={name:'test',async createCheckout(id){if(!testBillingEnabled())throw new Error('Покупка пока недоступна: реальный провайдер не подключён.');return `/app/subscription/?checkout=${id}`;}};
export async function checkout(workspaceId:string,planCode:string,period:string,promoCode?:string) {
 if(!testBillingEnabled())throw new Error('Покупка пока недоступна: реальный провайдер не подключён.');
 return workspaceTransaction(workspaceId,async tx=>{
  const plan=await tx.plan.findUnique({where:{code:planCode}});if(!plan?.active || planCode==='free')throw new Error('Тариф недоступен');
  let amount=decimal(period==='year'?plan.annualPrice:plan.monthlyPrice);
  if(promoCode){const code=promoCode.trim().toUpperCase();const promo=await tx.$queryRaw<Array<{discount:number;uses:number;maxUses:number;expiresAt:Date;active:boolean}>>`SELECT * FROM "PromoCode" WHERE code=${code} FOR UPDATE`;const p=promo[0];if(!p?.active || p.expiresAt<new Date() || p.uses>=p.maxUses)throw new Error('Промокод недействителен');amount=amount.mul(decimal(100-p.discount)).div(100);await tx.promoCode.update({where:{code},data:{uses:{increment:1}}});promoCode=code;}
  const payment=await tx.payment.create({data:{workspaceId,planCode,period:period==='year'?'year':'month',amount:money(amount),promoCode}});
  await tx.analyticsEvent.create({data:{name:'checkout_started',category:'test'}});
  return {payment,url:await testAdapter.createCheckout(payment.id)};
 });
}
export async function processTestPayment(workspaceId:string,paymentId:string,status:'paid'|'failed') {
 if(!testBillingEnabled())throw new Error('Тестовый адаптер отключён');
 return workspaceTransaction(workspaceId,async tx=>{
  const p=await tx.payment.findFirst({where:{id:paymentId,workspaceId,provider:'test'}});if(!p)throw new Error('Платёж не найден');
  if(p.status!=='pending')return p;
  await tx.paymentEvent.create({data:{id:`test:${p.id}`,paymentId:p.id,status}});
  await tx.payment.update({where:{id:p.id},data:{status}});
  if(status==='paid'){
   const old=await tx.subscription.findUniqueOrThrow({where:{workspaceId}});
   const expires=new Date(old.expiresAt && old.expiresAt>new Date()?old.expiresAt:Date.now());
   if(p.period==='year')expires.setUTCFullYear(expires.getUTCFullYear()+1);else expires.setUTCMonth(expires.getUTCMonth()+1);
   await tx.subscription.update({where:{workspaceId},data:{planCode:p.planCode,expiresAt:expires,autoRenew:false}});
   await tx.auditLog.create({data:{action:'subscription.test-payment',targetId:workspaceId}});
   const owner=await tx.workspace.findUniqueOrThrow({where:{id:workspaceId}});
   await tx.notification.upsert({where:{id:`payment:${p.id}`},create:{id:`payment:${p.id}`,userId:owner.ownerId,text:`Тестовая оплата подтверждена. Тариф ${p.planCode} действует до ${expires.toLocaleDateString('ru-RU')}. Реальные деньги не списывались.`},update:{}});
   await tx.analyticsEvent.create({data:{name:'payment_confirmed',category:'test'}});
  }
  return {...p,status};
 });
}
