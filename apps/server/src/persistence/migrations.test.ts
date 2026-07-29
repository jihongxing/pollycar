import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type {
  SqlConnection,
  SqlResult,
  TransactionalSqlClient,
} from "./sql-client.js";
import { runMigrations } from "./migrations.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("数据库迁移安全", () => {
  it("持有全局锁并记录迁移 checksum", async () => {
    const directory = await migrationDirectory("CREATE TABLE example(id text);");
    const connection = new MigrationConnection();
    const applied = await runMigrations(createPool(connection), directory);

    expect(applied).toEqual(["001-example"]);
    expect(connection.statements[0]?.text).toContain("pg_advisory_lock");
    expect(connection.statements.at(-1)?.text).toContain("pg_advisory_unlock");
    expect(connection.statements).toContainEqual({
      text: expect.stringContaining("INSERT INTO pollycar_schema_migrations"),
      values: [
        "001-example",
        createHash("sha256").update("CREATE TABLE example(id text);").digest("hex"),
      ],
    });
  });

  it("拒绝已经执行但内容被修改的迁移", async () => {
    const directory = await migrationDirectory("ALTER TABLE example ADD COLUMN changed text;");
    const connection = new MigrationConnection([{
      version: "001-example",
      checksum: "different-checksum",
    }]);

    await expect(runMigrations(createPool(connection), directory))
      .rejects.toThrow("MIGRATION_CHECKSUM_MISMATCH:001-example");
    expect(connection.statements.some(({ text }) => text === "ROLLBACK")).toBe(true);
    expect(connection.statements.at(-1)?.text).toContain("pg_advisory_unlock");
  });

  it("数据库查询失败时不把迁移误判为未执行", async () => {
    const directory = await migrationDirectory("CREATE TABLE example(id text);");
    const connection = new MigrationConnection([], true);

    await expect(runMigrations(createPool(connection), directory))
      .rejects.toThrow("MIGRATION_LOOKUP_FAILED");
    expect(connection.statements.some(({ text }) => text.includes("CREATE TABLE example"))).toBe(false);
  });
});

class MigrationConnection implements SqlConnection {
  public readonly statements: Array<{
    text: string;
    values?: readonly unknown[];
  }> = [];

  public constructor(
    private readonly existing: readonly Readonly<{
      version: string;
      checksum: string | null;
    }>[] = [],
    private readonly failLookup = false,
  ) {}

  public async query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<TRow>> {
    this.statements.push({ text, ...(values ? { values } : {}) });
    if (text.startsWith("SELECT version, checksum")) {
      if (this.failLookup) throw new Error("MIGRATION_LOOKUP_FAILED");
      return {
        rows: this.existing as unknown as readonly TRow[],
        rowCount: this.existing.length,
      };
    }
    return { rows: [], rowCount: 0 };
  }

  public release(): void {}
}

function createPool(connection: SqlConnection): TransactionalSqlClient {
  return {
    query: (text, values) => connection.query(text, values),
    connect: async () => connection,
  };
}

async function migrationDirectory(sql: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "pollycar-migrations-"));
  temporaryDirectories.push(directory);
  await writeFile(join(directory, "001-example.sql"), sql, "utf8");
  return directory;
}
