import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
const file = "/tmp/margintools-amvera-verify.env";
await writeFile(
  file,
  [
    "NODE_ENV=production",
    "PORT=3000",
    "APP_URL=https://margintools.example.test",
    "DATABASE_URL=postgresql://margintools:local_dev_only@postgres:5432/margintools_amvera_verify",
    "STORAGE_MODE=local",
    "PRIVATE_STORAGE_DIR=/data/private",
    "ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true",
    "STAGING_MODE=true",
    "STAGING_BASIC_AUTH_USER=local-verification",
    `STAGING_BASIC_AUTH_PASSWORD=${randomBytes(32).toString("hex")}`,
    "BILLING_MODE=disabled",
    "TEST_BILLING_ENABLED=false",
    "SEED_DEMO=false",
  ].join("\n") + "\n",
  { mode: 0o600 },
);
console.log(
  "Проверочное окружение создано в /tmp; значения секретов не выведены.",
);
