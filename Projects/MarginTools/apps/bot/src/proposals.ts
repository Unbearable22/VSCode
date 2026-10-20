import {db,workspaceTransaction} from '../../../packages/database';
import {checkLimit} from '../../../packages/billing';
import {proposalPdf} from '../../../packages/documents';
import {getFile} from '../../../packages/files';
import type {PublicProposal} from '../../../packages/contracts/proposal';

export async function ownProposals(telegramId:string){
 const account=await db.telegramAccount.findUnique({where:{telegramId},include:{user:{include:{workspace:true}}}});
 if(!account||account.user.blocked||!account.user.workspace)throw new Error('Сначала подключите Telegram в своём кабинете.');
 return {workspaceId:account.user.workspace.id,proposals:await db.proposal.findMany({where:{workspaceId:account.user.workspace.id},orderBy:{createdAt:'desc'},take:10,select:{id:true,title:true}})};
}
export async function ownProposalPdf(telegramId:string,id:string){
 const {workspaceId}=await ownProposals(telegramId);
 const proposal=await db.proposal.findFirst({where:{id,workspaceId},include:{versions:{orderBy:{number:'desc'},take:1}}});
 if(!proposal?.versions[0])throw new Error('КП не найдено.');
 const snapshot=proposal.versions[0].snapshot as unknown as PublicProposal;
 const bytes=await proposalPdf(snapshot,snapshot.company.logoKey?await getFile(snapshot.company.logoKey):undefined);
 await workspaceTransaction(workspaceId,async tx=>{await checkLimit(workspaceId,'pdf',tx);const period=new Date().toISOString().slice(0,7);await tx.usage.upsert({where:{workspaceId_kind_period:{workspaceId,kind:'pdf',period}},create:{workspaceId,kind:'pdf',period,count:1},update:{count:{increment:1}}});});
 return bytes;
}
