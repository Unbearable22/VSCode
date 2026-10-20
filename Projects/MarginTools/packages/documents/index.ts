import ExcelJS from 'exceljs';
import type {DealInput} from '../contracts';
import {dealTotals} from '../calculations';
export {proposalPdf} from './proposal-pdf';
export async function dealXlsx(d:DealInput){
 const wb=new ExcelJS.Workbook(),sheet=wb.addWorksheet('Сделка');
 sheet.columns=[{header:'Наименование',key:'name',width:36},{header:'Артикул',key:'sku',width:15},{header:'Количество',key:'quantity',width:14},{header:'Ед.',key:'unit',width:10},{header:'Закупка',key:'cost',width:16},{header:'Продажа',key:'price',width:16},{header:'Скидка, %',key:'discount',width:14},{header:'Расходы',key:'expenses',width:16},{header:'НДС',key:'vatMode',width:15},{header:'Ставка, %',key:'vatRate',width:14},{header:'Комментарий',key:'comment',width:30}];
 d.items.forEach(i=>sheet.addRow({...i,quantity:Number(i.quantity),cost:Number(i.cost),price:Number(i.price),discount:Number(i.discount),expenses:Number(i.expenses),vatRate:Number(i.vatRate)}));
 sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];
 const t=dealTotals(d);sheet.addRow({name:'Общие расходы',expenses:Number(d.overhead)});sheet.addRow({name:'Итог закупки',cost:Number(t.cost)});sheet.addRow({name:'Итог продажи с НДС',price:Number(t.total)});sheet.addRow({name:'Торговая прибыль',price:Number(t.profit)});
 return Buffer.from(await wb.xlsx.writeBuffer());
}
