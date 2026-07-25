export function createProductionPoolConnectionString(databaseUrl: string): string {
  const connectionString = new URL(databaseUrl);
  connectionString.searchParams.delete("sslmode");
  return connectionString.toString();
}
