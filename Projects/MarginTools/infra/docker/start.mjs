import { mkdir, open, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  privateStorageDir,
  validateRuntime,
} from "../../packages/config/runtime.ts";

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    const stop = (signal) => child.kill(signal);
    const interrupt = () => stop("SIGINT"),
      terminate = () => stop("SIGTERM");
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", terminate);
    child.once("error", reject);
    child.once("exit", (code) => {
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", terminate);
      code === 0
        ? resolve()
        : reject(new Error("Команда запуска завершилась с ошибкой."));
    });
  });
}
try {
  validateRuntime();
  if (process.env.STORAGE_MODE === "local") {
    const directory = privateStorageDir(process.cwd());
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const probe = `${directory}/.write-check-${randomUUID()}`;
    const file = await open(probe, "wx", 0o600);
    await file.close();
    await unlink(probe);
    console.log("Приватное хранилище: запись проверена.");
  }
  await run("npm", ["run", "db:migrate"]);
  await run("npm", ["run", "db:seed"]);
  await run("npm", ["run", "start"]);
} catch {
  console.error(
    "Запуск остановлен: проверьте окружение, права хранилища и доступность базы данных. Секреты не записаны.",
  );
  process.exitCode = 1;
}
