import { configureAmveraStaging } from "../../packages/config/amvera.ts";

configureAmveraStaging(process.env);
await import("./start.mjs");
