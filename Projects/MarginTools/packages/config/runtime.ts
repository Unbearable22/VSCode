import path from "node:path";

export function localStorageAllowed(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  return (
    env.NODE_ENV !== "production" ||
    env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION === "true"
  );
}

export function privateStorageDir(
  projectRoot: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const configured = env.PRIVATE_STORAGE_DIR;
  if (configured && !path.isAbsolute(configured))
    throw new Error("PRIVATE_STORAGE_DIR должен быть абсолютным путём.");
  const directory = path.resolve(
    /* turbopackIgnore: true */ configured ||
      path.join(projectRoot, "data/private"),
  );
  const publicRoot = path.join(projectRoot, "apps/web/public");
  if (
    directory === path.parse(directory).root ||
    directory === publicRoot ||
    directory.startsWith(publicRoot + path.sep)
  )
    throw new Error(
      "Каталог приватных файлов не может быть корнем диска или публичным каталогом сайта.",
    );
  return directory;
}

export function validateRuntime(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (!env.DATABASE_URL) throw new Error("Укажите DATABASE_URL.");
  if (!env.APP_URL) throw new Error("Укажите APP_URL.");
  const url = new URL(env.APP_URL);
  if (env.NODE_ENV === "production" && url.protocol !== "https:")
    throw new Error("Для production APP_URL должен использовать HTTPS.");
  if (env.STAGING_MODE === "true") {
    if (
      !env.STAGING_BASIC_AUTH_USER ||
      !env.STAGING_BASIC_AUTH_PASSWORD ||
      env.STAGING_BASIC_AUTH_PASSWORD.length < 16 ||
      env.STAGING_BASIC_AUTH_USER.includes(":")
    )
      throw new Error(
        "Для STAGING_MODE нужны STAGING_BASIC_AUTH_USER и пароль не короче 16 символов.",
      );
  }
  if (env.STORAGE_MODE === "s3") {
    for (const key of [
      "S3_ENDPOINT",
      "S3_BUCKET",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
    ])
      if (!env[key]) throw new Error(`Укажите ${key}.`);
  } else {
    if (env.STORAGE_MODE !== "local")
      throw new Error("STORAGE_MODE должен быть local или s3.");
    if (!localStorageAllowed(env))
      throw new Error(
        "Для production настройте приватное S3-хранилище или явно разрешите локальное хранение.",
      );
  }
}
