import { assertProductionReleaseReady } from "./production-release-readiness.mjs";

if (process.env.POLLYCAR_PRODUCTION_BUILD === "true") {
  console.log(await assertProductionReleaseReady());
} else {
  console.log("当前不是生产构建，跳过生产发布门禁。");
}
