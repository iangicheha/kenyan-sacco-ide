import { runRetentionCleanup } from "../server/engine/retentionService.js";

async function main() {
  const payload = await runRetentionCleanup();

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[cleanup-retention] failed", error);
  process.exitCode = 1;
});
