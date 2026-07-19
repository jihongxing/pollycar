import { readFile, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const outputDirectory = resolve(process.argv[2] ?? "dist-production");
const forbiddenEverywhere = ["内部沙箱", "合成", "机器码"];
const forbiddenVisibleCopy = ["Server"];
const requiredDisclosures = ["费用", "不会扣款", "安全", "取消"];
const files = await collectFiles(outputDirectory);
const findings = [];
let combined = "";

for (const file of files) {
  const content = await readFile(file, "utf8");
  combined += content;
  for (const term of forbiddenEverywhere) {
    if (content.includes(term)) findings.push(`${term}: ${file}`);
  }
}

const sourceRoots = [
  resolve("src/features"),
  resolve("src/components"),
  resolve("src/application"),
  resolve("src/navigation"),
];
for (const file of await collectFiles(sourceRoots)) {
  const content = await readFile(file, "utf8");
  for (const term of forbiddenVisibleCopy) {
    const visibleLiteral = new RegExp(`["'\`]([^"'\\\`\\n]*${term}[^"'\\\`\\n]*)["'\`]`, "g");
    for (const match of content.matchAll(visibleLiteral)) {
      if (match[1]?.includes("EXPO_PUBLIC") || match[1]?.includes("POLLYCAR")) continue;
      findings.push(`${term}: ${file}: ${match[1]}`);
    }
  }
}

for (const disclosure of requiredDisclosures) {
  if (!containsText(combined, disclosure)) {
    findings.push(`缺少必要披露: ${disclosure}`);
  }
}

if (findings.length > 0) {
  console.error(`生产品牌产物检查失败：\n${findings.join("\n")}`);
  process.exit(1);
}

console.log("生产品牌产物检查通过：未发现内部技术词，费用、安全和取消披露仍存在。");

function containsText(content, value) {
  const escaped = [...value]
    .map((character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`)
    .join("");
  return content.includes(value) || content.toLowerCase().includes(escaped);
}

async function collectFiles(input) {
  const roots = Array.isArray(input) ? input : [input];
  const result = [];
  for (const root of roots) {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      const path = join(root, entry.name);
      if (entry.isDirectory()) result.push(...await collectFiles(path));
      else if ([".js", ".html", ".json", ".ts", ".tsx"].includes(extname(entry.name))) result.push(path);
    }
  }
  return result;
}
