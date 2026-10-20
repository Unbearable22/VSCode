import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {sharedProposal} from '@mt/database/service';
import {ProposalView} from '@/components/proposal-view';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Коммерческое предложение',robots:{index:false,follow:false}};
export default async function Share({params}:{params:Promise<{token:string}>}){const {token}=await params;const s=await sharedProposal(token,true);if(!s)notFound();return <main className="share-page"><ProposalView s={s} logoUrl={`/api/share/${token}/logo`}/></main>;}
