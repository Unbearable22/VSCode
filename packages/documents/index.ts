import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import type {PublicProposal} from '../contracts/proposal';
import type {DealInput} from '../contracts';
import {dealTotals} from '../calculations';
import {projectRoot} from '../files';
export async function proposalPdf(s:PublicProposal,logo?:Buffer){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const font=await doc.embedFont(await readFile(path.join(projectRoot,'apps/web/assets/DejaVuSans.ttf')),{subset:true});
 let page=doc.addPage([595,842]),y=795;
 const addPage=()=>{page=doc.addPage([595,842]);y=795;};
 const write=(text:string,size=10,bold=false)=>{
  const words=text.replace(/[\r\n]/g,' \n ').split(' ');let line='';
  const draw=()=>{if(y<65)addPage();page.drawText(line,{x:42,y,size,font,color:bold?rgb(.09,.13,.20):rgb(.2,.25,.3)});y-=size+7;line='';};
  for(const word of words){if(word==='\n'){draw();continue;}if(font.widthOfTextAtSize(line+' '+word,size)>510 && line)draw();if(font.widthOfTextAtSize(word,size)>510){for(const c of word){if(font.widthOfTextAtSize(line+c,size)>510)draw();line+=c;}}else line+=(line?' ':'')+word;}if(line)draw();
 };
 if(logo){const image=logo[0]===137?await doc.embedPng(logo):await doc.embedJpg(logo);const dims=image.scaleToFit(120,50);page.drawImage(image,{x:42,y:y-dims.height,width:dims.width,height:dims.height});y-=dims.height+15;}
 write(s.company.name||'Коммерческое предложение',16,true);write(s.company.details);write(s.company.contacts);y-=14;
 write(s.title,s.template==='presentation'?22:18,true);write(`№ ${s.number} от ${new Date(s.date).toLocaleDateString('ru-RU')}`);write(`Действительно до ${new Date(s.validUntil).toLocaleDateString('ru-RU')}`);
 if(s.client){write(`Клиент: ${s.client.name}`);write(s.client.details);write(s.client.contact);}y-=14;
 s.items.forEach((i,n)=>{write(`${n+1}. ${i.name}${i.sku?' · '+i.sku:''}`,s.template==='compact'?10:12,true);write(`${i.quantity} ${i.unit} × ${i.price} ₽ — ${i.total} ₽`);write(i.vatMode==='none'?'Без расчёта НДС':`НДС ${i.vatRate}%: ${i.vat} ₽`);y-=s.template==='compact'?2:8;});
 write(`Сумма без НДС: ${s.totals.base} ₽`);write(`НДС: ${s.totals.vat} ₽`);write(`Итого: ${s.totals.total} ₽`,16,true);y-=15;
 for(const [label,value] of [['Оплата',s.paymentTerms],['Поставка',s.deliveryTerms],['Гарантия',s.warranty]])if(value){write(label,12,true);write(value);}if(s.text)write(s.text);
 const pages=doc.getPages();pages.forEach((p,n)=>{p.drawText(`${n+1} / ${pages.length}`,{x:510,y:28,size:8,font});if(s.watermark)p.drawText('Создано в MarginTools',{x:42,y:28,size:8,font});});
 return Buffer.from(await doc.save());
}
export async function dealXlsx(d:DealInput){
 const wb=new ExcelJS.Workbook(),sheet=wb.addWorksheet('Сделка');
 sheet.columns=[{header:'Наименование',key:'name',width:36},{header:'Артикул',key:'sku',width:15},{header:'Количество',key:'quantity',width:14},{header:'Ед.',key:'unit',width:10},{header:'Закупка',key:'cost',width:16},{header:'Продажа',key:'price',width:16},{header:'Скидка, %',key:'discount',width:14},{header:'Расходы',key:'expenses',width:16},{header:'НДС',key:'vatMode',width:15},{header:'Ставка, %',key:'vatRate',width:14},{header:'Комментарий',key:'comment',width:30}];
 d.items.forEach(i=>sheet.addRow({...i,quantity:Number(i.quantity),cost:Number(i.cost),price:Number(i.price),discount:Number(i.discount),expenses:Number(i.expenses),vatRate:Number(i.vatRate)}));
 sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];
 const t=dealTotals(d);sheet.addRow({name:'Общие расходы',expenses:Number(d.overhead)});sheet.addRow({name:'Итог закупки',cost:Number(t.cost)});sheet.addRow({name:'Итог продажи с НДС',price:Number(t.total)});sheet.addRow({name:'Торговая прибыль',price:Number(t.profit)});
 return Buffer.from(await wb.xlsx.writeBuffer());
}
