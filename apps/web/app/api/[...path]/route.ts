import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z, ZodError } from "zod";
import { db, workspaceTransaction } from "@mt/database";
import { registrationSchema, numeric } from "@mt/contracts";
import { calculate } from "@mt/calculations";
import {
  createSession,
  hashPassword,
  verifyPassword,
  hashToken,
  token,
  rateLimit,
} from "@mt/database/security";
import {
  currentPlan,
  checkLimit,
  checkout,
  processTestPayment,
  testBillingEnabled,
  LimitError,
} from "@mt/billing";
import { currentUser } from "@/lib/auth";
import {
  jsonValue,
  saveDeal,
  createProposal,
  createShare,
  sharedProposal,
  decodeDeal,
} from "@mt/database/service";
import { proposalPdf, dealXlsx } from "@mt/documents";
import { storeFile, getFile, deleteWorkspaceFiles } from "@mt/files";
import type { PublicProposal } from "@mt/contracts/proposal";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });
const ok = (v: unknown) =>
  NextResponse.json(v, { headers: { "Cache-Control": "no-store" } });
async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const [resource, id, action] = path;
  const method = req.method;
  try {
    if (method !== "GET") {
      const origin = req.headers.get("origin");
      const configured = new URL(process.env.APP_URL || "http://localhost:3000")
        .origin;
      if (
        (origin && origin !== configured && origin !== req.nextUrl.origin) ||
        req.headers.get("sec-fetch-site") === "cross-site"
      )
        return fail("Недопустимый источник запроса", 403);
      if (Number(req.headers.get("content-length") || 0) > 3 * 1024 * 1024)
        return fail("Файл или запрос слишком большой", 413);
    }
    const user = await currentUser();
    const identity =
      user?.id ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "local";
    await rateLimit(`api:${identity}`, 200, 60);
    const body = async () => {
      const text = await req.text();
      if (text.length > 2 * 1024 * 1024)
        throw new Error("Запрос слишком большой");
      return JSON.parse(text || "{}");
    };
    if (resource === "plans" && method === "GET")
      return ok({
        plans: await db.plan.findMany({
          where: { active: true },
          orderBy: { monthlyPrice: "asc" },
        }),
        testBilling: testBillingEnabled(),
      });
async function logoResponse(s:PublicProposal){
 if(!s.company.logoKey)return fail('Логотип не задан',404);
 return new NextResponse(await getFile(s.company.logoKey),{headers:{'Content-Type':s.company.logoKey.endsWith('.png')?'image/png':'image/jpeg','Cache-Control':'private, no-store'}});
}
    if (resource === "knowledge" && method === "GET")
      return ok(
        await db.knowledgeArticle.findMany({ where: { published: true } }),
      );
    if (resource === "settings-public" && method === "GET")
      return ok({
        vatRates: (await db.setting.findUnique({ where: { key: "vatRates" } }))
          ?.value || ["0", "10", "20"],
      });
    if (resource === "calculate" && method === "POST") {
      const b = z
        .object({ kind: z.string(), input: z.record(z.string(), z.string()) })
        .parse(await body());
      const result = calculate(b.kind, b.input);
      await db.analyticsEvent.create({
        data: { name: "calculator_used", category: b.kind },
      });
      return ok(result);
    }
    if (resource === "auth") {
      await rateLimit(`auth:${identity}`, 20, 900);
      if (id === "register" && method === "POST") {
        const b = registrationSchema.parse(await body());
        if (await db.user.findUnique({ where: { email: b.email } }))
          return fail("Этот email уже зарегистрирован");
        const u = await db.user.create({
          data: {
            name: b.name,
            email: b.email,
            passwordHash: await hashPassword(b.password),
            consents: {
              create: { type: "terms-and-privacy-v1", granted: true },
            },
            workspace: {
              create: {
                company: { create: {} },
                subscription: { create: { planCode: "free" } },
              },
            },
          },
        });
        (await cookies()).set("mt_session", await createSession(u.id), {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 7 * 86400,
        });
        await db.analyticsEvent.create({ data: { name: "registration" } });
        return ok({ id: u.id, name: u.name });
      }
      if (id === "login" && method === "POST") {
        const b = z
          .object({ email: z.email(), password: z.string().max(128) })
          .parse(await body());
        const u = await db.user.findUnique({
          where: { email: b.email.toLowerCase() },
        });
        if (
          !u ||
          u.blocked ||
          !(await verifyPassword(b.password, u.passwordHash))
        )
          return fail("Неверный email или пароль", 401);
        (await cookies()).set("mt_session", await createSession(u.id), {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 7 * 86400,
        });
        return ok({ name: u.name });
      }
      if (id === "logout" && method === "POST") {
        const c = await cookies();
        const raw = c.get("mt_session")?.value;
        if (raw) await db.session.deleteMany({ where: { id: hashToken(raw) } });
        c.delete("mt_session");
        return ok({ success: true });
      }
      if (id === "reset-password" && method === "POST") {
        const b = z
          .object({
            email: z.email().optional(),
            token: z.string().optional(),
            password: z.string().min(10).max(128).optional(),
          })
          .parse(await body());
        if (b.token && b.password) {
          const hash = hashToken(b.token);
          const passwordHash = await hashPassword(b.password);
          await db.$transaction(async (tx) => {
            const t = await tx.authToken.findUnique({ where: { id: hash } });
            if (
              !t ||
              t.purpose !== "reset" ||
              t.usedAt ||
              t.expiresAt < new Date()
            )
              throw new Error("Ссылка недействительна");
            const used = await tx.authToken.updateMany({
              where: { id: hash, usedAt: null },
              data: { usedAt: new Date() },
            });
            if (!used.count) throw new Error("Ссылка уже использована");
            await tx.user.update({
              where: { id: t.userId },
              data: { passwordHash },
            });
            await tx.session.deleteMany({ where: { userId: t.userId } });
          });
          return ok({ success: true });
        }
        if (!process.env.MAIL_WEBHOOK_URL)
          return fail(
            "Восстановление пароля недоступно: почтовый сервис ещё не подключён.",
            503,
          );
        const u = b.email
          ? await db.user.findUnique({
              where: { email: b.email.toLowerCase() },
            })
          : null;
        if (u) {
          const raw = token();
          await db.authToken.create({
            data: {
              id: hashToken(raw),
              userId: u.id,
              purpose: "reset",
              expiresAt: new Date(Date.now() + 900000),
            },
          });
          const sent = await fetch(process.env.MAIL_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: u.email,
              template: "reset",
              url: `${process.env.APP_URL}/auth/reset-password/?token=${raw}`,
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (!sent.ok) throw new Error("Почта временно недоступна");
        }
        return ok({
          message: "Если адрес зарегистрирован, письмо отправлено.",
        });
      }
    }
    if (resource === "share" && method === "GET") {
      const s = await sharedProposal(id);
      if (!s) return fail("Ссылка недействительна или отозвана", 404);
      if(action==='logo')return logoResponse(s);
      return ok(s);
    }
    if (resource === "support" && method === "POST") {
      const b = z
        .object({
          email: z.union([z.email(), z.literal("")]).default(""),
          text: z.string().min(5).max(5000),
        })
        .parse(await body());
      await db.supportRequest.create({ data: { ...b, userId: user?.id } });
      return ok({ success: true });
    }
    if (resource === "support" && method === "GET" && user)
      return ok(
        await db.supportRequest.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
        }),
      );
    if (!user?.workspace) return fail("Войдите в аккаунт", 401);
    const wid = user.workspace.id;
    if (resource === "me" && method === "GET")
      return ok({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        currency: user.workspace.currency,
        plan: await currentPlan(wid),
        counts: {
          calculations: await db.calculation.count({
            where: { workspaceId: wid },
          }),
          deals: await db.deal.count({ where: { workspaceId: wid } }),
          proposals: await db.proposal.count({ where: { workspaceId: wid } }),
        },
      });
    if (resource === "dashboard" && method === "GET")
      return ok({
        calculations: await db.calculation.findMany({
          where: { workspaceId: wid },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        deals: await db.deal.findMany({
          where: { workspaceId: wid },
          include: { items: { orderBy: { position: "asc" } } },
          orderBy: { updatedAt: "desc" },
          take: 5,
        }),
        proposals: await db.proposal.findMany({
          where: { workspaceId: wid },
          include: { versions: { orderBy: { number: "desc" }, take: 1 } },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      });
    if (resource === "calculations") {
      if (method === "GET")
        return ok(
          await db.calculation.findMany({
            where: { workspaceId: wid },
            orderBy: { createdAt: "desc" },
          }),
        );
      if (method === "POST") {
        const b = z
          .object({
            kind: z.string(),
            title: z.string().min(1).max(200),
            input: z.record(z.string(), z.string()),
          })
          .parse(await body());
        const result = calculate(b.kind, b.input);
        const c = await workspaceTransaction(wid, async (tx) => {
          await checkLimit(wid, "calculations", tx);
          return tx.calculation.create({
            data: { workspaceId: wid, ...b, result: jsonValue(result) },
          });
        });
        await db.analyticsEvent.create({
          data: { name: "calculation_saved", category: b.kind },
        });
        return ok(c);
      }
      if (method === "DELETE") {
        await db.calculation.deleteMany({ where: { id, workspaceId: wid } });
        return ok({ success: true });
      }
    }
    if (resource === "deals") {
      if (method === "GET") {
        const where = { workspaceId: wid, ...(id ? { id } : {}) };
        if (action === "xlsx") {
          await checkLimit(wid, "xlsx");
          const d = await db.deal.findFirst({
            where,
            include: { items: { orderBy: { position: "asc" } } },
          });
          if (!d) return fail("Сделка не найдена", 404);
          return new NextResponse(await dealXlsx(decodeDeal(d)), {
            headers: {
              "Content-Type":
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "Content-Disposition": 'attachment; filename="deal.xlsx"',
            },
          });
        }
        return ok(
          id
            ? await db.deal.findFirst({
                where,
                include: { items: { orderBy: { position: "asc" } } },
              })
            : await db.deal.findMany({
                where,
                include: { items: { orderBy: { position: "asc" } } },
                orderBy: { updatedAt: "desc" },
              }),
        );
      }
      if (method === "POST") return ok(await saveDeal(wid, await body()));
      if (method === "PUT") return ok(await saveDeal(wid, await body(), id));
      if (method === "DELETE") {
        await db.deal.deleteMany({ where: { id, workspaceId: wid } });
        return ok({ success: true });
      }
    }
    if (resource === "proposals") {
      if (method === "GET") {
        const where = { workspaceId: wid, ...(id ? { id } : {}) };
        if (action === "pdf" || action === "logo") {
          const versionId = req.nextUrl.searchParams.get("version");
          const p = await db.proposal.findFirst({
            where,
            include: {
              versions: {
                where: versionId ? { id: versionId } : {},
                orderBy: { number: "desc" },
                take: 1,
              },
            },
          });
          if (!p?.versions[0]) return fail("КП не найдено", 404);
          const s = p.versions[0].snapshot as unknown as PublicProposal;
          if(action==='logo')return logoResponse(s);
          const bytes = await proposalPdf(
            s,
            s.company.logoKey ? await getFile(s.company.logoKey) : undefined,
          );
          await workspaceTransaction(wid, async (tx) => {
            await checkLimit(wid, "pdf", tx);
            const period = new Date().toISOString().slice(0, 7);
            await tx.usage.upsert({
              where: {
                workspaceId_kind_period: {
                  workspaceId: wid,
                  kind: "pdf",
                  period,
                },
              },
              create: { workspaceId: wid, kind: "pdf", period, count: 1 },
              update: { count: { increment: 1 } },
            });
          });
          await storeFile(
            `${wid}/${p.versions[0].id}.pdf`,
            bytes,
            "application/pdf",
          );
          return new NextResponse(bytes, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": 'attachment; filename="proposal.pdf"',
            },
          });
        }
        return ok(
          await db.proposal.findMany({
            where,
            include: {
              versions: {
                include: { links: true },
                orderBy: { number: "desc" },
              },
            },
            orderBy: { createdAt: "desc" },
          }),
        );
      }
      if (method === "POST" && action === "duplicate") {
        return ok(
          await workspaceTransaction(wid, async (tx) => {
            const p = await tx.proposal.findFirst({
              where: { id, workspaceId: wid },
              include: { versions: { orderBy: { number: "desc" }, take: 1 } },
            });
            if (!p?.versions[0]) throw new Error("NOT_FOUND");
            const copy = await tx.proposal.create({
              data: { workspaceId: wid, title: p.title + " (копия)" },
            });
            const snapshot = {
              ...(p.versions[0].snapshot as unknown as PublicProposal),
              number: copy.id.slice(-6).toUpperCase() + "-1",
              date: new Date().toISOString(),
            };
            await tx.proposalVersion.create({
              data: {
                proposalId: copy.id,
                number: 1,
                snapshot: jsonValue(snapshot),
              },
            });
            return copy;
          }),
        );
      }
      if (method === "POST" && action === "share") {
        const b = z
          .object({
            versionId: z.string(),
            days: z.number().int().min(1).max(365).default(14),
          })
          .parse(await body());
        const v = await db.proposalVersion.findFirst({
          where: { id: b.versionId, proposal: { id, workspaceId: wid } },
        });
        if (!v) return fail("КП не найдено", 404);
        return ok(await createShare(wid, b.versionId, b.days));
      }
      if (method === "POST")
        return ok(await createProposal(wid, await body(), id));
      if (method === "PATCH") {
        const b = z
          .object({ status: z.enum(["draft", "sent", "accepted", "declined"]) })
          .parse(await body());
        await db.proposal.updateMany({
          where: { id, workspaceId: wid },
          data: b,
        });
        return ok({ success: true });
      }
      if (method === "DELETE") {
        await db.proposal.deleteMany({ where: { id, workspaceId: wid } });
        return ok({ success: true });
      }
    }
    if (resource === "links" && method === "DELETE") {
      await db.shareLink.updateMany({
        where: { id, version: { proposal: { workspaceId: wid } } },
        data: { revokedAt: new Date() },
      });
      return ok({ success: true });
    }
    if (resource === "clients" || resource === "products") {
      const model = resource === "clients" ? db.client : db.product;
      if (method === "GET")
        return ok(
          resource === "clients"
            ? await db.client.findMany({
                where: { workspaceId: wid },
                orderBy: { createdAt: "desc" },
              })
            : await db.product.findMany({
                where: { workspaceId: wid },
                orderBy: { createdAt: "desc" },
              }),
        );
      if (method === "DELETE") {
        if (resource === "clients")
          await db.client.deleteMany({ where: { id, workspaceId: wid } });
        else await db.product.deleteMany({ where: { id, workspaceId: wid } });
        return ok({ success: true });
      }
      if (method === "POST" || method === "PUT") {
        if (resource === "clients") {
          const b = z
            .object({
              name: z.string().min(1).max(200),
              contact: z.string().max(500).default(""),
              email: z.union([z.email(), z.literal("")]).default(""),
              phone: z.string().max(100).default(""),
              details: z.string().max(2000).default(""),
              notes: z.string().max(3000).default(""),
            })
            .parse(await body());
          if (id) {
            await db.client.updateMany({
              where: { id, workspaceId: wid },
              data: b,
            });
            return ok({ success: true });
          }
          return ok(
            await db.client.create({ data: { workspaceId: wid, ...b } }),
          );
        }
        const b = z
          .object({
            name: z.string().min(1).max(200),
            sku: z.string().max(100).default(""),
            unit: z.string().max(20).default("шт."),
            cost: numeric,
            price: numeric,
          })
          .parse(await body());
        if (id) {
          await db.product.updateMany({
            where: { id, workspaceId: wid },
            data: b,
          });
          return ok({ success: true });
        }
        return ok(
          await workspaceTransaction(wid, async (tx) => {
            await checkLimit(wid, "products", tx);
            return tx.product.create({ data: { workspaceId: wid, ...b } });
          }),
        );
      }
      void model;
    }
    if (resource === "company") {
      if (method === "GET")
        return ok(
          await db.companyProfile.findUnique({ where: { workspaceId: wid } }),
        );
      if (method === "PUT") {
        const b = z
          .object({
            name: z.string().max(200),
            details: z.string().max(3000),
            contacts: z.string().max(2000),
            paymentTerms: z.string().max(2000),
            deliveryTerms: z.string().max(2000),
            warranty: z.string().max(2000),
          })
          .parse(await body());
        return ok(
          await db.companyProfile.update({
            where: { workspaceId: wid },
            data: b,
          }),
        );
      }
      if (method === "POST" && id === "logo") {
        await checkLimit(wid, "logo");
        const f = (await req.formData()).get("file");
        if (!(f instanceof File) || f.size > 2 * 1024 * 1024)
          return fail("Загрузите PNG или JPEG до 2 МБ");
        const bytes = Buffer.from(await f.arrayBuffer());
        const png = bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
          jpg = bytes[0] === 255 && bytes[1] === 216;
        if (!png && !jpg) return fail("Только PNG или JPEG");
        const { PDFDocument } = await import("pdf-lib");
        const doc = await PDFDocument.create();
        const image = png
          ? await doc.embedPng(bytes)
          : await doc.embedJpg(bytes);
        if (image.width > 5000 || image.height > 5000)
          return fail("Размер изображения не больше 5000 пикселей");
        const key = `${wid}/${token()}.${png ? "png" : "jpg"}`;
        await storeFile(key, bytes, png ? "image/png" : "image/jpeg");
        await db.companyProfile.update({
          where: { workspaceId: wid },
          data: { logoKey: key },
        });
        return ok({ success: true });
      }
    }
    if (resource === "subscription") {
      if (method === "GET")
        return ok({
          plan: await currentPlan(wid),
          payments: await db.payment.findMany({
            where: { workspaceId: wid },
            orderBy: { createdAt: "desc" },
          }),
          testBilling: testBillingEnabled(),
        });
      if (method === "POST" && id === "checkout") {
        const b = z
          .object({
            planCode: z.string(),
            period: z.enum(["month", "year"]),
            promoCode: z.string().max(50).optional(),
          })
          .parse(await body());
        return ok(await checkout(wid, b.planCode, b.period, b.promoCode));
      }
      if (method === "POST" && id === "test") {
        const b = z
          .object({ paymentId: z.string(), status: z.enum(["paid", "failed"]) })
          .parse(await body());
        return ok(await processTestPayment(wid, b.paymentId, b.status));
      }
      if (method === "PATCH") {
        await db.subscription.update({
          where: { workspaceId: wid },
          data: { autoRenew: false },
        });
        return ok({ success: true });
      }
    }
    if (resource === "telegram") {
      if (method === "GET")
        return ok({
          account: await db.telegramAccount.findUnique({
            where: { userId: user.id },
          }),
          configured: !!process.env.TELEGRAM_BOT_TOKEN,
          username: process.env.TELEGRAM_BOT_USERNAME || null,
        });
      if (method === "POST") {
        if (
          !process.env.TELEGRAM_BOT_TOKEN ||
          !process.env.TELEGRAM_BOT_USERNAME
        )
          return fail(
            "Telegram-бот ещё не подключён: нужны токен и имя бота.",
            503,
          );
        const raw = token();
        await db.authToken.deleteMany({
          where: { userId: user.id, purpose: "telegram" },
        });
        await db.authToken.create({
          data: {
            id: hashToken(raw),
            userId: user.id,
            purpose: "telegram",
            expiresAt: new Date(Date.now() + 300000),
          },
        });
        return ok({
          url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${raw}`,
        });
      }
      if (method === "DELETE") {
        await db.telegramAccount.deleteMany({ where: { userId: user.id } });
        await db.authToken.deleteMany({
          where: { userId: user.id, purpose: "telegram" },
        });
        return ok({ success: true });
      }
      if (method === "PATCH") {
        const b = z
          .object({ notifications: z.boolean(), marketing: z.boolean() })
          .parse(await body());
        await db.telegramAccount.update({
          where: { userId: user.id },
          data: b,
        });
        await db.consent.create({
          data: {
            userId: user.id,
            type: "telegram-marketing",
            granted: b.marketing,
          },
        });
        return ok({ success: true });
      }
    }
    if (resource === "settings") {
      if (method === "PATCH") {
        const b = z
          .object({
            name: z.string().min(2).max(100),
            currency: z.literal("RUB"),
          })
          .parse(await body());
        await db.user.update({
          where: { id: user.id },
          data: { name: b.name },
        });
        await db.workspace.update({
          where: { id: wid },
          data: { currency: b.currency },
        });
        return ok({ success: true });
      }
      if (method === "GET" && id === "export") {
        const data = await db.workspace.findUnique({
          where: { id: wid },
          include: {
            company: true,
            clients: true,
            products: true,
            calculations: true,
            deals: { include: { items: true } },
            proposals: { include: { versions: { include: { links: true } } } },
            subscription: true,
            payments: true,
          },
        });
        return new NextResponse(
          JSON.stringify(
            {
              profile: { email: user.email, name: user.name },
              workspace: data,
            },
            null,
            2,
          ),
          {
            headers: {
              "Content-Type": "application/json",
              "Content-Disposition":
                'attachment; filename="margintools-data.json"',
            },
          },
        );
      }
      if (method === "DELETE") {
        const b = z
          .object({ password: z.string().max(128) })
          .parse(await body());
        if (!(await verifyPassword(b.password, user.passwordHash)))
          return fail("Неверный пароль");
        await deleteWorkspaceFiles(wid);
        await db.$transaction(async (tx) => {
          await tx.supportRequest.deleteMany({ where: { userId: user.id } });
          const tg = await tx.telegramAccount.findUnique({
            where: { userId: user.id },
          });
          await tx.notification.deleteMany({where:{userId:user.id}});
          if (tg) {
            await tx.aiUsage.deleteMany({where:{telegramId:tg.telegramId}});
            await tx.supportRequest.deleteMany({where:{telegramId:tg.telegramId}});
            await tx.botConversation.deleteMany({
              where: { telegramId: tg.telegramId },
            });
          }
          await tx.user.delete({ where: { id: user.id } });
        });
        (await cookies()).delete("mt_session");
        return ok({ success: true });
      }
    }
    if (resource === "admin") {
      if (user.role !== "admin") return fail("Недостаточно прав", 403);
      if (method === "GET") {
        switch (id) {
          case "dashboard":
            return ok({
              users: await db.user.count(),
              deals: await db.deal.count(),
              proposals: await db.proposal.count(),
              payments: await db.payment.count({ where: { status: "paid" } }),
              errors: await db.auditLog.count({
                where: { action: { startsWith: "error." } },
              }),
            });
          case "users":
            return ok(
              await db.user.findMany({
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                  blocked: true,
                  createdAt: true,
                  workspace: { select: { id: true, subscription: true } },
                },
                orderBy: { createdAt: "desc" },
              }),
            );
          case "subscriptions":
            return ok(
              await db.subscription.findMany({
                orderBy: { updatedAt: "desc" },
              }),
            );
          case "payments":
            return ok(
              await db.payment.findMany({
                include: { events: true },
                orderBy: { createdAt: "desc" },
              }),
            );
          case "promo-codes":
            return ok(await db.promoCode.findMany());
          case "templates": {
            const settings=await db.setting.findMany({where:{key:{startsWith:'template:'}}});
            return ok(
              ["standard", "compact", "presentation"].map((code) => ({
                code,
                name: {
                  standard: "Стандартный",
                  compact: "Компактный",
                  presentation: "Презентационный",
                }[code],
                renderer: "PDF / HTML",
                enabled: true,
                ...(settings.find(s=>s.key===`template:${code}`)?.value as object || {}),
              })),
            );
          }
          case "knowledge-base":
            return ok(await db.knowledgeArticle.findMany());
          case "bot":
            return ok({
              configured: !!process.env.TELEGRAM_BOT_TOKEN,
              aiConfigured: !!process.env.AI_API_KEY,
              conversations: await db.botConversation.count(),
              usage: await db.aiUsage.groupBy({
                by: ["currency"],
                _sum: { tokens: true, cost: true },
                _count: true,
              }),
              settings: await db.setting.findMany({
                where: { key: { in: ["botEnabled", "aiEnabled"] } },
              }),
            });
          case "leads":
            return ok(
              await db.supportRequest.findMany({
                orderBy: { createdAt: "desc" },
              }),
            );
          case "analytics":
            return ok(
              await db.analyticsEvent.groupBy({
                by: ["name", "category"],
                _count: true,
              }),
            );
          case "audit":
            return ok(
              await db.auditLog.findMany({
                orderBy: { createdAt: "desc" },
                take: 200,
              }),
            );
          case "settings":
            return ok({
              settings: await db.setting.findMany(),
              plans: await db.plan.findMany(),
              testBilling: testBillingEnabled(),
            });
        }
      }
      if (method === "POST" || method === "PATCH") {
        const b = await body();
        const result = await db.$transaction(async (tx) => {
          let result: unknown = { success: true };
          if (id === "users") {
            const v = z
              .object({ id: z.string(), blocked: z.boolean() })
              .parse(b);
            if (v.id === user.id) throw new Error("Нельзя заблокировать себя");
            result = await tx.user.update({
              where: { id: v.id },
              data: { blocked: v.blocked },
              select: { id: true, blocked: true },
            });
          } else if (id === "templates") {
            const v=z.object({code:z.enum(['standard','compact','presentation']),name:z.string().min(1).max(100),enabled:z.boolean()}).parse(b);
            result=await tx.setting.upsert({where:{key:`template:${v.code}`},create:{key:`template:${v.code}`,value:{name:v.name,enabled:v.enabled}},update:{value:{name:v.name,enabled:v.enabled}}});
          } else if (id === "plans") {
            const v = z
              .object({
                code: z.enum(["free", "pro", "business"]),
                name: z.string().min(1).max(50),
                monthlyPrice: z.number().int().min(0).max(1000000),
                annualPrice: z.number().int().min(0).max(12000000),
                limits: z.object({
                  calculations: z.number().int().min(0),
                  deals: z.number().int().min(0),
                  pdf: z.number().int().min(0),
                  products: z.number().int().min(0),
                  xlsx: z.boolean(),
                  logo: z.boolean(),
                  templates: z.array(
                    z.enum(["standard", "compact", "presentation"]),
                  ),
                }),
              })
              .parse(b);
            result = await tx.plan.update({ where: { code: v.code }, data: v });
          } else if (id === "promo-codes") {
            const v = z
              .object({
                code: z.string().min(3).max(50).toUpperCase(),
                discount: z.number().int().min(1).max(100),
                expiresAt: z.iso.datetime(),
                maxUses: z.number().int().min(1),
                active: z.boolean().default(true),
              })
              .parse(b);
            result = await tx.promoCode.upsert({
              where: { code: v.code },
              create: { ...v, expiresAt: new Date(v.expiresAt) },
              update: { ...v, expiresAt: new Date(v.expiresAt) },
            });
          } else if (id === "knowledge-base") {
            const v = z
              .object({
                slug: z.string().regex(/^[a-z0-9-]+$/),
                title: z.string().min(1).max(200),
                body: z.string().min(10).max(20000),
                published: z.boolean().default(true),
              })
              .parse(b);
            result = await tx.knowledgeArticle.upsert({
              where: { slug: v.slug },
              create: v,
              update: v,
            });
          } else if (id === "settings" || id === "bot") {
            const v = z
              .object({
                key: z.enum(["vatRates", "botEnabled", "aiEnabled"]),
                value: z.union([z.boolean(), z.array(numeric)]),
              })
              .parse(b);
            result = await tx.setting.upsert({
              where: { key: v.key },
              create: { key: v.key, value: jsonValue(v.value) },
              update: { value: jsonValue(v.value) },
            });
          } else if (id === "leads") {
            const v = z
              .object({
                id: z.string(),
                reply: z.string().min(1).max(5000),
                status: z.enum(["open", "closed"]).default("closed"),
              })
              .parse(b);
            const request = await tx.supportRequest.update({
              where: { id: v.id },
              data: { reply: v.reply, status: v.status },
            });
            if (request.userId)
              await tx.notification.create({
                data: {
                  id: token(),
                  userId: request.userId,
                  text: `Ответ поддержки MarginTools: ${v.reply}`,
                },
              });
            result = request;
          } else if (id === "test-subscription") {
            if (!testBillingEnabled())
              throw new Error("Только тестовое окружение");
            const v = z
              .object({
                workspaceId: z.string(),
                planCode: z.enum(["free", "pro", "business"]),
                days: z.number().int().min(1).max(365),
              })
              .parse(b);
            result = await tx.subscription.update({
              where: { workspaceId: v.workspaceId },
              data: {
                planCode: v.planCode,
                expiresAt: new Date(Date.now() + v.days * 86400000),
              },
            });
          } else throw new Error("Действие не поддерживается");
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: `admin.${id}`,
              targetId: b.id || b.code || b.slug || b.key || b.workspaceId,
            },
          });
          return result;
        });
        return ok(result);
      }
    }
    return fail("Маршрут не найден", 404);
  } catch (e) {
    if (e instanceof ZodError)
      return fail(
        e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      );
    if (e instanceof LimitError)
      return NextResponse.json(
        {
          error: e.message,
          feature: e.feature,
          limit: e.limit,
          action: "/pricing/",
        },
        { status: 403 },
      );
    if (e instanceof Error && e.message === "RATE_LIMIT")
      return fail("Слишком много запросов. Попробуйте позже.", 429);
    if (e instanceof Error && e.message === "NOT_FOUND")
      return fail("Запись не найдена", 404);
    if (
      e instanceof Error &&
      [
        "PrismaClientKnownRequestError",
        "PrismaClientUnknownRequestError",
        "PrismaClientInitializationError",
      ].includes(e.name)
    ) {
      try {
        await db.auditLog.create({
          data: { action: "error.api", targetId: resource },
        });
      } catch {}
      return fail(
        "Не удалось выполнить запрос. Проверьте подключение базы данных или повторите позже.",
        503,
      );
    }
    return fail(
      e instanceof Error ? e.message : "Не удалось выполнить действие",
    );
  }
}
export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
