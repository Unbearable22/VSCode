import type {PublicProposal} from '@mt/contracts/proposal';
export const rub=(v:unknown)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(Number(v||0));
export function ProposalView({s,logoUrl}:{s:PublicProposal;logoUrl?:string}){return <article className={`document document-${s.template}`}>
 {s.company.logoKey&&logoUrl&&<img className="document-logo" src={logoUrl} alt={`Логотип ${s.company.name}`} width="120" height="50"/>}
 <header className="document-head"><div><h2>{s.company.name||'Продавец'}</h2><p className="preserve">{s.company.details}</p><p className="preserve">{s.company.contacts}</p></div><span className="document-label">КОММЕРЧЕСКОЕ<br/>ПРЕДЛОЖЕНИЕ</span></header>
 <div className="document-title"><h2>{s.title}</h2><p>№ {s.number} · {new Date(s.date).toLocaleDateString('ru-RU')}</p></div>
 {s.client&&<div className="document-client"><small>ДЛЯ</small><h3>{s.client.name}</h3><p className="preserve">{s.client.details}</p><p>{s.client.contact}</p></div>}
 <div className="table-scroll"><table><thead><tr><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>НДС</th><th>Сумма</th></tr></thead><tbody>{s.items.map((i,n)=><tr key={n}><td>{i.name}{i.sku&&<small>{i.sku}</small>}</td><td>{i.quantity} {i.unit}</td><td>{rub(i.price)}</td><td>{i.vatMode==='none'?'—':`${i.vatRate}%`}</td><td>{rub(i.total)}</td></tr>)}</tbody></table></div>
 <div className="document-totals"><p>Сумма без НДС <b>{rub(s.totals.base)}</b></p><p>НДС <b>{rub(s.totals.vat)}</b></p><p className="document-grand">Итого <b>{rub(s.totals.total)}</b></p></div>
 <div className="document-terms">{[['Условия оплаты',s.paymentTerms],['Поставка',s.deliveryTerms],['Гарантия',s.warranty]].map(([label,value])=>value&&<div key={label}><h4>{label}</h4><p className="preserve">{value}</p></div>)}</div>
 {s.text&&<p className="preserve">{s.text}</p>}<footer>Действительно до {new Date(s.validUntil).toLocaleDateString('ru-RU')}{s.watermark&&<span>Создано в MarginTools</span>}</footer>
 </article>;}
