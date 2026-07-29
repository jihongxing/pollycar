import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const output = resolve(process.argv[2] ?? "output/sbom.cdx.json");
const lockfile = await readFile(resolve("pnpm-lock.yaml"), "utf8");
const components = parsePnpmPackageEntries(lockfile)
  .map(componentFor)
  .sort((left, right) => left["bom-ref"].localeCompare(right["bom-ref"]));

if (components.length === 0) throw new Error("CYCLONEDX_COMPONENTS_REQUIRED");

const bom = {
  $schema: "https://cyclonedx.org/schema/bom-1.6.schema.json",
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  serialNumber: `urn:uuid:${randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: {
      components: [{
        type: "application",
        name: "pollycar-pnpm-lockfile-sbom",
        version: "1",
      }],
    },
    component: {
      type: "application",
      name: "pollycar",
      version: "0.1.0",
    },
  },
  components,
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(bom, null, 2)}\n`, "utf8");
process.stdout.write(`已生成 CycloneDX SBOM：${components.length} 个解析依赖。\n`);

function componentFor({ name, version, integrity }) {
  const hashes = integrity ? integrityHash(integrity) : [];
  return {
    type: "library",
    name,
    version,
    "bom-ref": `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
    purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
    ...(hashes.length ? { hashes } : {}),
  };
}

function parsePnpmPackageEntries(lockfile) {
  const section = lockfile.match(/^packages:\r?\n([\s\S]*?)^snapshots:/m)?.[1];
  if (!section) throw new Error("PNPM_LOCKFILE_PACKAGES_REQUIRED");
  const entries = [];
  const lines = section.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^  '(.+)':$/);
    if (!match) continue;
    const separator = match[1].lastIndexOf("@");
    if (separator < 1) continue;
    const key = match[1];
    const name = key.slice(0, separator);
    const version = key.slice(separator + 1);
    const integrity = lines
      .slice(index + 1, index + 4)
      .join("\n")
      .match(/integrity: ([^,}\s]+)/)?.[1];
    entries.push({ name, version, integrity });
  }
  return entries;
}

function integrityHash(integrity) {
  const match = integrity.match(/^(sha512|sha256)-(.+)$/);
  if (!match) return [];
  const [, algorithm, encoded] = match;
  return [{
    alg: algorithm.toUpperCase(),
    content: Buffer.from(encoded, "base64").toString("hex"),
  }];
}
