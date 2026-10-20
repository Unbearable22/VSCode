import type {DealInput} from './index';
import {dealTotals,decimal,money} from '../calculations';
export type PublicProposal={title:string;number:string;date:string;validUntil:string;template:string;company:{name:string;details:string;contacts:string;logoKey?:string|null};client:{name:string;details:string;contact:string}|null;items:Array<{name:string;sku:string;quantity:string;unit:string;price:string;vatMode:string;vatRate:string;base:string;vat:string;total:string}>;totals:{base:string;vat:string;total:string};paymentTerms:string;deliveryTerms:string;warranty:string;text:string;watermark:boolean};
// Whitelist the public document fields. Never serialize the internal deal object.
export function proposalSnapshot(deal:DealInput, options:Omit<PublicProposal,'items'|'totals'>):PublicProposal {
 const totals=dealTotals(deal);
 return {...options,items:deal.items.map((i,n)=>({name:i.name,sku:i.sku,quantity:i.quantity,unit:i.unit,price:money(decimal(i.price).mul(decimal(1).minus(decimal(i.discount).div(100)))),vatMode:i.vatMode,vatRate:i.vatRate,base:totals.rows[n].base,vat:totals.rows[n].vat,total:totals.rows[n].total})),totals:{base:totals.revenue,vat:totals.vat,total:totals.total}};
}
