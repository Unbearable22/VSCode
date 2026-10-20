import type {MetadataRoute} from 'next';
export const dynamic='force-dynamic';
export default function sitemap():MetadataRoute.Sitemap {if(process.env.STAGING_MODE==='true')return [];const base=process.env.APP_URL||'http://localhost:3000';return ['/','/pricing/','/templates/','/commercial-proposals/','/knowledge/',...['margin','markup','selling-price','vat','discount','break-even','deal'].map(v=>`/calculators/${v}/`),...['margin-vs-markup','how-to-calculate-selling-price','vat-calculation','commercial-proposal-guide'].map(v=>`/knowledge/${v}/`)].map(p=>({url:base+p}));}
