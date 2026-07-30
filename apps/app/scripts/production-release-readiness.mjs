import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertBuildConfiguration,
  collectBuildConfigurationFailures,
} from "@pollycar/configuration";

export function collectProductionReleaseFailures({ config, environment }) {
  return collectBuildConfigurationFailures({
    target: "production-release",
    environment,
    appConfig: config,
  });
}

export async function loadExpoConfig(appJsonPath = resolve("app.json")) {
  return JSON.parse(await readFile(appJsonPath, "utf8")).expo;
}

export async function assertProductionReleaseReady({
  appJsonPath,
  environment = process.env,
} = {}) {
  const config = await loadExpoConfig(appJsonPath);
  return assertBuildConfiguration({
    target: "production-release",
    environment,
    appConfig: config,
  });
}
