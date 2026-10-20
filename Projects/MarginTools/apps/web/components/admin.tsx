"use client";
import { useState } from "react";
import { Plus, Save, ShieldCheck, Edit, Check, Send } from "lucide-react";
import {
  api,
  useData,
  Field,
  TextField,
  Select,
  Message,
  Busy,
  Empty,
  Modal,
  IconButton,
} from "./ui";
import { rub } from "./proposal-view";
const names: Record<string, string> = {
  dashboard: "Обзор продукта",
  users: "Пользователи",
  subscriptions: "Подписки",
  payments: "Платежи",
  "promo-codes": "Промокоды",
  templates: "Шаблоны КП",
  "knowledge-base": "База знаний",
  bot: "Telegram и ИИ",
  leads: "Поддержка и обращения",
  analytics: "Аналитика",
  audit: "Журнал изменений",
  settings: "Настройки продукта",
};
export function Admin({ section }: { section: string }) {
  const [refresh, setRefresh] = useState(0),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [editing, setEditing] = useState<any>(null),
    [target, setTarget] = useState(""),
    [busy, setBusy] = useState(false);
  const {
    data,
    loading,
    error: loadError,
  } = useData(`admin/${section}`, refresh);
  const edit = (resource: string, value: any) => {
    setTarget(resource);
    setEditing(value);
    setError("");
  };
  const submit = async () => {
    setBusy(true);
    try {
      let payload = { ...editing };
      if (target === "promo-codes")
        payload.expiresAt = new Date(payload.expiresAt).toISOString();
      await api(`admin/${target}`, "POST", payload);
      setEditing(null);
      setRefresh((r) => r + 1);
      setMessage("Изменения сохранены в журнале");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const action = async (path: string, body: any) => {
    try {
      await api(`admin/${path}`, "POST", body);
      setRefresh((r) => r + 1);
      setMessage("Изменения сохранены в журнале");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  let columns: string[] = [];
  const rows = Array.isArray(data) ? data : [];
  switch (section) {
    case "users":
      columns = ["name", "email", "role", "blocked", "createdAt"];
      break;
    case "subscriptions":
      columns = ["workspaceId", "planCode", "expiresAt", "autoRenew"];
      break;
    case "payments":
      columns = ["id", "planCode", "amount", "status", "provider", "createdAt"];
      break;
    case "promo-codes":
      columns = ["code", "discount", "uses", "maxUses", "expiresAt", "active"];
      break;
    case "knowledge-base":
      columns = ["title", "slug", "published", "updatedAt"];
      break;
    case "leads":
      columns = ["email", "text", "reply", "status", "createdAt"];
      break;
    case "analytics":
      columns = ["name", "category", "_count"];
      break;
    case "audit":
      columns = ["action", "actorId", "targetId", "createdAt"];
      break;
    case "templates":
      columns = ["name", "code", "renderer", "enabled"];
      break;
  }
  return (
    <>
      <div className="page-heading heading-actions">
        <h1>{names[section] || section}</h1>
        {section === "promo-codes" && (
          <button
            className="button primary"
            onClick={() =>
              edit("promo-codes", {
                code: "",
                discount: 10,
                expiresAt: new Date(Date.now() + 30 * 86400000)
                  .toISOString()
                  .slice(0, 16),
                maxUses: 100,
                active: true,
              })
            }
          >
            <Plus size={16} />
            Промокод
          </button>
        )}
        {section === "knowledge-base" && (
          <button
            className="button primary"
            onClick={() =>
              edit("knowledge-base", {
                slug: "",
                title: "",
                body: "",
                published: true,
              })
            }
          >
            <Plus size={16} />
            Статья
          </button>
        )}
      </div>
      <Message error>{error || loadError}</Message>
      <Message>{message}</Message>
      {loading ? (
        <Busy />
      ) : section === "dashboard" ? (
        <div className="stats-band">
          {Object.entries(data || {}).map(([k, v]) => (
            <div key={k}>
              <span>
                {
                  {
                    users: "Пользователи",
                    deals: "Сделки",
                    proposals: "КП",
                    payments: "Подтверждённые тестовые оплаты",
                    errors: "Служебные ошибки",
                  }[k]
                }
              </span>
              <strong>{String(v)}</strong>
            </div>
          ))}
        </div>
      ) : section === "settings" ? (
        <>
          <h2>Тарифы и лимиты</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Тариф</th>
                  <th>Месяц</th>
                  <th>Год</th>
                  <th>Расчёты</th>
                  <th>Сделки</th>
                  <th>PDF</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.plans.map((p: any) => (
                  <tr key={p.code}>
                    <td>{p.name}</td>
                    <td>{rub(p.monthlyPrice)}</td>
                    <td>{rub(p.annualPrice)}</td>
                    <td>{p.limits.calculations}</td>
                    <td>{p.limits.deals}</td>
                    <td>{p.limits.pdf}</td>
                    <td>
                      <IconButton
                        label="Редактировать тариф"
                        onClick={() => edit("plans", p)}
                      >
                        <Edit size={16} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Настройки расчётов</h2>
          {data?.settings
            .filter((s: any) => s.key === "vatRates")
            .map((s: any) => (
              <div className="setting-row" key={s.key}>
                <span>Предустановки НДС: {s.value.join(", ")}%</span>
                <button
                  className="button"
                  onClick={() =>
                    edit("settings", { key: "vatRates", value: s.value })
                  }
                >
                  Изменить
                </button>
              </div>
            ))}
        </>
      ) : section === "bot" ? (
        <>
          <div className="stats-band">
            <div>
              <span>Telegram</span>
              <strong>{data?.configured ? "Подключён" : "Не настроен"}</strong>
            </div>
            <div>
              <span>ИИ-провайдер</span>
              <strong>
                {data?.aiConfigured ? "Подключён" : "Не настроен"}
              </strong>
            </div>
            <div>
              <span>Диалоги</span>
              <strong>{data?.conversations}</strong>
            </div>
          </div>
          {["botEnabled", "aiEnabled"].map((k) => (
            <label className="check-field" key={k}>
              <input
                type="checkbox"
                checked={
                  data?.settings.find((s: any) => s.key === k)?.value !== false
                }
                onChange={(e) =>
                  action("bot", { key: k, value: e.target.checked })
                }
              />
              {k === "botEnabled" ? "Бот включён" : "ИИ включён"}
            </label>
          ))}
          <h2>Оценка расходов ИИ</h2>
          {data?.usage?.length ? <div className="table-scroll"><table><thead><tr><th>Валюта</th><th>Запросы</th><th>Токены</th><th>Оценка стоимости</th></tr></thead><tbody>{data.usage.map((u:any)=><tr key={u.currency}><td>{u.currency}</td><td>{u._count}</td><td>{u._sum.tokens||0}</td><td>{u._sum.cost||0}</td></tr>)}</tbody></table></div> : <Empty title="Запросов ИИ пока нет"/>}
        </>
      ) : !rows.length ? (
        <Empty title="Нет записей" />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((k) => (
                  <th key={k}>{columnLabels[k] || k}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any, n: number) => (
                <tr key={r.id || r.code || r.slug || n}>
                  {columns.map((k) => (
                    <td key={k}>
                      {typeof r[k] === "boolean"
                        ? r[k]
                          ? "Да"
                          : "Нет"
                        : k === "amount"
                          ? rub(r[k])
                          : k.endsWith("At") && r[k]
                            ? new Date(r[k]).toLocaleDateString("ru-RU")
                            : String(r[k] ?? "—")}
                    </td>
                  ))}
                  <td className="action-cell">
                    {section === "users" && (
                      <button
                        className="button"
                        onClick={() =>
                          action("users", { id: r.id, blocked: !r.blocked })
                        }
                      >
                        {r.blocked ? "Разблокировать" : "Блокировать"}
                      </button>
                    )}
                    {section === "subscriptions" && (
                      <IconButton
                        label="Выдать тестовый доступ"
                        onClick={() =>
                          edit("test-subscription", {
                            workspaceId: r.workspaceId,
                            planCode: r.planCode,
                            days: 30,
                          })
                        }
                      >
                        <ShieldCheck size={16} />
                      </IconButton>
                    )}
                    {["promo-codes", "knowledge-base", "templates"].includes(section) && (
                      <IconButton
                        label="Редактировать"
                        onClick={() =>
                          edit(
                            section,
                            section === "promo-codes"
                              ? {
                                  ...r,
                                  expiresAt: new Date(r.expiresAt)
                                    .toISOString()
                                    .slice(0, 16),
                                }
                              : r,
                          )
                        }
                      >
                        <Edit size={16} />
                      </IconButton>
                    )}
                    {section === "leads" && (
                      <IconButton
                        label="Ответить"
                        onClick={() =>
                          edit("leads", {
                            id: r.id,
                            reply: r.reply,
                            status: "closed",
                          })
                        }
                      >
                        <Send size={16} />
                      </IconButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Modal title="Редактирование" onClose={() => setEditing(null)}>
          {target === "plans" ? (
            <>
              <Field
                label="Название"
                value={editing.name}
                onChange={(e) =>
                  setEditing((v: any) => ({ ...v, name: e.target.value }))
                }
              />
              <div className="form-grid">
                {[
                  ["monthlyPrice", "Цена за месяц, ₽"],
                  ["annualPrice", "Цена за год, ₽"],
                ].map(([k, l]) => (
                  <Field
                    key={k}
                    label={l}
                    type="number"
                    min="0"
                    value={editing[k]}
                    onChange={(e) =>
                      setEditing((v: any) => ({
                        ...v,
                        [k]: Number(e.target.value),
                      }))
                    }
                  />
                ))}
                {["calculations", "deals", "pdf", "products"].map((k) => (
                  <Field
                    key={k}
                    label={
                      {
                        calculations: "Расчёты",
                        deals: "Сделки",
                        pdf: "PDF в месяц",
                        products: "Каталог товаров",
                      }[k] || k
                    }
                    type="number"
                    min="0"
                    value={editing.limits[k]}
                    onChange={(e) =>
                      setEditing((v: any) => ({
                        ...v,
                        limits: { ...v.limits, [k]: Number(e.target.value) },
                      }))
                    }
                  />
                ))}
              </div>
              {["xlsx", "logo"].map((k) => (
                <label className="check-field" key={k}>
                  <input
                    type="checkbox"
                    checked={editing.limits[k]}
                    onChange={(e) =>
                      setEditing((v: any) => ({
                        ...v,
                        limits: { ...v.limits, [k]: e.target.checked },
                      }))
                    }
                  />
                  {k === "xlsx" ? "Экспорт XLSX" : "Свой логотип"}
                </label>
              ))}
              {["standard", "compact", "presentation"].map((k) => (
                <label className="check-field" key={k}>
                  <input
                    type="checkbox"
                    checked={editing.limits.templates.includes(k)}
                    onChange={(e) =>
                      setEditing((v: any) => ({
                        ...v,
                        limits: {
                          ...v.limits,
                          templates: e.target.checked
                            ? [...v.limits.templates, k]
                            : v.limits.templates.filter((t: string) => t !== k),
                        },
                      }))
                    }
                  />
                  {k}
                </label>
              ))}
            </>
          ) : target === "settings" ? (
            <Field
              label="Ставки НДС через запятую"
              value={editing.value.join(", ")}
              onChange={(e) =>
                setEditing((v: any) => ({
                  ...v,
                  value: e.target.value.split(",").map((s) => s.trim()),
                }))
              }
            />
          ) : (
            <div className="form-grid">
              {Object.entries(editing)
                .filter(
                  ([k]) =>
                    !["id", "uses", "createdAt", "updatedAt", "renderer"].includes(k),
                )
                .map(([k, v]) =>
                  typeof v === "boolean" ? (
                    <label className="check-field" key={k}>
                      <input
                        type="checkbox"
                        checked={v}
                        onChange={(e) =>
                          setEditing((f: any) => ({
                            ...f,
                            [k]: e.target.checked,
                          }))
                        }
                      />
                      {columnLabels[k] || k}
                    </label>
                  ) : ["body", "reply"].includes(k) ? (
                    <TextField
                      key={k}
                      label={columnLabels[k] || k}
                      value={String(v)}
                      onChange={(e) =>
                        setEditing((f: any) => ({ ...f, [k]: e.target.value }))
                      }
                    />
                  ) : k === "planCode" ? (
                    <Select
                      key={k}
                      label="Тариф"
                      value={String(v)}
                      onChange={(e) =>
                        setEditing((f: any) => ({ ...f, [k]: e.target.value }))
                      }
                    >
                      <option value="free">Бесплатный</option>
                      <option value="pro">Pro</option>
                      <option value="business">Business</option>
                    </Select>
                  ) : (
                    <Field
                      key={k}
                      label={columnLabels[k] || k}
                      type={
                        k === "expiresAt"
                          ? "datetime-local"
                          : typeof v === "number"
                            ? "number"
                            : "text"
                      }
                      value={String(v)}
                      readOnly={k === "workspaceId"}
                      onChange={(e) =>
                        setEditing((f: any) => ({
                          ...f,
                          [k]:
                            typeof v === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                        }))
                      }
                    />
                  ),
                )}
            </div>
          )}
          <Message error>{error}</Message>
          <button className="button primary" disabled={busy} onClick={submit}>
            <Save size={16} />
            {busy ? "Сохранение…" : "Сохранить"}
          </button>
        </Modal>
      )}
    </>
  );
}
const columnLabels: Record<string, string> = {
  name: "Имя",
  email: "Email",
  role: "Роль",
  blocked: "Блокировка",
  createdAt: "Создано",
  workspaceId: "Пространство",
  planCode: "Тариф",
  expiresAt: "Окончание",
  autoRenew: "Автопродление",
  id: "Заказ",
  amount: "Сумма",
  status: "Статус",
  provider: "Провайдер",
  code: "Код",
  discount: "Скидка, %",
  uses: "Использовано",
  maxUses: "Лимит",
  active: "Активен",
  title: "Заголовок",
  slug: "Адрес",
  published: "Опубликовано",
  updatedAt: "Изменено",
  text: "Обращение",
  reply: "Ответ",
  category: "Категория",
  _count: "Событий",
  action: "Действие",
  actorId: "Инициатор",
  targetId: "Объект",
  body: "Текст статьи",
  days: "Дней",
  renderer: "Форматы",
  enabled: "Доступен",
};
