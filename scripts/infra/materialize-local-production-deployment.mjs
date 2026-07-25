import { cp, lstat, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const [sourceArgument, targetArgument] = process.argv.slice(2);

if (!sourceArgument || !targetArgument) {
  throw new Error("必须提供部署源目录和镜像产物目录");
}

const source = path.resolve(sourceArgument);
const target = path.resolve(targetArgument);

if (source === target || target.startsWith(`${source}${path.sep}`)) {
  throw new Error("镜像产物目录不得位于部署源目录内部");
}

const sourceStats = await lstat(source);
if (!sourceStats.isDirectory()) {
  throw new Error("部署源路径不是目录");
}

await mkdir(path.dirname(target), { recursive: true });
await cp(source, target, {
  recursive: true,
  dereference: true,
  force: true,
});

const virtualModules = path.join(source, "node_modules", ".pnpm", "node_modules");
const targetModules = path.join(target, "node_modules");

for (const entry of await readdir(virtualModules, { withFileTypes: true })) {
  if (entry.name.startsWith("@")) {
    const sourceScope = path.join(virtualModules, entry.name);
    const targetScope = path.join(targetModules, entry.name);
    await mkdir(targetScope, { recursive: true });
    for (const scopedEntry of await readdir(sourceScope, { withFileTypes: true })) {
      await cp(
        path.join(sourceScope, scopedEntry.name),
        path.join(targetScope, scopedEntry.name),
        { recursive: true, dereference: true, force: true },
      );
    }
    continue;
  }

  await cp(
    path.join(virtualModules, entry.name),
    path.join(targetModules, entry.name),
    { recursive: true, dereference: true, force: true },
  );
}
