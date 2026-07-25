import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const REQUIRED_APPROVALS = [
  ["POLLYCAR_RELEASE_APPROVAL_GRANTED", "生产启用批准"],
  ["POLLYCAR_PRODUCTION_API_APPROVED", "生产 API 及数据处理批准"],
  ["POLLYCAR_REAL_SMS_DELIVERY_APPROVED", "真实短信服务批准"],
  ["POLLYCAR_REAL_IDENTITY_APPROVED", "真实身份核验服务批准"],
  ["POLLYCAR_AMAP_EXTERNAL_APPROVAL_GRANTED", "高德生产接入批准"],
];

export function collectProductionReleaseFailures({ config, environment }) {
  const failures = [];

  for (const [name, label] of REQUIRED_APPROVALS) {
    if (environment[name] !== "true") {
      failures.push(`缺少${label}：${name}=true`);
    }
  }

  const apiBaseUrl = environment.EXPO_PUBLIC_POLLYCAR_API_BASE_URL?.trim();
  if (!apiBaseUrl) {
    failures.push("缺少 EXPO_PUBLIC_POLLYCAR_API_BASE_URL");
  } else {
    try {
      const url = new URL(apiBaseUrl);
      if (url.protocol !== "https:" || isLocalHost(url.hostname)) {
        failures.push("EXPO_PUBLIC_POLLYCAR_API_BASE_URL 必须是非本机 HTTPS 地址");
      }
    } catch {
      failures.push("EXPO_PUBLIC_POLLYCAR_API_BASE_URL 不是有效 URL");
    }
  }

  if (environment.EXPO_PUBLIC_POLLYCAR_API_MODE !== "production") {
    failures.push("EXPO_PUBLIC_POLLYCAR_API_MODE 必须为 production");
  }

  if (!config.android?.package || isPlaceholderIdentifier(config.android.package)) {
    failures.push("Android 包名仍为占位或内部标识");
  }
  if (!config.ios?.bundleIdentifier || isPlaceholderIdentifier(config.ios.bundleIdentifier)) {
    failures.push("iOS Bundle Identifier 仍为占位或内部标识");
  }
  if (!config.slug || /(?:internal|sandbox)/i.test(config.slug)) {
    failures.push("Expo slug 不得包含 internal 或 sandbox");
  }

  return failures;
}

export async function loadExpoConfig(appJsonPath = resolve("app.json")) {
  return JSON.parse(await readFile(appJsonPath, "utf8")).expo;
}

export async function assertProductionReleaseReady({
  appJsonPath,
  environment = process.env,
} = {}) {
  const config = await loadExpoConfig(appJsonPath);
  const failures = collectProductionReleaseFailures({ config, environment });

  if (failures.length > 0) {
    throw new Error(
      `生产发布门禁未通过：\n${failures.map((item) => `- ${item}`).join("\n")}`,
    );
  }

  return "生产发布门禁通过：正式服务、批准与应用标识已配置。";
}

function isLocalHost(hostname) {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname.endsWith(".local");
}

function isPlaceholderIdentifier(value) {
  return /(?:yourcompany|internal|sandbox)/i.test(value);
}
