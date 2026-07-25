import { assertProductionReleaseReady } from "./production-release-readiness.mjs";

try {
  console.log(await assertProductionReleaseReady());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
