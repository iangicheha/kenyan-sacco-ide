import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Regulator } from "../types.js";

export async function readRegulatoryConfig(regulator: Regulator): Promise<unknown> {
  const file = resolve(process.cwd(), "server", "config", "regulators", `${regulator.toLowerCase()}.json`);
  const raw = await readFile(file, "utf-8");
  return JSON.parse(raw);
}
