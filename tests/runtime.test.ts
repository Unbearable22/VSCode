import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../apps/web/proxy";
import { configureAmveraStaging } from "../packages/config/amvera";
import {
  privateStorageDir,
  localStorageAllowed,
  validateRuntime,
} from "../packages/config/runtime";
const env = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://example/db",
  APP_URL: "https://example.test",
  STORAGE_MODE: "local",
};
afterEach(() => vi.unstubAllEnvs());
describe("Развёртывание", () => {
  it("принудительно защищает проект Amvera и блокирует запуск без секретов", () => {
    const settings: Record<string, string | undefined> = {
      STAGING_MODE: "false",
      NODE_ENV: "development",
      BILLING_MODE: "test",
      TEST_BILLING_ENABLED: "true",
    };
    configureAmveraStaging(settings);
    expect(settings.STAGING_MODE).toBe("true");
    expect(settings.NODE_ENV).toBe("production");
    expect(settings.PRIVATE_STORAGE_DIR).toBe("/data/private");
    expect(settings.BILLING_MODE).toBe("disabled");
    expect(settings.TEST_BILLING_ENABLED).toBe("false");
    expect(settings.APP_URL).toBe(
      "https://margintoolsweb-kirillkostyuk.msk1.amvera.tech",
    );
    expect(() => validateRuntime(settings)).toThrow("DATABASE_URL");
    settings.DATABASE_URL = "postgresql://example/db";
    expect(() => validateRuntime(settings)).toThrow("STAGING_BASIC_AUTH");
  });
  it("разрешает локальный production только по точному явному флагу", () => {
    expect(localStorageAllowed(env)).toBe(false);
    expect(
      localStorageAllowed({ ...env, ALLOW_LOCAL_STORAGE_IN_PRODUCTION: "1" }),
    ).toBe(false);
    expect(() => validateRuntime(env)).toThrow("S3");
    expect(() =>
      validateRuntime({ ...env, ALLOW_LOCAL_STORAGE_IN_PRODUCTION: "true" }),
    ).not.toThrow();
    expect(() => validateRuntime({ ...env, STORAGE_MODE: "s3" })).toThrow(
      "S3_ENDPOINT",
    );
  });
  it("проверяет абсолютный приватный путь и не меняет корень исходников", () => {
    expect(
      privateStorageDir("/app", { PRIVATE_STORAGE_DIR: "/data/private" }),
    ).toBe("/data/private");
    expect(privateStorageDir("/app", {})).toBe("/app/data/private");
    expect(() =>
      privateStorageDir("/app", { PRIVATE_STORAGE_DIR: "data/private" }),
    ).toThrow("абсолютным");
    expect(() =>
      privateStorageDir("/app", {
        PRIVATE_STORAGE_DIR: "/app/apps/web/public/files",
      }),
    ).toThrow("публичным");
  });
  it("не запускает staging без пароля, базы и HTTPS-адреса", () => {
    const staging = {
      ...env,
      ALLOW_LOCAL_STORAGE_IN_PRODUCTION: "true",
      STAGING_MODE: "true",
    };
    expect(() => validateRuntime(staging)).toThrow("STAGING_BASIC_AUTH");
    expect(() => validateRuntime({ ...staging, DATABASE_URL: "" })).toThrow(
      "DATABASE_URL",
    );
    expect(() =>
      validateRuntime({ ...staging, APP_URL: "http://example.test" }),
    ).toThrow("HTTPS");
  });
  it("закрывает страницы, API и файлы, отдаёт noindex и закрытый robots", () => {
    vi.stubEnv("STAGING_MODE", "true");
    vi.stubEnv("STAGING_BASIC_AUTH_USER", "tester");
    vi.stubEnv("STAGING_BASIC_AUTH_PASSWORD", "test-only-long-password");
    for (const url of [
      "/",
      "/api/me",
      "/share/token",
      "/_next/static/file.js",
      "/data/private/file.pdf",
    ]) {
      const response = proxy(new NextRequest(`https://example.test${url}`));
      expect(response.status).toBe(401);
      expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    }
    const authorization =
      "Basic " +
      Buffer.from("tester:test-only-long-password").toString("base64");
    const permitted = proxy(
      new NextRequest("https://example.test", { headers: { authorization } }),
    );
    expect(permitted.status).toBe(200);
    expect(permitted.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(
      proxy(new NextRequest("https://example.test/robots.txt")).status,
    ).toBe(200);
    vi.stubEnv("STAGING_BASIC_AUTH_PASSWORD", "");
    expect(proxy(new NextRequest("https://example.test")).status).toBe(503);
    vi.stubEnv("STAGING_MODE", "false");
    expect(
      proxy(new NextRequest("https://example.test")).headers.get(
        "X-Robots-Tag",
      ),
    ).toBeNull();
  });
});
