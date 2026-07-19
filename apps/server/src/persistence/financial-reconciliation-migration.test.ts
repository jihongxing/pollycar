import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../migrations/0008_financial_reconciliation.sql", import.meta.url),
);

describe("正式资金对账迁移", () => {
  it("建立专用事实、批次、案件、恢复和关账表及安全定义函数", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const table of [
      "reconciliation_runs",
      "reconciliation_facts",
      "reconciliation_items",
      "reconciliation_recovery_actions",
      "financial_business_days",
    ]) {
      expect(sql).toContain(`CREATE TABLE pollycar_finance.${table}`);
    }
    for (const fn of [
      "record_reconciliation_evaluation",
      "close_reconciliation_run",
      "assert_reconciliation_action_allowed",
      "close_financial_business_date",
      "record_reconciliation_recovery_result",
      "resolve_reconciliation_item",
    ]) {
      expect(sql).toContain(`CREATE FUNCTION pollycar_finance.${fn}`);
    }
    expect(sql.match(/SECURITY DEFINER/g)).toHaveLength(6);
    expect(sql).toContain("RECONCILIATION_ACTION_BLOCKED");
    expect(sql).toContain("RECONCILIATION_RUNS_NOT_CLOSED");
    expect(sql).toContain("resolution_evidence_reference");
    expect(sql).toContain("RECONCILIATION_RESOLUTION_EVIDENCE_REQUIRED");
    expect(sql).not.toMatch(
      /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[^;]*reconciliation_[a-z_]+[^;]*pollycar_ledger_runtime/is,
    );
  });
});
