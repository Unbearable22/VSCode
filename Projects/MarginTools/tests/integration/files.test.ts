import { it, expect, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, access, rm } from "node:fs/promises";
import path from "node:path";
import {
  deleteWorkspaceFiles,
  projectRoot,
  storeFile,
  getFile,
} from "../../packages/files";

it("удаляет файлы только выбранного рабочего пространства и отклоняет выход из каталога", async () => {
  const root = path.join(projectRoot, "data/private");
  await mkdir(root, { recursive: true });
  const owner = await mkdtemp(path.join(root, "file-test-owner-"));
  const other = await mkdtemp(path.join(root, "file-test-other-"));
  try {
    await writeFile(path.join(owner, "logo.png"), "test");
    await writeFile(path.join(other, "logo.png"), "keep");
    await expect(deleteWorkspaceFiles("../")).rejects.toThrow("идентификатор");
    await deleteWorkspaceFiles(path.basename(owner));
    await expect(access(owner)).rejects.toThrow();
    await expect(access(path.join(other, "logo.png"))).resolves.toBeUndefined();
  } finally {
    await rm(owner, { recursive: true, force: true });
    await rm(other, { recursive: true, force: true });
  }
});
it("хранит приватные файлы в заданном каталоге только с production-флагом", async () => {
  const directory = await mkdtemp("/tmp/mt-private-");
  try {
    vi.stubEnv("PRIVATE_STORAGE_DIR", directory);
    vi.stubEnv("STORAGE_MODE", "local");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_LOCAL_STORAGE_IN_PRODUCTION", "false");
    await expect(
      storeFile("owner/doc.pdf", Buffer.from("%PDF-test"), "application/pdf"),
    ).rejects.toThrow("S3");
    vi.stubEnv("ALLOW_LOCAL_STORAGE_IN_PRODUCTION", "true");
    await storeFile(
      "owner/doc.pdf",
      Buffer.from("%PDF-test"),
      "application/pdf",
    );
    expect((await getFile("owner/doc.pdf")).toString()).toBe("%PDF-test");
    await expect(
      storeFile("../doc.pdf", Buffer.from("test"), "application/pdf"),
    ).rejects.toThrow("путь");
    await expect(getFile("/owner/doc.pdf")).rejects.toThrow("путь");
    await deleteWorkspaceFiles("owner");
    await expect(
      access(path.join(directory, "owner/doc.pdf")),
    ).rejects.toThrow();
  } finally {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  }
});
