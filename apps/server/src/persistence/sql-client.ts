export type SqlResult<TRow extends Record<string, unknown> = Record<string, unknown>> = Readonly<{
  rows: readonly TRow[];
  rowCount: number;
}>;

export interface SqlClient {
  query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<TRow>>;
}

export interface TransactionalSqlClient extends SqlClient {
  connect(): Promise<SqlConnection>;
}

export interface SqlConnection extends SqlClient {
  release(): void;
}
