import { describe, expect, it } from "vitest";
import { PostgresTransaction } from "./postgres-transaction.js";
import type { SqlConnection, TransactionalSqlClient } from "./sql-client.js";

describe("PostgreSQL 事务边界", () => {
  it("成功提交并在仓储间共享同一连接", async () => {
    const statements: string[] = [];
    const connection = createConnection(statements);
    const pool = createPool(connection);
    const transaction = new PostgresTransaction(pool);

    await transaction.run(async () => {
      expect(transaction.currentClient()).toBe(connection);
      await transaction.currentClient().query("业务写入");
    });

    expect(statements).toEqual(["BEGIN", "业务写入", "COMMIT", "RELEASE"]);
  });

  it("失败时回滚", async () => {
    const statements: string[] = [];
    const transaction = new PostgresTransaction(createPool(createConnection(statements)));

    await expect(
      transaction.run(async () => {
        throw new Error("FAILED");
      }),
    ).rejects.toThrow("FAILED");
    expect(statements).toEqual(["BEGIN", "ROLLBACK", "RELEASE"]);
  });

  it("资金写入客户端只能在显式事务中取得", async () => {
    const statements: string[] = [];
    const connection = createConnection(statements);
    const transaction = new PostgresTransaction(createPool(connection));

    expect(() => transaction.requireCurrentClient()).toThrow("LEDGER_TRANSACTION_REQUIRED");
    await transaction.run(async () => {
      expect(transaction.requireCurrentClient()).toBe(connection);
    });
  });
});

function createConnection(statements: string[]): SqlConnection {
  return {
    query: async (text) => {
      statements.push(text);
      return { rows: [], rowCount: 0 };
    },
    release: () => statements.push("RELEASE"),
  };
}

function createPool(connection: SqlConnection): TransactionalSqlClient {
  return {
    connect: async () => connection,
    query: async () => ({ rows: [], rowCount: 0 }),
  };
}
