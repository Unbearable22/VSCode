import Link from 'next/link';
export default function NotFound(){return <main className="empty-page"><h1>Страница недоступна</h1><p>Ссылка не найдена, отозвана или срок её действия истёк.</p><Link className="button primary" href="/">На главную</Link></main>;}
