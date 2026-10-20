import type {Metadata} from 'next';
import {App} from '@/components/app';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug?:string[]}>}):Promise<Metadata>{const {slug=[]}=await params;const p='/'+slug.join('/');const privateRoute=['app','admin','auth','share'].includes(slug[0]);const titles:Record<string,string>={margin:'Калькулятор маржи',markup:'Калькулятор наценки','selling-price':'Калькулятор цены продажи',vat:'Калькулятор НДС',discount:'Калькулятор скидки','break-even':'Точка безубыточности',deal:'Конструктор сделки',pricing:'Тарифы',knowledge:'База знаний',templates:'Шаблоны КП','commercial-proposals':'Коммерческие предложения'};return {title:titles[slug.at(-1)||'']||'MarginTools',alternates:{canonical:p==='/'?'/':`${p}/`},robots:privateRoute?{index:false,follow:false}:undefined};}
export default function Page(){return <App/>;}
