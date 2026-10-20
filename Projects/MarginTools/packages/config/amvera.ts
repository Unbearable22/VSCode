export function configureAmveraStaging(
  env: Record<string, string | undefined>,
) {
  Object.assign(env, {
    NODE_ENV: "production",
    PORT: "3000",
    APP_URL: "https://margintoolsweb-kirillkostyuk.msk1.amvera.tech",
    STAGING_MODE: "true",
    STORAGE_MODE: "local",
    PRIVATE_STORAGE_DIR: "/data/private",
    ALLOW_LOCAL_STORAGE_IN_PRODUCTION: "true",
    BILLING_MODE: "disabled",
    TEST_BILLING_ENABLED: "false",
    SEED_DEMO: "false",
  });
}
