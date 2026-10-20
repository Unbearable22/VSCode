import Decimal from 'decimal.js';
import type { DealInput, DealItemInput } from '../contracts';
Decimal.set({precision: 40, rounding: Decimal.ROUND_HALF_UP});
export const decimal = (v: string | number | Decimal) => new Decimal(typeof v === 'string' ? v.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.') : v);
export const money = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
const percentage = (profit: Decimal, base: Decimal) => base.isZero() ? null : profit.div(base).mul(100).toDecimalPlaces(4).toString();
export function margin(cost: string, price: string) {
  const c = decimal(cost), p = decimal(price), profit = p.minus(c);
  return {cost: money(c), price: money(p), profit: money(profit), margin: percentage(profit,p), markup: percentage(profit,c)};
}
export function sellingPrice(cost: string, percent: string, mode: 'margin'|'markup' = 'margin') {
  const c = decimal(cost), rate = decimal(percent).div(100);
  if (mode === 'margin' && rate.gte(1)) throw new Error('Для конечной цены целевая маржа должна быть меньше 100%.');
  return margin(cost, money(mode === 'margin' ? c.div(new Decimal(1).minus(rate)) : c.mul(rate.plus(1))));
}
export function vat(amount: string, rate: string, mode: 'add'|'included') {
  const a = decimal(amount), r = decimal(rate).div(100);
  const base = mode === 'add' ? a : a.div(r.plus(1));
  const tax = mode === 'add' ? a.mul(r) : a.minus(base);
  return {base: money(base), vat: money(tax), total: money(mode === 'add' ? a.plus(tax) : a)};
}
export function discount(cost: string, price: string, rate: string, minimumProfit = '0') {
  const p = decimal(price), reduction = p.mul(decimal(rate)).div(100);
  const max = p.isZero() ? null : Decimal.max(0, Decimal.min(100,p.minus(decimal(cost)).minus(decimal(minimumProfit)).div(p).mul(100))).toString();
  return {...margin(cost, money(p.minus(reduction))), discount: money(reduction), maxDiscount: max, feasible: p.minus(decimal(cost)).gte(decimal(minimumProfit))};
}
export function breakEven(fixed: string, price: string, variable: string) {
  const contribution = decimal(price).minus(decimal(variable));
  const units = contribution.lte(0) ? null : decimal(fixed).div(contribution).ceil();
  return {units: units?.toString() ?? null, revenue: units ? money(units.mul(decimal(price))) : null, contribution: money(contribution)};
}
export function line(item: DealItemInput) {
  const q = decimal(item.quantity), base = decimal(item.price).mul(q).mul(new Decimal(1).minus(decimal(item.discount).div(100)));
  const sale = item.vatMode === 'none' ? {base:money(base),vat:'0.00',total:money(base)} : vat(money(base),item.vatRate,item.vatMode === 'add' ? 'add':'included');
  const cost = money(decimal(item.cost).mul(q));
  return {...sale, cost, expenses: money(decimal(item.expenses)), profit: money(decimal(sale.base).minus(cost).minus(item.expenses))};
}
export function dealTotals(deal: DealInput) {
  const rows = deal.items.map(line);
  const sum = (key: keyof typeof rows[number]) => rows.reduce((a,r)=>a.plus(r[key]),new Decimal(0));
  const cost=sum('cost'), revenue=sum('base'), tax=sum('vat'), total=sum('total'), expenses=sum('expenses').plus(deal.overhead), profit=revenue.minus(cost).minus(expenses);
  const weights = rows.map(r=>deal.allocation === 'equal' ? new Decimal(1) : decimal(deal.allocation === 'cost' ? r.cost : r.base));
  const totalWeight = weights.reduce((a,b)=>a.plus(b),new Decimal(0));
  let allocated=new Decimal(0);
  const allocations=rows.map((_,i)=> {const value=i===rows.length-1 ? decimal(deal.overhead).minus(allocated) : decimal(money(totalWeight.isZero() ? decimal(deal.overhead).div(rows.length) : decimal(deal.overhead).mul(weights[i]).div(totalWeight))); allocated=allocated.plus(value);return money(value);});
  return {cost:money(cost),revenue:money(revenue),vat:money(tax),total:money(total),expenses:money(expenses),profit:money(profit),margin:percentage(profit,revenue),markup:percentage(profit,cost),rows,allocations};
}
export const calculatorKinds = ['margin','markup','selling-price','vat','discount','break-even'] as const;
export function calculate(kind: string, raw: Record<string,string>) {
  const get = (key:string, fallback='0') => {const v=raw[key] || fallback; const d=decimal(v);if (!d.isFinite() || d.isNegative() || d.gt(1e12)) throw new Error('Введите неотрицательные конечные числа до 1 трлн.');return d.toString();};
  switch(kind) {
    case 'margin': case 'markup': return margin(get('cost'),get('price'));
    case 'selling-price': return sellingPrice(get('cost'),get('percent'),raw.mode==='markup'?'markup':'margin');
    case 'vat': return vat(get('amount'),get('percent'),raw.mode==='included'?'included':'add');
    case 'discount': {const rate=get('percent');if(decimal(rate).gt(100))throw new Error('Скидка не может превышать 100%.');return discount(get('cost'),get('price'),rate,get('minimumProfit'));}
    case 'break-even': return breakEven(get('fixed'),get('price'),get('variable'));
    default: throw new Error('Неизвестный калькулятор');
  }
}
