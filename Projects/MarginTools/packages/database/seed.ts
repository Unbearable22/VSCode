import 'dotenv/config';
import {db} from './index';
import {hashPassword} from './security';
import {planDefaults,articles} from '../config';
for(const p of planDefaults)await db.plan.upsert({where:{code:p.code},update:{},create:p});
for(const a of articles)await db.knowledgeArticle.upsert({where:{slug:a.slug},update:{},create:a});
await db.setting.upsert({where:{key:'vatRates'},update:{},create:{key:'vatRates',value:['0','10','20']}});
await db.setting.upsert({where:{key:'botEnabled'},update:{},create:{key:'botEnabled',value:true}});
if(process.env.SEED_DEMO==='true' && process.env.NODE_ENV!=='production') {
 const password=process.env.DEMO_PASSWORD;
 if(!password || password.length<10)throw new Error('Для демоданных укажите DEMO_PASSWORD (10+ символов)');
 for(const [email,role,name] of [['demo@margintools.local','user','Демо-пользователь'],['admin@margintools.local','admin','Администратор']]) {
  await db.user.upsert({where:{email},update:{},create:{email,name,role,passwordHash:await hashPassword(password),workspace:{create:{company:{create:{name:'Демонстрационная компания'}},subscription:{create:{planCode:'free'}}}}}});
 }
}
if(process.env.ADMIN_EMAIL)await db.user.updateMany({where:{email:process.env.ADMIN_EMAIL.toLowerCase()},data:{role:'admin'}});
await db.$disconnect();
console.log('Тарифы, статьи и настройки готовы.');
