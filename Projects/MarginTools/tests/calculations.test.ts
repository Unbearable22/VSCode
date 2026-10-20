import { describe,it,expect } from 'vitest';
import {margin,sellingPrice,vat,discount,breakEven,dealTotals} from '../packages/calculations';
import {dealSchema} from '../packages/contracts';
describe('Десятичные финансовые расчёты',()=>{
 it('различает маржу и наценку',()=>expect(margin('800','1000')).toEqual({cost:'800.00',price:'1000.00',profit:'200.00',margin:'20',markup:'25'}));
 it('целевая маржа и наценка',()=>{expect(sellingPrice('800','20').price).toBe('1000.00');expect(sellingPrice('800','20','markup').price).toBe('960.00');expect(()=>sellingPrice('800','100')).toThrow();});
 it('нулевые знаменатели',()=>{expect(margin('0','0').margin).toBeNull();expect(margin('0','100').markup).toBeNull();});
 it('начисляет и выделяет налог',()=>{expect(vat('1000','20','add')).toEqual({base:'1000.00',vat:'200.00',total:'1200.00'});expect(vat('1200','20','included').vat).toBe('200.00');expect(vat('100','0','included').vat).toBe('0.00');});
 it('убыток после скидки',()=>{expect(discount('800','1000','30').profit).toBe('-100.00');expect(discount('800','1000','30').maxDiscount).toBe('20');});
 it('нет точки безубыточности',()=>{expect(breakEven('10000','100','100').units).toBeNull();expect(breakEven('10000','300','200').units).toBe('100');});
 it('дробные количества, разные налоги, взвешенные итоги и округление',()=>{
 const d=dealSchema.parse({title:'Тест',overhead:'0,05',items:[{name:'А',quantity:'1,5',cost:'100',price:'200',vatMode:'add',vatRate:'20'},{name:'Б',quantity:'3',cost:'10',price:'20',vatMode:'included',vatRate:'10'}]});
 const t=dealTotals(d);expect(t.total).toBe('420.00');expect(t.cost).toBe('180.00');expect(t.vat).toBe('65.45');expect(t.revenue).toBe('354.55');expect(t.allocations).toEqual(['0.04','0.01']);expect(Number(t.margin)).toBeCloseTo(49.2173,3);
 });
 it('поддерживает пробелы и запятую',()=>expect(margin('1 000,10','2 000,20').profit).toBe('1000.10'));
});
