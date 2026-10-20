import { db, workspaceTransaction, Prisma } from "./index";
import { dealSchema, proposalSchema, type DealInput } from "../contracts";
import { proposalSnapshot, type PublicProposal } from "../contracts/proposal";
import { checkLimit, currentPlan } from "../billing";
import { token } from "./security";
export const jsonValue = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v));
export function decodeDeal(d: {
  title: string;
  clientId: string | null;
  overhead: unknown;
  allocation: string;
  notes: string;
  items: unknown[];
}) {
  return dealSchema.parse(JSON.parse(JSON.stringify(d)));
}
export async function saveDeal(
  workspaceId: string,
  input: unknown,
  id?: string,
) {
  const data = dealSchema.parse(input);
  return workspaceTransaction(workspaceId, async (tx) => {
    if (
      data.clientId &&
      !(await tx.client.findFirst({
        where: { id: data.clientId, workspaceId },
      }))
    )
      throw new Error("Клиент не найден");
    const { items, ...fields } = data;
    const rows = items.map(({ id: unused, ...i }, position) => ({
      ...i,
      position,
    }));
    if (id) {
      const old = await tx.deal.findFirst({ where: { id, workspaceId } });
      if (!old) throw new Error("NOT_FOUND");
      return tx.deal.update({
        where: { id },
        data: { ...fields, items: { deleteMany: {}, create: rows } },
        include: { items: { orderBy: { position: "asc" } } },
      });
    }
    await checkLimit(workspaceId, "deals", tx);
    const d = await tx.deal.create({
      data: { workspaceId, ...fields, items: { create: rows } },
      include: { items: { orderBy: { position: "asc" } } },
    });
    await tx.analyticsEvent.create({ data: { name: "deal_created" } });
    return d;
  });
}
export async function createProposal(
  workspaceId: string,
  input: unknown,
  proposalId?: string,
) {
  const options = proposalSchema.parse(input);
  return workspaceTransaction(workspaceId, async (tx) => {
    const plan = await currentPlan(workspaceId, tx);
    const templateSetting=await tx.setting.findUnique({where:{key:`template:${options.template}`}});
    if((templateSetting?.value as {enabled?:boolean}|undefined)?.enabled===false)throw new Error('Шаблон временно недоступен. Выберите другое оформление.');
    if (!plan.limits.templates.includes(options.template))
      throw new Error("Выбранный шаблон доступен в Pro и Business");
    const deal = await tx.deal.findFirst({
      where: { id: options.dealId, workspaceId },
      include: { items: { orderBy: { position: "asc" } } },
    });
    if (!deal) throw new Error("NOT_FOUND");
    const company = await tx.companyProfile.findUnique({
      where: { workspaceId },
    });
    const client = deal.clientId
      ? await tx.client.findFirst({ where: { id: deal.clientId, workspaceId } })
      : null;
    const p = proposalId
      ? await tx.proposal.findFirst({
          where: { id: proposalId, workspaceId },
          include: { versions: { orderBy: { number: "desc" }, take: 1 } },
        })
      : null;
    if (proposalId && !p) throw new Error("NOT_FOUND");
    const proposal =
      p ||
      (await tx.proposal.create({
        data: { workspaceId, title: options.title },
      }));
    const number = p ? p.versions[0].number + 1 : 1;
    const snapshot = proposalSnapshot(decodeDeal(deal), {
      title: options.title,
      number: `${proposal.id.slice(-6).toUpperCase()}-${number}`,
      date: new Date().toISOString(),
      validUntil: new Date(
        Date.now() + options.validDays * 86400000,
      ).toISOString(),
      template: options.template,
      company: {
        name: company?.name || "",
        details: company?.details || "",
        contacts: company?.contacts || "",
        logoKey: plan.limits.logo ? company?.logoKey : null,
      },
      client: client
        ? {
            name: client.name,
            details: client.details,
            contact: client.contact,
          }
        : null,
      paymentTerms: options.paymentTerms,
      deliveryTerms: options.deliveryTerms,
      warranty: options.warranty,
      text: options.text,
      watermark: plan.code === "free",
    });
    const version = await tx.proposalVersion.create({
      data: { proposalId: proposal.id, number, snapshot: jsonValue(snapshot) },
    });
    await tx.analyticsEvent.create({ data: { name: "proposal_created" } });
    return { ...proposal, versions: [version] };
  });
}
export async function createShare(
  workspaceId: string,
  versionId: string,
  days = 14,
) {
  const version = await db.proposalVersion.findFirst({
    where: { id: versionId, proposal: { workspaceId } },
  });
  if (!version) throw new Error("NOT_FOUND");
  const snapshot = version.snapshot as unknown as PublicProposal;
  const expiresAt = new Date(
    Math.min(
      new Date(snapshot.validUntil).getTime(),
      Date.now() + Math.min(days, 365) * 86400000,
    ),
  );
  if (expiresAt <= new Date())
    throw new Error("Срок действия КП истёк. Создайте новую версию.");
  return db.shareLink.create({
    data: { versionId, token: token(), expiresAt },
  });
}
export async function sharedProposal(raw: string, recordView = false) {
  const link = await db.shareLink.findUnique({
    where: { token: raw },
    include: { version: true },
  });
  if (!link || link.revokedAt || link.expiresAt < new Date()) return null;
  if (recordView) {
    await db.shareLink.update({
      where: { id: link.id },
      data: { views: { increment: 1 } },
    });
    await db.analyticsEvent.create({ data: { name: "proposal_view" } });
  }
  return link.version.snapshot as unknown as PublicProposal;
}
