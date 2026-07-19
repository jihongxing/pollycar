import { AsyncLocalStorage } from "node:async_hooks";
import type { Transaction } from "../ports/storage.js";
import type { SqlClient, TransactionalSqlClient } from "./sql-client.js";

export class PostgresTransaction implements Transaction {
  private readonly context = new AsyncLocalStorage<SqlClient>();

  public constructor(private readonly pool: TransactionalSqlClient) {}

  public currentClient(): SqlClient {
    return this.context.getStore() ?? this.pool;
  }

  public requireCurrentClient(): SqlClient {
    const client = this.context.getStore();
    if (!client) throw new Error("LEDGER_TRANSACTION_REQUIRED");
    return client;
  }

  public async run<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    if (this.context.getStore()) return operation();
    const connection = await this.pool.connect();
    await connection.query("BEGIN");
    try {
      const result = await this.context.run(connection, operation);
      await connection.query("COMMIT");
      return result;
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }
}
