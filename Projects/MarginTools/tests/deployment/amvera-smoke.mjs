import assert from "node:assert/strict";
import { readFile, writeFile, unlink, stat } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";

const base = "http://127.0.0.1:3000";
const authorization =
  "Basic " +
  Buffer.from(
    `${process.env.STAGING_BASIC_AUTH_USER}:${process.env.STAGING_BASIC_AUTH_PASSWORD}`,
  ).toString("base64");
let cookie = "";
async function request(path, method = "GET", data, authenticate = true) {
  return fetch(base + path, {
    method,
    headers: {
      ...(authenticate ? { authorization, cookie } : {}),
      ...(data
        ? { "Content-Type": "application/json", Origin: process.env.APP_URL }
        : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}
async function json(path, data) {
  const response = await request(path, "POST", data);
  assert.equal(response.status, 200, `API отказал: ${path}`);
  return response.json();
}
const statePath = "/data/.amvera-smoke.json";
if (process.argv[2] === "create") {
  for (const path of [
    "/",
    "/api/me",
    "/share/test",
    "/_next/static/test.js",
    "/data/private/test.pdf",
  ]) {
    const response = await request(path, "GET", undefined, false);
    assert.equal(response.status, 401);
    assert.match(response.headers.get("x-robots-tag"), /noindex/);
  }
  const robots = await request("/robots.txt", "GET", undefined, false);
  assert.match(await robots.text(), /Disallow: \//);
  const site = await request("/");
  assert.equal(site.status, 200);
  assert.match(site.headers.get("x-robots-tag"), /noindex/);
  assert.equal((await request("/api/me")).status, 403);
  assert.doesNotMatch(await (await request("/sitemap.xml")).text(), /<loc>/);
  const password = randomBytes(24).toString("hex");
  const registration = await request("/api/auth/register", "POST", {
    name: "Проверка Amvera",
    email: `amvera-${Date.now()}@example.test`,
    password,
    consent: true,
  });
  assert.equal(registration.status, 200);
  cookie = registration.headers.get("set-cookie").split(";")[0];
  const deal = await json("/api/deals", {
    title: "Проверка постоянного диска",
    items: [{ name: "Насос", quantity: "1", cost: "800", price: "1000" }],
  });
  const proposal = await json("/api/proposals", {
    dealId: deal.id,
    title: "Проверка PDF",
    template: "standard",
    validDays: 14,
  });
  const pdf = await request(`/api/proposals/${proposal.id}/pdf`);
  assert.equal(pdf.status, 200);
  assert.equal(
    Buffer.from(await pdf.arrayBuffer())
      .subarray(0, 4)
      .toString(),
    "%PDF",
  );
  const proposals = await (await request("/api/proposals")).json();
  const workspaceId = deal.workspaceId;
  assert.equal(typeof workspaceId, "string");
  const versionId = proposals.find((item) => item.id === proposal.id)
    .versions[0].id;
  const path = `/data/private/${workspaceId}/${versionId}.pdf`;
  const bytes = await readFile(path);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal(
    (
      await request(
        `/api/proposals/${proposal.id}/pdf`,
        "GET",
        undefined,
        false,
      )
    ).status,
    401,
  );
  const payment = await request("/api/subscription/checkout", "POST", {
    planCode: "pro",
    period: "month",
  });
  assert.notEqual(payment.status, 200);
  await writeFile(
    statePath,
    JSON.stringify({
      path,
      cookie,
      password,
      proposalId: proposal.id,
      hash: createHash("sha256").update(bytes).digest("hex"),
    }),
    { mode: 0o600 },
  );
  console.log(
    "Проверены: HTTP 3000, Basic Auth, noindex, закрытые файлы, серверный PDF, запись 0600, отключённая оплата.",
  );
} else {
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const bytes = await readFile(state.path);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), state.hash);
  cookie = state.cookie;
  assert.equal((await request("/api/me")).status, 200);
  assert.equal(
    (await request(`/api/proposals/${state.proposalId}/pdf`)).status,
    200,
  );
  const deletion = await request("/api/settings", "DELETE", {
    password: state.password,
  });
  assert.equal(deletion.status, 200);
  await unlink(statePath);
  console.log(
    "После пересоздания контейнера PDF сохранён побайтно, сессия действительна, выдача через API работает. Тестовый аккаунт удалён.",
  );
}
