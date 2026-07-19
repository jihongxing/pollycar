import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../migrations/0007_financial_ledger.sql", import.meta.url),
);

describe("正式账本迁移", () => {
  it("固化唯一过账函数、不可变触发器、延迟平衡约束和最小权限", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain(
      "CREATE FUNCTION pollycar_finance.post_ledger_transaction(p_request jsonb)",
    );
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = pg_catalog, pollycar_finance");
    expect(sql).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(sql.match(/pg_advisory_xact_lock/g)).toHaveLength(2);
    expect(sql).toContain("pollycar_ledger:idempotency:");
    expect(sql).toContain("pollycar_ledger:source_event:");
    expect(sql).toContain("CREATE TRIGGER ledger_transactions_immutable");
    expect(sql).toContain("CREATE TRIGGER ledger_entries_immutable");
    expect(sql).toContain("CREATE TRIGGER ledger_accounts_protected");
    expect(sql).toContain("INSERT INTO public.pollycar_outbox");
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION pollycar_finance.post_ledger_transaction(jsonb)",
    );
    expect(sql).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA pollycar_finance FROM PUBLIC");
    expect(sql).not.toMatch(
      /GRANT\s+(?:INSERT|UPDATE|DELETE|TRUNCATE|ALL)[^;]*ON\s+ALL\s+TABLES[^;]*pollycar_ledger_runtime/is,
    );
  });
});
