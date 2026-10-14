import type {Metadata} from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './globals.css';
export const metadata:Metadata={title:{default:'MarginTools — расчёты и коммерческие предложения',template:'%s | MarginTools'},description:'Калькуляторы маржи, наценки и цены продажи. Сделки и коммерческие предложения для малого бизнеса.',metadataBase:new URL(process.env.APP_URL||'http://localhost:3000')};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>;}
