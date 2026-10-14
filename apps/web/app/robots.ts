import type {MetadataRoute} from 'next';
export const dynamic='force-dynamic';
export default function robots():MetadataRoute.Robots{if(process.env.STAGING_MODE==='true')return {rules:{userAgent:'*',disallow:'/'}};return {rules:{userAgent:'*',allow:'/',disallow:['/app/','/admin/','/auth/','/share/','/api/']},sitemap:`${process.env.APP_URL||'http://localhost:3000'}/sitemap.xml`};}
