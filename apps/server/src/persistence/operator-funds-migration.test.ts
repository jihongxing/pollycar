import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../migrations/0009_operator_funds_orchestration.sql", import.meta.url),
);

describe("多运营主体资金编排迁移", () => {
  it("只建立编排事实和账本引用，不建立第二套余额事实源", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const table of [
      "driver_operator_memberships",
      "financial_allocations",
      "operator_settlement_batches",
      "driver_payout_batches",
      "operator_fund_cases",
    ]) {
      expect(sql).toContain(`CREATE TABLE pollycar_finance.${table}`);
    }
    expect(sql).toContain("CREATE FUNCTION pollycar_finance.apply_operator_funds_command");
    expect(sql).toContain("driver_operator_memberships_one_active");
    expect(sql).toContain("platform_share_minor + operator_share_minor + driver_share_minor");
    expect(sql.match(/assert_reconciliation_action_allowed/g)?.length).toBeGreaterThanOrEqual(6);
    expect(sql).toContain("ALLOCATION_LEDGER_TRANSACTION_INVALID");
    expect(sql).toContain("PAYOUT_REQUEST_LEDGER_TRANSACTION_INVALID");
    expect(sql).toContain("PAYOUT_COMPLETE_LEDGER_TRANSACTION_INVALID");
    expect(sql).not.toMatch(/CREATE TABLE[^;]*(?:balance|wallet)/is);
    expect(sql).not.toMatch(
      /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[^;]*operator_[a-z_]+[^;]*pollycar_ledger_runtime/is,
    );
  });
});
