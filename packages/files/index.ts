import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { localStorageAllowed, privateStorageDir } from "../config/runtime";
export const projectRoot =
  process.env.MARGINTOOLS_ROOT ||
  (path.basename(process.cwd()) === "web" &&
  path.basename(path.dirname(process.cwd())) === "apps"
    ? path.resolve(process.cwd(), "../..")
    : process.cwd());
const root = () => privateStorageDir(projectRoot);
const validateKey = (key: string) => {
  if (
    !/^[a-zA-Z0-9_/-]+\.(png|jpg|pdf)$/.test(key) ||
    key.startsWith("/") ||
    key.split("/").includes("..")
  )
    throw new Error("Недопустимый путь");
};
const requireLocal = () => {
  if (!localStorageAllowed())
    throw new Error("Для production настройте приватное S3-хранилище");
};
const s3 = () =>
  new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
  });
export async function storeFile(key: string, bytes: Buffer, type: string) {
  validateKey(key);
  if (process.env.STORAGE_MODE === "s3") {
    await s3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: type,
      }),
    );
    return;
  }
  requireLocal();
  await mkdir(path.dirname(path.join(root(), key)), {
    recursive: true,
    mode: 0o700,
  });
  await writeFile(path.join(root(), key), bytes, { mode: 0o600 });
}
export async function getFile(key: string) {
  validateKey(key);
  if (process.env.STORAGE_MODE === "s3") {
    const r = await s3().send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    );
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  requireLocal();
  return readFile(path.join(root(), key));
}
export async function deleteWorkspaceFiles(workspaceId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId))
    throw new Error("Недопустимый идентификатор");
  if (process.env.STORAGE_MODE !== "s3") {
    requireLocal();
    await rm(path.join(root(), workspaceId), { recursive: true, force: true });
    return;
  }
  const client = s3();
  let continuation: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET,
        Prefix: `${workspaceId}/`,
        ContinuationToken: continuation,
      }),
    );
    const objects = page.Contents?.map((o) => ({ Key: o.Key! }));
    if (objects?.length) {
      const deleted = await client.send(
        new DeleteObjectsCommand({
          Bucket: process.env.S3_BUCKET,
          Delete: { Objects: objects },
        }),
      );
      if (deleted.Errors?.length)
        throw new Error(
          "Не удалось очистить файлы. Повторите удаление аккаунта позже.",
        );
    }
    continuation = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuation);
}
