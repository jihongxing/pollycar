const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withInfoPlist,
} = require("@expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");
const { resolveAmapBuildPolicy } = require("./amap-build-policy.cjs");

module.exports = function withPollyCarMapModule(config) {
  const policy = resolveAmapBuildPolicy(config);
  if (!policy.enabled) {
    return config;
  }

  let nextConfig = config;
  if (policy.androidEnabled) {
    nextConfig = withAppBuildGradle(nextConfig, (modConfig) => {
      const dependencyLines = policy.androidCoordinates
        .map((coordinate) => `    implementation("${coordinate}")`)
        .join("\n");
      const marker = "// POLLYCAR_AMAP_ANDROID_DEPENDENCIES";
      if (!modConfig.modResults.contents.includes(marker)) {
        modConfig.modResults.contents += `\n${marker}\ndependencies {\n${dependencyLines}\n}\n`;
      }
      return modConfig;
    });
    nextConfig = withAndroidManifest(nextConfig, (modConfig) => {
      const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
        modConfig.modResults,
      );
      mainApplication["meta-data"] ??= [];
      const withoutExistingKey = mainApplication["meta-data"].filter(
        (item) => item.$?.["android:name"] !== "com.amap.api.v2.apikey",
      );
      withoutExistingKey.push({
        $: {
          "android:name": "com.amap.api.v2.apikey",
          "android:value": policy.androidApiKey,
        },
      });
      mainApplication["meta-data"] = withoutExistingKey;
      return modConfig;
    });
  }

  if (policy.iosEnabled) {
    nextConfig = withInfoPlist(nextConfig, (modConfig) => {
      modConfig.modResults.PollyCarAmapApiKey = policy.iosApiKey;
      modConfig.modResults.PollyCarAmapApprovalReference = policy.approvalReference;
      return modConfig;
    });
    nextConfig = withDangerousMod(nextConfig, [
      "ios",
      async (modConfig) => {
        const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, "Podfile");
        const marker = "# POLLYCAR_AMAP_IOS_PODS";
        const podfile = await fs.readFile(podfilePath, "utf8");
        if (!podfile.includes(marker)) {
          const podLines = policy.iosPods
            .map((podName) => `  pod '${podName}'`)
            .join("\n");
          const insertionPoint = /^(\s*)use_expo_modules!\s*$/m;
          if (!insertionPoint.test(podfile)) {
            throw new Error("AMAP_IOS_PODFILE_INSERTION_POINT_MISSING");
          }
          await fs.writeFile(
            podfilePath,
            podfile.replace(
              insertionPoint,
              (line) => `${line}\n  ${marker}\n${podLines}`,
            ),
            "utf8",
          );
        }
        return modConfig;
      },
    ]);
  }

  return nextConfig;
};
