const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withProjectBuildGradle,
  withDangerousMod,
  withInfoPlist,
} = require("expo/config-plugins");
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
    nextConfig = withProjectBuildGradle(nextConfig, (modConfig) => {
      const marker = "// POLLYCAR_AMAP_MAVEN_REPOSITORY";
      if (!modConfig.modResults.contents.includes(marker)) {
        modConfig.modResults.contents = modConfig.modResults.contents.replace(
          /mavenCentral\(\)/,
          (repository) =>
            `${repository}\n    ${marker}\n    maven { url "https://maven.aliyun.com/repository/public" }`,
        );
      }
      return modConfig;
    });
    nextConfig = withAppBuildGradle(nextConfig, (modConfig) => {
      const marker = "// POLLYCAR_AMAP_ANDROID_DEPENDENCIES";
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        new RegExp(`\\n${marker}\\ndependencies \\{[\\s\\S]*?\\n\\}\\n?`, "g"),
        "\n",
      );
      return modConfig;
    });
    nextConfig = withAndroidManifest(nextConfig, (modConfig) => {
      const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
        modConfig.modResults,
      );
      modConfig.modResults.manifest["uses-permission"] ??= [];
      for (const permission of [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
      ]) {
        if (!modConfig.modResults.manifest["uses-permission"].some(
          (item) => item.$?.["android:name"] === permission,
        )) {
          modConfig.modResults.manifest["uses-permission"].push({
            $: { "android:name": permission },
          });
        }
      }
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
      modConfig.modResults.NSLocationWhenInUseUsageDescription =
        "用于在你选择上车点或目的地时显示附近位置。";
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
