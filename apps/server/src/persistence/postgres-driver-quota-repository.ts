import type { QuotaHistoryItem } from "@pollycar/domain";
import type { PostgresTransaction } from "./postgres-transaction.js";

type QuotaRow = Readonly<{ occupied_at: string | Date }>;

export class PostgresDriverQuotaRepository {
  public constructor(private readonly transaction: PostgresTransaction) {}

  public async listCountedHistory(accountId: string): Promise<readonly QuotaHistoryItem[]> {
    const result = await this.transaction.currentClient().query<QuotaRow>(
      `SELECT occupied_at
         FROM pollycar_driver_quota_occupancies
        WHERE driver_account_id = $1
          AND occupancy_state IN ('occupied', 'finalized')
        ORDER BY occupied_at`,
      [accountId],
    );
    return result.rows.map((row) => ({
      occurredAt: row.occupied_at instanceof Date ? row.occupied_at : new Date(row.occupied_at),
    }));
  }
}
