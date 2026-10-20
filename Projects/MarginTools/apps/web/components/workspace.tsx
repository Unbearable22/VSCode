"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  ArrowRight,
  Trash2,
  Copy,
  FileText,
  Download,
  Share2,
  ExternalLink,
  Save,
  Unlink,
  Check,
  RefreshCw,
} from "lucide-react";
import {
  api,
  useData,
  Field,
  TextField,
  Select,
  Message,
  Busy,
  Empty,
  IconButton,
  Modal,
} from "./ui";
import { rub, ProposalView } from "./proposal-view";
import { ProposalModal } from "./deal-editor";
import { dealSchema } from "@mt/contracts";
import { dealTotals } from "@mt/calculations";
export function Dashboard({ me }: { me: any }) {
  const { data, error, loading } = useData("dashboard");
  return (
    <>
      <div className="page-heading heading-actions">
        <div className="eyebrow">
          РАБОЧЕЕ ПРОСТРАНСТВО
          <h1>{me?.name ? `Здравствуйте, ${me.name}` : "Обзор"}</h1>
        </div>
        <Link className="button primary" href="/app/deals/new/">
          <Plus size={16} />
          Новая сделка
        </Link>
      </div>
      <div className="stats-band">
        {[
          ["Расчёты", me.counts.calculations, me.plan.limits.calculations],
          ["Сделки", me.counts.deals, me.plan.limits.deals],
          ["Коммерческие предложения", me.counts.proposals, null],
          ["Тариф", me.plan.name, null],
        ].map(([l, n, limit]) => (
          <div key={String(l)}>
            <span>{l}</span>
            <strong>{n}</strong>
            {limit !== null && <small>из {limit} доступных</small>}
          </div>
        ))}
      </div>
      <Message error>{error}</Message>
      {loading ? (
        <Busy />
      ) : (
        <>
          <RecentSection
            title="Последние сделки"
            href="/app/deals/"
            rows={data?.deals}
            render={(d) => (
              <>
                <Link href={`/app/deals/${d.id}/`}>{d.title}</Link>
                <span>{rub(dealTotals(dealSchema.parse(d)).total)}</span>
                <small>
                  {new Date(d.updatedAt).toLocaleDateString("ru-RU")}
                </small>
              </>
            )}
          />
          <RecentSection
            title="Коммерческие предложения"
            href="/app/proposals/"
            rows={data?.proposals}
            render={(p) => (
              <>
                <Link href="/app/proposals/">{p.title}</Link>
                <span className="badge">{statusNames[p.status]}</span>
                <small>
                  {new Date(p.createdAt).toLocaleDateString("ru-RU")}
                </small>
              </>
            )}
          />
          <RecentSection
            title="Последние расчёты"
            href="/app/calculations/"
            rows={data?.calculations}
            render={(c) => (
              <>
                <Link
                  href={`/calculators/${c.kind}/?values=${encodeURIComponent(JSON.stringify(c.input))}`}
                >
                  {c.title}
                </Link>
                <small>
                  {new Date(c.createdAt).toLocaleDateString("ru-RU")}
                </small>
              </>
            )}
          />
        </>
      )}
      <p className="muted small">
        Суммы КП являются предложениями клиентам, а не фактической выручкой.
      </p>
    </>
  );
}
function RecentSection({
  title,
  href,
  rows,
  render,
}: {
  title: string;
  href: string;
  rows?: any[];
  render: (r: any) => React.ReactNode;
}) {
  return (
    <section className="workspace-section">
      <header>
        <h2>{title}</h2>
        <Link href={href}>
          Все <ArrowRight size={15} />
        </Link>
      </header>
      {rows?.length ? (
        <div className="recent-list">
          {rows.map((r) => (
            <div className="recent-row" key={r.id}>
              {render(r)}
            </div>
          ))}
        </div>
      ) : (
        <Empty title="Пока нет записей" />
      )}
    </section>
  );
}
export function Records({ kind }: { kind: "calculations" | "deals" }) {
  const [refresh, setRefresh] = useState(0),
    [error, setError] = useState("");
  const { data, loading, error: loadError } = useData<any[]>(kind, refresh);
  const remove = async (id: string) => {
    try {
      await api(`${kind}/${id}`, "DELETE");
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const duplicate = async (d: any) => {
    try {
      await api("deals", "POST", {
        ...dealSchema.parse(d),
        title: d.title + " (копия)",
      });
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <div className="page-heading heading-actions">
        <h1>{kind === "deals" ? "Сделки" : "Сохранённые расчёты"}</h1>
        <Link
          className="button primary"
          href={kind === "deals" ? "/app/deals/new/" : "/calculators/margin/"}
        >
          <Plus size={16} />
          {kind === "deals" ? "Новая сделка" : "Новый расчёт"}
        </Link>
      </div>
      <Message error>{error || loadError}</Message>
      {loading ? (
        <Busy />
      ) : !data?.length ? (
        <Empty title="Здесь появятся ваши записи" />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Название</th>
                <th>Сумма</th>
                <th>Дата</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link
                      href={
                        kind === "deals"
                          ? `/app/deals/${d.id}/`
                          : `/calculators/${d.kind}/?values=${encodeURIComponent(JSON.stringify(d.input))}`
                      }
                    >
                      {d.title}
                    </Link>
                    <small>
                      {kind === "deals" ? `${d.items.length} позиций` : d.kind}
                    </small>
                  </td>
                  <td className="numeric">
                    {kind === "deals"
                      ? rub(dealTotals(dealSchema.parse(d)).total)
                      : rub(
                          d.result.price ||
                            d.result.total ||
                            d.result.profit ||
                            0,
                        )}
                  </td>
                  <td>{new Date(d.createdAt).toLocaleDateString("ru-RU")}</td>
                  <td className="action-cell">
                    {kind === "deals" && (
                      <IconButton
                        label="Копировать сделку"
                        onClick={() => duplicate(d)}
                      >
                        <Copy size={16} />
                      </IconButton>
                    )}
                    <IconButton
                      label="Удалить запись"
                      onClick={() => remove(d.id)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
const statusNames: Record<string, string> = {
  draft: "Черновик",
  sent: "Отправлено",
  accepted: "Принято",
  declined: "Отклонено",
};
export function Proposals() {
  const [refresh, setRefresh] = useState(0),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [version, setVersion] = useState(""),
    [newVersion, setNewVersion] = useState(false),
    [sourceDeal, setSourceDeal] = useState("");
  const {
      data,
      loading,
      error: loadError,
    } = useData<any[]>("proposals", refresh),
    { data: deals } = useData<any[]>("deals");
  const reload = () => setRefresh((r) => r + 1);
  useEffect(() => {
    if (selected && data) {
      const p = data.find((p) => p.id === selected.id);
      setSelected(p || null);
    }
  }, [data]);
  const current =
    selected?.versions.find((v: any) => v.id === version) ||
    selected?.versions[0];
  const share = async () => {
    try {
      const l = await api(`proposals/${selected.id}/share`, "POST", {
        versionId: current.id,
        days: 14,
      });
      await navigator.clipboard.writeText(
        `${window.location.origin}/share/${l.token}/`,
      );
      setMessage("Публичная ссылка скопирована");
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const revoke = async (id: string) => {
    try {
      await api(`links/${id}`, "DELETE");
      setMessage("Ссылка отозвана");
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const download = async () => {
    try {
      const r = await fetch(
        `/api/proposals/${selected.id}/pdf?version=${current.id}`,
      );
      if (!r.ok) throw new Error((await r.json()).error);
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "commercial-proposal.pdf";
      a.click();
      URL.revokeObjectURL(url);
      setMessage("PDF подготовлен");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <div className="page-heading heading-actions">
        <h1>Коммерческие предложения</h1>
        <Link className="button primary" href="/app/deals/">
          <Plus size={16} />
          Из сделки
        </Link>
      </div>
      <Message error>{error || loadError}</Message>
      <Message>{message}</Message>
      {loading ? (
        <Busy />
      ) : !data?.length ? (
        <Empty title="Пока нет коммерческих предложений">
          <Link href="/app/deals/new/">Создать сделку</Link>
        </Empty>
      ) : (
        <div className="proposal-workspace">
          <div className="proposal-list">
            {data.map((p) => (
              <button
                key={p.id}
                className={`proposal-list-item ${selected?.id === p.id ? "active" : ""}`}
                onClick={() => {
                  setSelected(p);
                  setVersion(p.versions[0].id);
                }}
              >
                <strong>{p.title}</strong>
                <span>
                  {statusNames[p.status]} · {p.versions.length} верс.
                </span>
                <small>
                  {new Date(p.createdAt).toLocaleDateString("ru-RU")}
                </small>
              </button>
            ))}
          </div>
          {selected && current ? (
            <div className="proposal-preview">
              <div className="preview-toolbar">
                <select
                  aria-label="Версия КП"
                  value={current.id}
                  onChange={(e) => setVersion(e.target.value)}
                >
                  {selected.versions.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      Версия {v.number}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Статус КП"
                  value={selected.status}
                  onChange={async (e) => {
                    try {
                      await api(`proposals/${selected.id}`, "PATCH", {
                        status: e.target.value,
                      });
                      reload();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  {Object.entries(statusNames).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <IconButton label="Скачать PDF" onClick={download}>
                  <Download size={18} />
                </IconButton>
                <IconButton label="Создать публичную ссылку" onClick={share}>
                  <Share2 size={18} />
                </IconButton>
                <IconButton
                  label="Новая версия"
                  onClick={() => setNewVersion(true)}
                >
                  <RefreshCw size={18} />
                </IconButton>
                <IconButton
                  label="Дублировать КП"
                  onClick={async () => {
                    try {
                      await api(
                        `proposals/${selected.id}/duplicate`,
                        "POST",
                        {},
                      );
                      reload();
                      setMessage("КП продублировано");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <Copy size={18} />
                </IconButton>
                <IconButton
                  label="Удалить КП"
                  onClick={async () => {
                    try {
                      await api(`proposals/${selected.id}`, "DELETE");
                      setSelected(null);
                      reload();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <Trash2 size={18} />
                </IconButton>
              </div>
              <ProposalView s={current.snapshot} logoUrl={`/api/proposals/${selected.id}/logo?version=${current.id}`} />
              {current.links.length > 0 && (
                <section className="link-list">
                  <h3>Публичные ссылки этой версии</h3>
                  {current.links.map((l: any) => (
                    <div key={l.id}>
                      <span>
                        {l.revokedAt
                          ? "Отозвана"
                          : new Date(l.expiresAt) < new Date()
                            ? "Истекла"
                            : `До ${new Date(l.expiresAt).toLocaleDateString("ru-RU")}`}{" "}
                        · {l.views} просмотров
                      </span>
                      {!l.revokedAt && (
                        <>
                          <a
                            href={`/share/${l.token}/`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Открыть КП"
                          >
                            <ExternalLink size={16} />
                          </a>
                          <IconButton
                            label="Отозвать ссылку"
                            onClick={() => revoke(l.id)}
                          >
                            <Unlink size={16} />
                          </IconButton>
                        </>
                      )}
                    </div>
                  ))}
                </section>
              )}
            </div>
          ) : (
            <Empty title="Выберите КП" />
          )}
        </div>
      )}
      {newVersion && !sourceDeal && (
        <Modal
          title="Выберите исходную сделку"
          onClose={() => setNewVersion(false)}
        >
          <Select
            label="Сделка для новой версии"
            value={sourceDeal}
            onChange={(e) => setSourceDeal(e.target.value)}
          >
            <option value="">Выберите сделку</option>
            {deals?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </Select>
        </Modal>
      )}
      {newVersion && sourceDeal && (
            <ProposalModal
              dealId={sourceDeal}
              title={selected.title}
              proposalId={selected.id}
              onClose={() => setNewVersion(false)}
              onCreated={() => {
                setNewVersion(false);
                reload();
              }}
            />
      )}
    </>
  );
}
export function Catalog({ kind }: { kind: "products" | "clients" }) {
  const [refresh, setRefresh] = useState(0),
    [edit, setEdit] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const { data, loading, error: loadError } = useData<any[]>(kind, refresh);
  const labels: Record<string, string> =
    kind === "products"
      ? {
          name: "Наименование",
          sku: "Артикул",
          unit: "Единица",
          cost: "Закупочная цена, ₽",
          price: "Цена продажи, ₽",
        }
      : {
          name: "Название клиента",
          contact: "Контактное лицо",
          email: "Email",
          phone: "Телефон",
          details: "Реквизиты",
          notes: "Заметки",
        };
  const submit = async () => {
    setBusy(true);
    try {
      await api(
        edit.id ? `${kind}/${edit.id}` : kind,
        edit.id ? "PUT" : "POST",
        edit,
      );
      setEdit(null);
      setRefresh((r) => r + 1);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading heading-actions">
        <h1>{kind === "products" ? "Каталог товаров" : "Клиенты"}</h1>
        <button
          className="button primary"
          onClick={() =>
            setEdit(
              Object.fromEntries(
                Object.keys(labels).map((k) => [
                  k,
                  k === "cost" || k === "price"
                    ? "0"
                    : k === "unit"
                      ? "шт."
                      : "",
                ]),
              ),
            )
          }
        >
          <Plus size={16} />
          Добавить
        </button>
      </div>
      <Message error>{error || loadError}</Message>
      {loading ? (
        <Busy />
      ) : !data?.length ? (
        <Empty title="Нет записей" />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Название</th>
                <th>{kind === "products" ? "Закупка" : "Контакт"}</th>
                <th>{kind === "products" ? "Продажа" : "Email"}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button className="text-button" onClick={() => setEdit(r)}>
                      {r.name}
                    </button>
                    <small>{r.sku || r.phone}</small>
                  </td>
                  <td>{kind === "products" ? rub(r.cost) : r.contact}</td>
                  <td>{kind === "products" ? rub(r.price) : r.email}</td>
                  <td>
                    <IconButton
                      label="Удалить"
                      onClick={async () => {
                        try {
                          await api(`${kind}/${r.id}`, "DELETE");
                          setRefresh((n) => n + 1);
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <Modal
          title={edit.id ? "Редактирование" : "Новая запись"}
          onClose={() => setEdit(null)}
        >
          <div className="form-grid">
            {Object.entries(labels).map(([k, l]) =>
              ["details", "notes"].includes(k) ? (
                <TextField
                  key={k}
                  label={l}
                  value={edit[k]}
                  onChange={(e) =>
                    setEdit((v: any) => ({ ...v, [k]: e.target.value }))
                  }
                />
              ) : (
                <Field
                  key={k}
                  label={l}
                  value={edit[k]}
                  inputMode={["cost", "price"].includes(k) ? "decimal" : "text"}
                  onChange={(e) =>
                    setEdit((v: any) => ({ ...v, [k]: e.target.value }))
                  }
                />
              ),
            )}
          </div>
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
export function Company() {
  const { data, error, loading } = useData("company");
  const [form, setForm] = useState<any>(null),
    [message, setMessage] = useState(""),
    [saveError, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  return (
    <>
      <div className="page-heading">
        <h1>Моя компания</h1>
      </div>
      <Message error>{error || saveError}</Message>
      <Message>{message}</Message>
      {loading || !form ? (
        <Busy />
      ) : (
        <form
          className="settings-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("company", "PUT", form);
              setMessage("Данные компании сохранены");
              setError("");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {Object.entries({
            name: "Название компании",
            details: "Реквизиты и адрес",
            contacts: "Контакты",
            paymentTerms: "Стандартные условия оплаты",
            deliveryTerms: "Стандартные условия поставки",
            warranty: "Гарантия",
          }).map(([k, l]) =>
            k === "name" ? (
              <Field
                key={k}
                label={l}
                value={form[k]}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, [k]: e.target.value }))
                }
              />
            ) : (
              <TextField
                key={k}
                label={l}
                value={form[k]}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, [k]: e.target.value }))
                }
              />
            ),
          )}
          <Field
            label="Логотип · PNG/JPEG до 2 МБ · Pro"
            type="file"
            accept="image/png,image/jpeg"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const data = new FormData();
              data.set("file", f);
              try {
                await api("company/logo", "POST", data);
                setMessage("Логотип загружен");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          <button className="button primary" disabled={busy}>
            <Save size={16} />
            {busy ? "Сохранение…" : "Сохранить"}
          </button>
        </form>
      )}
    </>
  );
}
export function Subscription() {
  const [refresh, setRefresh] = useState(0),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const { data, loading, error: loadError } = useData("subscription", refresh);
  const { data: plans } = useData("plans");
  const [period, setPeriod] = useState("month"),
    [promo, setPromo] = useState(""),
    [payment, setPayment] = useState<any>(null);
  useEffect(() => {
    if (data) {
      const id = new URLSearchParams(window.location.search).get("checkout");
      if (id) setPayment(data.payments.find((p: any) => p.id === id));
    }
  }, [data]);
  const buy = async (code: string) => {
    setBusy(true);
    try {
      const c = await api("subscription/checkout", "POST", {
        planCode: code,
        period,
        promoCode: promo || undefined,
      });
      setPayment(c.payment);
      setRefresh((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const pay = async (status: string) => {
    setBusy(true);
    try {
      await api("subscription/test", "POST", { paymentId: payment.id, status });
      setPayment(null);
      setRefresh((r) => r + 1);
      setMessage(
        status === "paid"
          ? "Тестовая оплата подтверждена, доступ активирован. Реальные деньги не списывались."
          : "Тестовый платёж отклонён. Доступ не выдан.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <h1>Подписка</h1>
      </div>
      <Message error>{error || loadError}</Message>
      <Message>{message}</Message>
      {loading ? (
        <Busy />
      ) : (
        <>
          <div className="subscription-summary">
            <div>
              <span className="muted">Текущий тариф</span>
              <h2>{data?.plan.name}</h2>
              <p>
                {data?.plan.subscription?.expiresAt
                  ? `Действует до ${new Date(data.plan.subscription.expiresAt).toLocaleDateString("ru-RU")}`
                  : "Без срока окончания"}
              </p>
            </div>
            <div>
              <span className="badge">Автопродление отключено</span>
              <p className="small muted">
                Тестовый режим не списывает реальные деньги.
              </p>
            </div>
          </div>
          <div className="segmented compact">
            <button
              className={period === "month" ? "active" : ""}
              onClick={() => setPeriod("month")}
            >
              Помесячно
            </button>
            <button
              className={period === "year" ? "active" : ""}
              onClick={() => setPeriod("year")}
            >
              Ежегодно
            </button>
          </div>
          <div className="plan-grid">
            {plans?.plans
              .filter((p: any) => p.code !== "free")
              .map((p: any) => (
                <div key={p.code} className="plan-item">
                  <h2>{p.name}</h2>
                  <div className="plan-price">
                    {rub(period === "year" ? p.annualPrice : p.monthlyPrice)}
                    <small> / {period === "year" ? "год" : "месяц"}</small>
                  </div>
                  <p>
                    {p.limits.deals} сделок · {p.limits.pdf} PDF в месяц
                  </p>
                  <button
                    className="button primary"
                    disabled={!data?.testBilling || busy}
                    onClick={() => buy(p.code)}
                  >
                    {data?.testBilling
                      ? "Тестовая покупка"
                      : "Покупка недоступна"}
                  </button>
                </div>
              ))}
          </div>
          <Field
            label="Промокод"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
          />
          <h2>История платежей</h2>
          {data?.payments.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Тариф</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p: any) => (
                    <tr key={p.id}>
                      <td>
                        {new Date(p.createdAt).toLocaleDateString("ru-RU")}
                      </td>
                      <td>{p.planCode} · тест</td>
                      <td>{rub(p.amount)}</td>
                      <td>
                        {
                          (
                            {
                              pending: "Ожидает",
                              paid: "Подтверждён",
                              failed: "Отклонён",
                            } as Record<string, string>
                          )[p.status]
                        }
                      </td>
                      <td>
                        {p.status === "pending" && (
                          <button
                            className="text-button"
                            onClick={() => setPayment(p)}
                          >
                            Открыть
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Платежей пока нет" />
          )}
        </>
      )}
      {payment && (
        <Modal
          title="Тестовая платёжная страница"
          onClose={() => setPayment(null)}
        >
          <p>
            Тариф {payment.planCode} · {rub(payment.amount)}
          </p>
          <p className="message">
            Это симуляция оплаты. Банковская карта не нужна, реальные деньги не
            списываются.
          </p>
          <div className="action-row">
            <button
              className="button primary"
              disabled={busy}
              onClick={() => pay("paid")}
            >
              <Check size={16} />
              Подтвердить тестовый платёж
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => pay("failed")}
            >
              Отклонить
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function Telegram() {
  const [refresh, setRefresh] = useState(0),
    [error, setError] = useState(""),
    [url, setUrl] = useState("");
  const { data, loading } = useData("telegram", refresh);
  return (
    <>
      <div className="page-heading">
        <h1>Telegram</h1>
      </div>
      <Message error>{error}</Message>
      {loading ? (
        <Busy />
      ) : (
        <div className="settings-form">
          <h2>{data.account ? "Аккаунт подключён" : "Подключение бота"}</h2>
          {!data.configured && (
            <Message>
              Бот ещё не настроен. Владелец должен указать токен и имя
              Telegram-бота.
            </Message>
          )}
          {data.account ? (
            <>
              <p>Telegram ID: {data.account.telegramId}</p>
              {[
                ["notifications", "Уведомления о подписке и поддержке"],
                ["marketing", "Полезные сообщения"],
              ].map(([k, l]) => (
                <label className="check-field" key={k}>
                  <input
                    type="checkbox"
                    checked={data.account[k]}
                    onChange={async (e) => {
                      try {
                        await api("telegram", "PATCH", {
                          notifications: data.account.notifications,
                          marketing: data.account.marketing,
                          [k]: e.target.checked,
                        });
                        setRefresh((r) => r + 1);
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  />
                  {l}
                </label>
              ))}
              <button
                className="button"
                onClick={async () => {
                  await api("telegram", "DELETE");
                  setRefresh((r) => r + 1);
                }}
              >
                <Unlink size={16} />
                Отключить
              </button>
            </>
          ) : (
            <button
              className="button primary"
              disabled={!data.configured}
              onClick={async () => {
                try {
                  const r = await api("telegram", "POST", {});
                  setUrl(r.url);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Получить ссылку подключения
            </button>
          )}
          {url && (
            <a
              className="button primary"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Открыть бота <ExternalLink size={16} />
            </a>
          )}
        </div>
      )}
    </>
  );
}
export function Settings({ me }: { me: any }) {
  const [name, setName] = useState(me.name),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState(false),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <>
      <div className="page-heading">
        <h1>Настройки</h1>
      </div>
      <div className="settings-form">
        <Field
          label="Имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field label="Email" value={me.email} readOnly />
        <Select label="Валюта" value="RUB" disabled>
          <option value="RUB">Российский рубль · ₽</option>
        </Select>
        <Message error>{error}</Message>
        <Message>{message}</Message>
        <button
          className="button primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api("settings", "PATCH", { name, currency: "RUB" });
              setMessage("Профиль сохранён");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Save size={16} />
          Сохранить
        </button>
        <hr />
        <h3>Ваши данные</h3>
        <a className="button" href="/api/settings/export">
          <Download size={16} />
          Экспорт данных
        </a>
        <button className="button danger" onClick={() => setDeleting(true)}>
          <Trash2 size={16} />
          Удалить аккаунт
        </button>
      </div>
      {deleting && (
        <Modal title="Удаление аккаунта" onClose={() => setDeleting(false)}>
          <p>
            Расчёты, сделки, КП и публичные ссылки будут удалены. Это действие
            нельзя отменить.
          </p>
          <Field
            label="Подтвердите паролем"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Message error>{error}</Message>
          <button
            className="button danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("settings", "DELETE", { password });
                router.push("/");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Удалить мои данные
          </button>
        </Modal>
      )}
    </>
  );
}
